// Sync-Ordner: Karten und Bilder in einem Ordner, den Google Drive, OneDrive oder Dropbox auf alle Geräte verteilt.
// Aufbau: <Ordner>\WoK_Sync\Karten\<id>.json und \Bilder\<sha1>.<endung>. Die Seite entscheidet je Karte, welche Fassung neuer ist.
package main

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

const syncRoot = "WoK_Sync"

var syncMu sync.Mutex

func syncCfgPath() string { return filepath.Join(dataDir, "Einstellungen", "sync-ordner.json") }
func syncDir() string {
	var c struct{ Dir string }
	if b, err := os.ReadFile(syncCfgPath()); err == nil {
		json.Unmarshal(b, &c)
	}
	return c.Dir
}

func handleSync(w http.ResponseWriter, r *http.Request, action string) {
	dir := syncDir()
	root := ""
	if dir != "" {
		root = filepath.Join(dir, syncRoot)
	}
	switch action {
	case "where":
		ok := false
		if dir != "" {
			if st, err := os.Stat(dir); err == nil && st.IsDir() {
				ok = true
			}
		}
		writeJSON(w, map[string]any{"dir": dir, "root": root, "ok": ok})
	case "pick":
		syncMu.Lock()
		defer syncMu.Unlock()
		nd := ""
		if r.URL.Query().Get("reset") == "" {
			d, err := pickFolder("Ordner für den Abgleich wählen (z. B. Google Drive → Meine Ablage)")
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(501)
				json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
				return
			}
			if d == "" {
				writeJSON(w, map[string]string{"dir": dir})
				return
			}
			nd = d
		}
		b, _ := json.Marshal(map[string]string{"Dir": nd})
		atomicWrite(syncCfgPath(), b)
		if nd != "" {
			os.MkdirAll(filepath.Join(nd, syncRoot, "Karten"), 0o755)
			os.MkdirAll(filepath.Join(nd, syncRoot, "Bilder"), 0o755)
		}
		writeJSON(w, map[string]string{"dir": nd})
	case "list":
		if root == "" {
			http.Error(w, "kein Sync-Ordner", 409)
			return
		}
		out := map[string][]map[string]any{"cards": {}, "images": {}}
		for _, sub := range []string{"Karten", "Bilder"} {
			ents, _ := os.ReadDir(filepath.Join(root, sub))
			for _, e := range ents {
				if e.IsDir() || strings.HasPrefix(e.Name(), ".") || strings.Contains(e.Name(), "(") { // Konfliktkopien von Drive ("… (1).json") überspringen
					continue
				}
				info, err := e.Info()
				if err != nil {
					continue
				}
				k := "cards"
				if sub == "Bilder" {
					k = "images"
				}
				out[k] = append(out[k], map[string]any{"name": e.Name(), "size": info.Size(), "mtime": info.ModTime().UnixMilli()})
			}
		}
		writeJSON(w, out)
	case "file":
		if root == "" {
			http.Error(w, "kein Sync-Ordner", 409)
			return
		}
		rel, ok := safeRel(r.URL.Query().Get("path"))
		if !ok || !(strings.HasPrefix(rel, "Karten"+string(filepath.Separator)) || strings.HasPrefix(rel, "Bilder"+string(filepath.Separator))) {
			http.Error(w, "bad path", 400)
			return
		}
		p := filepath.Join(root, rel)
		if r.Method == http.MethodPost {
			b, err := io.ReadAll(io.LimitReader(r.Body, 60<<20))
			if err != nil {
				http.Error(w, err.Error(), 400)
				return
			}
			if old, err := os.ReadFile(p); err == nil && string(old) == string(b) {
				w.WriteHeader(204)
				return
			}
			if err := atomicWrite(p, b); err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			w.WriteHeader(204)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		http.ServeFile(w, r, p)
	case "open":
		if root != "" {
			os.MkdirAll(root, 0o755)
			openFolder(root)
		}
		w.WriteHeader(204)
	default:
		http.NotFound(w, r)
	}
}
