// War of Kings Kartenwerkstatt – Windows-Version.
// Eine einzige .exe: installiert sich (ohne Adminrechte), startet die Werkstatt offline
// in einem eigenen App-Fenster (Edge/Chrome im App-Modus) und kann sich wieder deinstallieren.
// Die Oberfläche läuft komplett aus der .exe; Karten, Bilder und Exporte liegen als Dateien
// in „Dokumente\War of Kings Kartenwerkstatt“.
package main

import (
	"bytes"
	"crypto/sha1"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	appName    = "War of Kings Kartenwerkstatt"
	appVersion = "12.5"
	appID      = "wok-kartenwerkstatt"
	basePort   = 47831
)

//go:embed app
var appFS embed.FS

var (
	dataDir   string // Dokumente\War of Kings Kartenwerkstatt
	cacheDir  string // %LOCALAPPDATA%\WoK Kartenwerkstatt
	lastPing  atomic.Int64
	byeAt     atomic.Int64
	quitCh    = make(chan struct{}, 1)
	fontsOnce sync.Once
	fontsDone = make(chan struct{})
	fontsOK   atomic.Bool
	idRe      = regexp.MustCompile(`^[A-Za-z0-9_-]{1,80}$`)
)

func main() {
	args := os.Args[1:]
	has := func(f string) bool {
		for _, a := range args {
			if strings.EqualFold(a, f) {
				return true
			}
		}
		return false
	}
	switch {
	case has("--uninstall"):
		uninstall()
	case has("--serve"): // nur zum Testen: Server ohne Fenster
		setupDirs()
		port, ln := listen()
		fmt.Println("http://127.0.0.1:" + fmt.Sprint(port) + "/")
		serve(ln, false)
	case has("--app") || isInstalledCopy():
		runApp()
	default:
		installer()
	}
}

func setupDirs() {
	dataDir = filepath.Join(documentsDir(), appName)
	cacheDir = filepath.Join(localAppData(), "WoK Kartenwerkstatt")
	for _, d := range []string{"Karten", "Bilder", "Einstellungen", "Exporte"} {
		os.MkdirAll(filepath.Join(dataDir, d), 0o755)
	}
	os.MkdirAll(filepath.Join(cacheDir, "fonts"), 0o755)
}

// ---------- App starten ----------

func runApp() {
	setupDirs()
	// Läuft schon eine Werkstatt? Dann nur ein weiteres Fenster öffnen.
	// Läuft eine ÄLTERE Version (z. B. noch im Hintergrund nach einem Update), wird sie beendet, damit die neue startet.
	for p := basePort; p < basePort+10; p++ {
		if v := ourVersion(p); v != "" {
			if v == appVersion {
				openWindow(fmt.Sprintf("http://127.0.0.1:%d/", p))
				return
			}
			c := http.Client{Timeout: time.Second}
			if r, err := c.Post(fmt.Sprintf("http://127.0.0.1:%d/api/quit", p), "text/plain", nil); err == nil {
				r.Body.Close()
			}
			for i := 0; i < 20 && ourVersion(p) != ""; i++ {
				time.Sleep(150 * time.Millisecond)
			}
		}
	}
	port, ln := listen()
	if ln == nil {
		msgBox(appName, "Die Werkstatt konnte keinen lokalen Anschluss öffnen (Ports 47831–47840 belegt).", mbIconError)
		return
	}
	go prefetchFonts()
	lastPing.Store(time.Now().UnixMilli())
	started := time.Now()
	if wait := openWindowWait(fmt.Sprintf("http://127.0.0.1:%d/", port)); wait != nil {
		// Eigenes Browserfenster: wenn es geschlossen wird, endet auch die Werkstatt
		go func() {
			wait()
			if time.Since(started) < 8*time.Second {
				return // Fenster wurde an einen schon laufenden Browser übergeben: dann zählt der Herzschlag
			}
			time.Sleep(3 * time.Second)
			if time.Now().UnixMilli()-lastPing.Load() > 2500 {
				select {
				case quitCh <- struct{}{}:
				default:
				}
			}
		}()
	} else {
		msgBox(appName, "Weder Microsoft Edge noch Google Chrome wurde gefunden.\nDie Werkstatt öffnet sich deshalb im Standardbrowser.", mbIconInfo)
		openDefaultBrowser(fmt.Sprintf("http://127.0.0.1:%d/", port))
	}
	serve(ln, true)
}

