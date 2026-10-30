// War of Kings – Probe-Spiel, Windows-Version.
// Eine einzige .exe: installiert sich ohne Adminrechte, startet das Spiel offline in einem eigenen
// App-Fenster (Edge/Chrome im App-Modus) und kann sich wieder deinstallieren. Getrennt von der Kartenwerkstatt.
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
	appName    = "War of Kings Probe-Spiel"
	appVersion = "4.0"
	appID      = "wok-probespiel"
	basePort   = 47851
)

//go:embed app
var appFS embed.FS

//go:embed fonts.txt
var fontsTxt string

var (
	lastPing     atomic.Int64
	byeAt        atomic.Int64
	quitCh       = make(chan struct{}, 1)
	cacheDir     string
	fontsOnce    sync.Once
	fontsDone    = make(chan struct{})
	fontsOK      atomic.Bool
	fontFamilies = strings.Fields(fontsTxt)
)

func main() {
	has := func(f string) bool {
		for _, a := range os.Args[1:] {
			if strings.EqualFold(a, f) {
				return true
			}
		}
		return false
	}
	switch {
	case has("--uninstall"):
		uninstall()
	case has("--serve"):
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

func runApp() {
	setupDirs()
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
		msgBox(appName, "Das Spiel konnte keinen lokalen Anschluss öffnen (Ports 47851–47860 belegt).", mbIconError)
		return
	}
	go prefetchFonts()
	lastPing.Store(time.Now().UnixMilli())
	started := time.Now()
	if wait := openWindowWait(fmt.Sprintf("http://127.0.0.1:%d/", port)); wait != nil {
		go func() {
			wait()
			if time.Since(started) < 8*time.Second {
				return
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
		msgBox(appName, "Weder Microsoft Edge noch Google Chrome wurde gefunden.\nDas Spiel öffnet sich deshalb im Standardbrowser.", mbIconInfo)
		openDefaultBrowser(fmt.Sprintf("http://127.0.0.1:%d/", port))
	}
	serve(ln, true)
}

func listen() (int, net.Listener) {
	for p := basePort; p < basePort+10; p++ {
		if ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p)); err == nil {
			return p, ln
		}
	}
	return 0, nil
}

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
func isOurs(port int) bool { return ourVersion(port) != "" }

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
		bye := byeAt.Load()
		if bye > 0 && now-bye > 6000 && lastPing.Load() < bye {
			srv.Close()
			return
		}
		if time.Since(start) > 3*time.Minute && now-lastPing.Load() > 150000 {
			srv.Close()
			return
		}
	}
}

func serve(ln net.Listener, autoQuit bool) {
	mux := http.NewServeMux()
	sub, _ := fs.Sub(appFS, "app")
	types := map[string]string{"index.html": "text/html; charset=utf-8", "icon.png": "image/png", "icon.ico": "image/x-icon"}
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(r.URL.Path, "/")
		if p == "" {
			p = "index.html"
		}
		ct, ok := types[p]
		if strings.HasPrefix(p, "basar/") && strings.HasSuffix(p, ".mp4") && !strings.Contains(p, "..") {
			b, err := fs.ReadFile(sub, p)
			if err != nil {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "video/mp4")
			http.ServeContent(w, r, p, time.Time{}, bytes.NewReader(b))
			return
		}
		if strings.HasPrefix(p, "musik/") && strings.HasSuffix(p, ".mp3") && !strings.Contains(p, "..") {
			b, err := fs.ReadFile(sub, p)
			if err != nil {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "audio/mpeg")
			http.ServeContent(w, r, p, time.Time{}, bytes.NewReader(b)) // mit Range, damit Spulen und Loop sauber gehen
			return
		}
		if !ok {
			http.NotFound(w, r)
			return
		}
		b, err := fs.ReadFile(sub, p)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", ct)
		w.Header().Set("Cache-Control", "no-cache")
		w.Write(b)
	})
	mux.HandleFunc("/fonts.css", handleFontsCSS)
	mux.HandleFunc("/fonts/", handleFontFile)
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		if p := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/"), "/"); strings.HasPrefix(p, "ai/") {
			sub := strings.TrimPrefix(p, "ai/")
			if sub == "config" && r.Method != http.MethodGet {
				http.Error(w, "KI-Verbindung bitte in der Kartenwerkstatt einstellen", 405)
				return
			}
			handleAI(w, r, sub)
			return
		}
		switch strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/"), "/") {
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
		case "inbox":
			writeJSON(w, inboxList())
		case "inbox/file":
			name := filepath.Base(r.URL.Query().Get("name"))
			if !strings.HasSuffix(strings.ToLower(name), ".wokspiel") {
				http.Error(w, "bad name", 400)
				return
			}
			b, err := os.ReadFile(filepath.Join(packDir(), name))
			if err != nil {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "application/zip")
			w.Write(b)
		case "store/state":
			p := filepath.Join(storeDir(), "sammlung.json")
			if r.Method == http.MethodGet {
				b, err := os.ReadFile(p)
				if err != nil {
					http.NotFound(w, r)
					return
				}
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.Header().Set("Cache-Control", "no-store")
				w.Write(b)
				return
			}
			if r.Method != http.MethodPost {
				http.Error(w, "method", 405)
				return
			}
			b, err := io.ReadAll(io.LimitReader(r.Body, 200<<20))
			if err != nil || len(b) < 2 || b[0] != '{' {
				http.Error(w, "bad body", 400)
				return
			}
			os.MkdirAll(storeDir(), 0o755)
			if err := atomicWrite(p, b); err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			w.WriteHeader(204)
		case "store/img", "store/imgdel":
			name := r.URL.Query().Get("name")
			if !imgName.MatchString(name) {
				http.Error(w, "bad name", 400)
				return
			}
			p := filepath.Join(storeDir(), "bilder", name)
			switch {
			case r.Method == http.MethodGet:
				b, err := os.ReadFile(p)
				if err != nil {
					http.NotFound(w, r)
					return
				}
				w.Header().Set("Content-Type", map[string]string{".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png"}[strings.ToLower(filepath.Ext(name))])
				w.Header().Set("Cache-Control", "max-age=31536000, immutable")
				w.Write(b)
			case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "imgdel"):
				os.Remove(p)
				w.WriteHeader(204)
			case r.Method == http.MethodPost:
				b, err := io.ReadAll(io.LimitReader(r.Body, 50<<20))
				if err != nil {
					http.Error(w, err.Error(), 400)
					return
				}
				os.MkdirAll(filepath.Dir(p), 0o755)
				if err := atomicWrite(p, b); err != nil {
					http.Error(w, err.Error(), 500)
					return
				}
				w.WriteHeader(204)
			default:
				http.Error(w, "method", 405)
			}
		case "save":
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
			os.MkdirAll(packDir(), 0o755)
			p := filepath.Join(packDir(), name)
			if err := atomicWrite(p, b); err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			st, _ := os.Stat(p)
			writeJSON(w, map[string]any{"name": filepath.Base(p), "mtime": st.ModTime().UnixMilli()})
		default:
			http.NotFound(w, r)
		}
	})
	srv := &http.Server{Handler: localOnly(mux), ReadHeaderTimeout: 10 * time.Second}
	if autoQuit {
		go watchdog(srv)
	}
	if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
		fmt.Println(err)
	}
}