func listen() (int, net.Listener) {
	for p := basePort; p < basePort+10; p++ {
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p))
		if err == nil {
			return p, ln
		}
	}
	return 0, nil
}

// Version der dort laufenden Werkstatt, leer wenn keine läuft
func ourVersion(port int) string {
	c := http.Client{Timeout: 800 * time.Millisecond}
	r, err := c.Get(fmt.Sprintf("http://127.0.0.1:%d/api/whoami", port))
	if err != nil {
		return ""
	}
	defer r.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(r.Body, 200))
	if !strings.HasPrefix(string(b), appID) {
		return ""
	}
	if v := strings.TrimSpace(strings.TrimPrefix(string(b), appID)); v != "" {
		return v
	}
	return "?"
}

func isOurs(port int) bool {
	c := http.Client{Timeout: 800 * time.Millisecond}
	r, err := c.Get(fmt.Sprintf("http://127.0.0.1:%d/api/whoami", port))
	if err != nil {
		return false
	}
	defer r.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(r.Body, 200))
	return strings.HasPrefix(string(b), appID)
}

// Beendet sich, wenn kein Fenster mehr offen ist (Herzschlag der Seite bleibt aus).
func watchdog(srv *http.Server) {
	start := time.Now()
	for {
		select {
		case <-quitCh:
			srv.Close()
			return
		case <-time.After(2 * time.Second):
		}
		now := time.Now().UnixMilli()
		idle := now - lastPing.Load()
		bye := byeAt.Load()
		if bye > 0 && now-bye > 6000 && lastPing.Load() < bye {
			srv.Close()
			return
		}
		// Minimierte Fenster melden sich höchstens einmal pro Minute, darum großzügig
		if time.Since(start) > 3*time.Minute && idle > 150000 {
			srv.Close()
			return
		}
	}
}

func serve(ln net.Listener, autoQuit bool) {
	mux := http.NewServeMux()
	sub, _ := fs.Sub(appFS, "app")
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(r.URL.Path, "/")
		switch p {
		case "", "index.html":
			p = "index.html"
		case "icon.png", "icon.ico":
		case "lib/pdf-lib.min.js":
			p = "pdf-lib.min.js"
		default:
			http.NotFound(w, r)
			return
		}
		b, err := fs.ReadFile(sub, p)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", map[string]string{"index.html": "text/html; charset=utf-8", "pdf-lib.min.js": "text/javascript; charset=utf-8", "icon.png": "image/png", "icon.ico": "image/x-icon"}[p])
		w.Header().Set("Cache-Control", "no-cache")
		w.Write(b)
	})
	mux.HandleFunc("/fonts.css", handleFontsCSS)
	mux.HandleFunc("/fonts/", handleFontFile)
	mux.HandleFunc("/api/", handleAPI)
	srv := &http.Server{Handler: localOnly(mux), ReadHeaderTimeout: 10 * time.Second}
	if autoQuit {
		go watchdog(srv)
	}
	err := srv.Serve(ln)
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		fmt.Println(err)
	}
}

// Nur Anfragen dieses PCs annehmen, keine fremden Webseiten (DNS-Rebinding/CSRF-Schutz).
func localOnly(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := r.Host
		if i := strings.LastIndex(host, ":"); i >= 0 {
			host = host[:i]
		}
		if host != "127.0.0.1" && host != "localhost" {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		if o := r.Header.Get("Origin"); o != "" && o != "null" {
			u, err := url.Parse(o)
			if err != nil || (u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost") {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
		}
		h.ServeHTTP(w, r)
	})
}

// ---------- Daten-API ----------

func handleAPI(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/"), "/"), "/")
	key := ""
	if len(parts) > 1 {
		key = parts[1]
		if !idRe.MatchString(key) {
			http.Error(w, "bad id", 400)
			return
		}
	}
	switch parts[0] {
	case "ai":
		handleAI(w, r, key)
	case "sync":
		handleSync(w, r, key)
	case "pack":
		handlePack(w, r, key)
	case "whoami":
		io.WriteString(w, appID+" "+appVersion)
	case "ping":
		lastPing.Store(time.Now().UnixMilli())
		w.WriteHeader(204)
	case "bye":
		byeAt.Store(time.Now().UnixMilli())
		w.WriteHeader(204)
	case "quit":
		if r.Method != http.MethodPost {
			http.Error(w, "method", 405)
			return
		}
		w.WriteHeader(204)
		select {
		case quitCh <- struct{}{}:
		default:
		}
	case "status":
		writeJSON(w, map[string]any{"version": appVersion, "fonts": fontsCached(), "data": dataDir})
	case "cards":
		dir := filepath.Join(dataDir, "Karten")
		switch {
		case r.Method == http.MethodGet && key == "":
			out := map[string]json.RawMessage{}
			ents, _ := os.ReadDir(dir)
			for _, e := range ents {
				n := e.Name()
				if e.IsDir() || !strings.HasSuffix(n, ".json") {
					continue
				}
				b, err := os.ReadFile(filepath.Join(dir, n))
				if err == nil && json.Valid(b) {
					out[strings.TrimSuffix(n, ".json")] = b
				}
			}
			writeJSON(w, out)
		case r.Method == http.MethodPut && key != "":
			b, err := io.ReadAll(io.LimitReader(r.Body, 20<<20))
			if err != nil || !json.Valid(b) {
				http.Error(w, "bad json", 400)
				return
			}
			if err := atomicWrite(filepath.Join(dir, key+".json"), b); err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			w.WriteHeader(204)
		case r.Method == http.MethodDelete && key != "":
			// Gelöschte Karten wandern in den Papierkorb-Ordner statt endgültig zu verschwinden
			os.MkdirAll(filepath.Join(dataDir, "Karten", "Papierkorb"), 0o755)
			os.Rename(filepath.Join(dir, key+".json"), filepath.Join(dir, "Papierkorb", key+".json"))
			w.WriteHeader(204)
		default:
			http.Error(w, "method", 405)
		}
	case "blobs":
		dir := filepath.Join(dataDir, "Bilder")
		switch {
		case r.Method == http.MethodPost && key == "":
			b, err := io.ReadAll(io.LimitReader(r.Body, 60<<20))
			if err != nil || len(b) == 0 {
				http.Error(w, "empty", 400)
				return
			}
			ext := map[string]string{"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}[http.DetectContentType(b)]
			if ext == "" && bytes.Contains(b[:min(len(b), 64)], []byte("WEBP")) {
				ext = ".webp"
			}
			id := fmt.Sprintf("b%x%04x", time.Now().UnixMilli(), rand.Intn(0xffff))
			if err := atomicWrite(filepath.Join(dir, id+ext), b); err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			writeJSON(w, map[string]string{"id": id})
		case r.Method == http.MethodGet && key != "":
			m, _ := filepath.Glob(filepath.Join(dir, key+".*"))
			if len(m) == 0 {
				m, _ = filepath.Glob(filepath.Join(dir, key))
			}
			if len(m) == 0 {
				http.NotFound(w, r)
				return
			}
			b, err := os.ReadFile(m[0])
			if err != nil {
				http.NotFound(w, r)
				return
			}
			ct := http.DetectContentType(b)
			if strings.HasSuffix(m[0], ".webp") {
				ct = "image/webp"
			}
			w.Header().Set("Content-Type", ct)
			w.Header().Set("Cache-Control", "max-age=31536000, immutable")
			w.Write(b)
		default:
			http.Error(w, "method", 405)
		}
	case "config":
		p := filepath.Join(dataDir, "Einstellungen", key+".json")
		switch {
		case key == "":
			http.Error(w, "key", 400)
		case r.Method == http.MethodGet:
			b, err := os.ReadFile(p)
			if err != nil {
				b = []byte("null")
			}
			w.Header().Set("Content-Type", "application/json")
			w.Write(b)
		case r.Method == http.MethodPut:
			b, err := io.ReadAll(io.LimitReader(r.Body, 20<<20))
			if err != nil || !json.Valid(b) {
				http.Error(w, "bad json", 400)
				return
			}
			if err := atomicWrite(p, b); err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			w.WriteHeader(204)
		default:
			http.Error(w, "method", 405)
		}
	case "export":
		if r.Method != http.MethodPost {
			http.Error(w, "method", 405)
			return
		}
		name := safeName(r.URL.Query().Get("name"))
		b, err := io.ReadAll(io.LimitReader(r.Body, 500<<20))
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		dir := filepath.Join(dataDir, "Exporte")
		if sub := r.URL.Query().Get("dir"); sub != "" {
			dir = filepath.Join(dir, safeName(sub))
			os.MkdirAll(dir, 0o755)
		}
		os.MkdirAll(dir, 0o755)
		p := uniquePath(dir, name)
		if err := os.WriteFile(p, b, 0o644); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, map[string]string{"name": filepath.Base(p), "path": p})
	case "spielpaket": // Übergabe ans Probe-Spiel: Dokumente\War of Kings Spielpakete
		if r.Method != http.MethodPost {
			http.Error(w, "method", 405)
			return
		}
		name := safeName(r.URL.Query().Get("name"))
		if !strings.HasSuffix(strings.ToLower(name), ".wokspiel") {
			name += ".wokspiel"
		}
		b, err := io.ReadAll(io.LimitReader(r.Body, 500<<20))
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		dir := filepath.Join(documentsDir(), "War of Kings Spielpakete")
		os.MkdirAll(dir, 0o755)
		p := uniquePath(dir, name)
		if err := atomicWrite(p, b); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, map[string]string{"name": filepath.Base(p), "path": p})
	case "open-folder":
		if r.Method != http.MethodPost {
			http.Error(w, "method", 405)
			return
		}
		target := filepath.Join(dataDir, "Exporte")
		if sub := r.URL.Query().Get("dir"); sub != "" {
			if st, err := os.Stat(filepath.Join(target, safeName(sub))); err == nil && st.IsDir() {
				target = filepath.Join(target, safeName(sub))
			}
		}
		openFolder(target)
		w.WriteHeader(204)
	default:
		http.NotFound(w, r)
	}
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(v)
}