// Nur Anfragen dieses PCs annehmen (Schutz vor fremden Webseiten).
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

func setupDirs() {
	cacheDir = filepath.Join(localAppData(), "WoK Probe-Spiel")
	os.MkdirAll(filepath.Join(cacheDir, "fonts"), 0o755)
}

// ---------- Schriften: einmal mit Internet laden, danach offline (wie in der Kartenwerkstatt) ----------

var fallbackFonts = map[string]string{
	"Cinzel": "Trajan Pro|Constantia|Palatino Linotype", "Cinzel Decorative": "Trajan Pro|Constantia|Palatino Linotype",
	"Cormorant Garamond": "Garamond|Palatino Linotype", "Cormorant SC": "Garamond|Palatino Linotype",
	"EB Garamond": "Garamond|Book Antiqua|Palatino Linotype", "Marcellus": "Constantia|Palatino Linotype", "Marcellus SC": "Constantia|Palatino Linotype",
	"Spectral": "Cambria|Georgia", "Spectral SC": "Cambria|Georgia", "IM Fell English": "Palatino Linotype|Georgia", "IM Fell English SC": "Palatino Linotype|Georgia",
	"Alegreya": "Book Antiqua|Palatino Linotype", "Alegreya SC": "Book Antiqua|Palatino Linotype", "Playfair Display SC": "Bodoni MT|Georgia",
	"Almendra SC": "Constantia|Georgia", "Grenze Gotisch": "Old English Text MT|Constantia", "UnifrakturMaguntia": "Old English Text MT|Constantia",
	"Pirata One": "Old English Text MT|Constantia", "Uncial Antiqua": "Gabriola|Constantia", "Forum": "Constantia|Georgia", "Alegreya Sans": "Segoe UI|Arial", "Barlow Semi Condensed": "Bahnschrift SemiCondensed|Arial Narrow",
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

func atomicWrite(p string, b []byte) error {
	os.MkdirAll(filepath.Dir(p), 0o755) // Ordner neu anlegen, falls er im Betrieb gelöscht wurde
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, p)
}

// ---------- Spielpakete aus der Kartenwerkstatt (Dokumente\War of Kings Spielpakete) ----------

func packDir() string { return filepath.Join(documentsDir(), "War of Kings Spielpakete") }

func inboxList() []map[string]any {
	out := []map[string]any{}
	es, err := os.ReadDir(packDir())
	if err != nil {
		return out
	}
	for _, e := range es {
		if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".wokspiel") {
			continue
		}
		if i, err := e.Info(); err == nil {
			out = append(out, map[string]any{"name": e.Name(), "size": i.Size(), "mtime": i.ModTime().UnixMilli()})
		}
	}
	return out
}

var badChars = regexp.MustCompile(`[<>:"/\\|?*\x00-\x1f]+`)

func safeName(n string) string {
	n = strings.TrimSpace(badChars.ReplaceAllString(n, "_"))
	n = strings.Trim(n, ". ")
	if n == "" {
		n = "Spielpaket"
	}
	if len(n) > 120 {
		n = n[:120]
	}
	return n
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(v)
}

// ---------- Kartensammlung und Decks dauerhaft auf dem PC (Dokumente\War of Kings Probe-Spiel) ----------

var imgName = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,160}\.(webp|jpg|png)$`)

func storeDir() string { return filepath.Join(documentsDir(), "War of Kings Probe-Spiel") }