func atomicWrite(p string, b []byte) error {
	os.MkdirAll(filepath.Dir(p), 0o755) // Ordner neu anlegen, falls er im Betrieb gelöscht wurde
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, p)
}

var badChars = regexp.MustCompile(`[<>:"/\\|?*\x00-\x1f]+`)

func safeName(n string) string {
	n = strings.TrimSpace(badChars.ReplaceAllString(n, "_"))
	n = strings.Trim(n, ". ")
	if n == "" {
		n = "Export"
	}
	if len(n) > 120 {
		n = n[:120]
	}
	return n
}

func uniquePath(dir, name string) string {
	p := filepath.Join(dir, name)
	ext := filepath.Ext(name)
	stem := strings.TrimSuffix(name, ext)
	for i := 2; ; i++ {
		if _, err := os.Stat(p); os.IsNotExist(err) {
			return p
		}
		p = filepath.Join(dir, fmt.Sprintf("%s (%d)%s", stem, i, ext))
	}
}

// ---------- Schriften ----------
// Beim ersten Start mit Internet werden die Google-Schriften (SIL Open Font License) einmal geladen
// und dauerhaft gespeichert. Danach läuft alles offline. Ohne Internet: ähnliche Windows-Schriften.

var fontFamilies = []string{
	"Cinzel:wght@500;600;700;800;900", "Cinzel+Decorative:wght@400;700;900", "Cormorant+Garamond:wght@500;600;700",
	"Cormorant+SC:wght@500;600;700", "EB+Garamond:wght@500;600;700;800", "Marcellus", "Marcellus+SC",
	"Spectral:wght@400;500;600;700", "Spectral+SC:wght@500;600;700", "IM+Fell+English", "IM+Fell+English+SC",
	"Alegreya:wght@500;700;800", "Alegreya+SC:wght@500;700;800", "Playfair+Display+SC:wght@700;900", "Almendra+SC",
	"Grenze+Gotisch:wght@500;600;700;800", "UnifrakturMaguntia", "Pirata+One", "Uncial+Antiqua", "Forum",
	"Alegreya+Sans:wght@400;500;700",
}

var fallbackFonts = map[string]string{
	"Cinzel": "Trajan Pro|Constantia|Palatino Linotype", "Cinzel Decorative": "Trajan Pro|Constantia|Palatino Linotype",
	"Cormorant Garamond": "Garamond|Palatino Linotype", "Cormorant SC": "Garamond|Palatino Linotype",
	"EB Garamond": "Garamond|Book Antiqua|Palatino Linotype", "Marcellus": "Constantia|Palatino Linotype", "Marcellus SC": "Constantia|Palatino Linotype",
	"Spectral": "Cambria|Georgia", "Spectral SC": "Cambria|Georgia", "IM Fell English": "Palatino Linotype|Georgia", "IM Fell English SC": "Palatino Linotype|Georgia",
	"Alegreya": "Book Antiqua|Palatino Linotype", "Alegreya SC": "Book Antiqua|Palatino Linotype", "Playfair Display SC": "Bodoni MT|Georgia",
	"Almendra SC": "Constantia|Georgia", "Grenze Gotisch": "Old English Text MT|Constantia", "UnifrakturMaguntia": "Old English Text MT|Constantia",
	"Pirata One": "Old English Text MT|Constantia", "Uncial Antiqua": "Gabriola|Constantia", "Forum": "Constantia|Georgia", "Alegreya Sans": "Segoe UI|Arial",
}

func fontsCached() bool {
	_, err := os.Stat(filepath.Join(cacheDir, "fonts", "fonts.css"))
	return err == nil
}

var urlRe = regexp.MustCompile(`url\((https://fonts\.gstatic\.com/[^)]+)\)`)

func prefetchFonts() {
	fontsOnce.Do(func() {
		defer close(fontsDone)
		if fontsCached() {
			fontsOK.Store(true)
			return
		}
		fontsOK.Store(downloadFonts(25 * time.Second))
	})
}

func downloadFonts(budget time.Duration) bool {
	cl := &http.Client{Timeout: 8 * time.Second}
	q := "https://fonts.googleapis.com/css2?family=" + strings.Join(fontFamilies, "&family=") + "&display=swap"
	req, _ := http.NewRequest("GET", q, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
	res, err := cl.Do(req)
	if err != nil {
		return false
	}
	css, _ := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	res.Body.Close()
	if res.StatusCode != 200 || !bytes.Contains(css, []byte("@font-face")) {
		return false
	}
	// Nur lateinische Zeichensätze behalten (deutsch inkl. Umlaute)
	blocks := fontBlocks(css)
	var out bytes.Buffer
	deadline := time.Now().Add(budget * 4)
	dir := filepath.Join(cacheDir, "fonts")
	for _, b := range blocks {
		sub := string(b[1])
		if sub != "latin" && sub != "latin-ext" {
			continue
		}
		block := b[0]
		m := urlRe.FindSubmatch(block)
		if m == nil {
			continue
		}
		u := string(m[1])
		h := sha1.Sum([]byte(u))
		fn := hex.EncodeToString(h[:8]) + ".woff2"
		if _, err := os.Stat(filepath.Join(dir, fn)); err != nil {
			if time.Now().After(deadline) {
				return false
			}
			r2, err := cl.Get(u)
			if err != nil {
				return false
			}
			data, err := io.ReadAll(io.LimitReader(r2.Body, 4<<20))
			r2.Body.Close()
			if err != nil || r2.StatusCode != 200 {
				return false
			}
			os.WriteFile(filepath.Join(dir, fn), data, 0o644)
		}
		out.Write(bytes.Replace(block, m[1], []byte("/fonts/"+fn), 1))
		out.WriteString("\n")
	}
	if out.Len() == 0 {
		return false
	}
	return atomicWrite(filepath.Join(dir, "fonts.css"), out.Bytes()) == nil
}

func fallbackCSS() string {
	var b strings.Builder
	b.WriteString("/* Offline: Originalschriften noch nicht geladen, ähnliche Windows-Schriften */\n")
	for fam, locs := range fallbackFonts {
		var src []string
		for _, l := range strings.Split(locs, "|") {
			src = append(src, "local('"+l+"')")
		}
		fmt.Fprintf(&b, "@font-face{font-family:'%s';src:%s;font-weight:100 900;font-display:swap}\n", fam, strings.Join(src, ","))
	}
	return b.String()
}

func handleFontsCSS(w http.ResponseWriter, r *http.Request) {
	go prefetchFonts()
	select {
	case <-fontsDone:
	case <-time.After(6 * time.Second):
	}
	w.Header().Set("Content-Type", "text/css; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	if b, err := os.ReadFile(filepath.Join(cacheDir, "fonts", "fonts.css")); err == nil {
		w.Write(b)
		return
	}
	io.WriteString(w, fallbackCSS())
}

func handleFontFile(w http.ResponseWriter, r *http.Request) {
	fn := strings.TrimPrefix(r.URL.Path, "/fonts/")
	if !regexp.MustCompile(`^[0-9a-f]{16}\.woff2$`).MatchString(fn) {
		http.NotFound(w, r)
		return
	}
	b, err := os.ReadFile(filepath.Join(cacheDir, "fonts", fn))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "font/woff2")
	w.Header().Set("Cache-Control", "max-age=31536000, immutable")
	w.Write(b)
}

func fontBlocks(css []byte) [][][]byte {
	return regexp.MustCompile(`(?s)/\* ([a-z-]+) \*/\s*@font-face\s*\{.*?\}`).FindAllSubmatch(css, -1)
}
