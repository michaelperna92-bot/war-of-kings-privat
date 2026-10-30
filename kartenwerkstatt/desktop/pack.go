// Engine-Export der PC-Version: schreibt Kartenpakete in einen Ordner je Zielprogramm.
// Standard: Dokumente\War of Kings Kartenwerkstatt\Exporte\<Ziel>\WoK_Kartenwerkstatt\
// Optional ein eigener Ordner je Ziel (z. B. direkt im Unity-Projekt unter Assets\WoK\Kartenwerkstatt).
// Dateien werden mit festen Namen überschrieben, damit ein erneuter Export keine Duplikate erzeugt.
package main

import (
	"encoding/json"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
)

const (
	packRoot = "WoK_Kartenwerkstatt"
	kitRoot  = "WoK_AssetSet"
)

var (
	packMu     sync.Mutex
	targetName = map[string]string{"unity": "Unity", "godot": "Godot", "unreal": "Unreal", "gamemaker": "GameMaker", "web": "Web", "generic": "Allgemein"}
	segRe      = regexp.MustCompile(`^[A-Za-z0-9._ -]{1,120}$`)
)

func packRootsPath() string { return filepath.Join(dataDir, "Einstellungen", "export-ziele.json") }

func loadRoots() map[string]string {
	m := map[string]string{}
	if b, err := os.ReadFile(packRootsPath()); err == nil {
		json.Unmarshal(b, &m)
	}
	return m
}

func targetBase(t string) (dir string, custom bool) {
	if d := loadRoots()[t]; d != "" {
		return d, true
	}
	return filepath.Join(dataDir, "Exporte", targetName[t]), false
}

// relativer Pfad innerhalb des Pakets, nur einfache Namen, kein ".."
func safeRel(p string) (string, bool) {
	p = strings.ReplaceAll(p, "\\", "/")
	if p == "" || strings.HasPrefix(p, "/") {
		return "", false
	}
	parts := strings.Split(p, "/")
	for _, s := range parts {
		if s == "." || s == ".." || !segRe.MatchString(s) {
			return "", false
		}
	}
	return filepath.Join(parts...), true
}

func handlePack(w http.ResponseWriter, r *http.Request, action string) {
	t := r.URL.Query().Get("target")
	if _, ok := targetName[t]; !ok {
		http.Error(w, "unknown target", 400)
		return
	}
	base, custom := targetBase(t)
	root := filepath.Join(base, packRoot)
	if r.URL.Query().Get("pack") == "kit" { // Komplettes Asset-Set liegt neben dem Kartenpaket
		root = filepath.Join(base, kitRoot)
	}
	switch action {
	case "where":
		writeJSON(w, map[string]any{"target": t, "dir": base, "custom": custom, "pack": root, "kit": filepath.Join(base, kitRoot)})
	case "file":
		if r.Method != http.MethodPost {
			http.Error(w, "method", 405)
			return
		}
		rel, ok := safeRel(r.URL.Query().Get("path"))
		if !ok {
			http.Error(w, "bad path", 400)
			return
		}
		b, err := io.ReadAll(io.LimitReader(r.Body, 200<<20))
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		dst := filepath.Join(root, rel)
		// unveränderte Dateien nicht anfassen (Unity importiert sonst unnötig neu)
		if old, err := os.ReadFile(dst); err == nil && string(old) == string(b) {
			w.WriteHeader(204)
			return
		}
		if err := atomicWrite(dst, b); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		w.WriteHeader(204)
	case "clean":
		// entfernt Dateien des Pakets, die im aktuellen Gesamtexport nicht mehr vorkommen (nur im eigenen Paketordner)
		var keep []string
		if err := json.NewDecoder(io.LimitReader(r.Body, 10<<20)).Decode(&keep); err != nil {
			http.Error(w, "bad json", 400)
			return
		}
		ks := map[string]bool{}
		for _, k := range keep {
			if rel, ok := safeRel(k); ok {
				ks[filepath.Clean(rel)] = true
			}
		}
		removed := 0
		packMu.Lock()
		filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			rel, _ := filepath.Rel(root, p)
			if strings.HasSuffix(rel, ".meta") {
				if !ks[strings.TrimSuffix(rel, ".meta")] {
					if _, e := os.Stat(strings.TrimSuffix(p, ".meta")); e != nil { // Unity-.meta nur löschen, wenn die Datei weg ist
						os.Remove(p)
					}
				}
				return nil
			}
			if !ks[rel] {
				if os.Remove(p) == nil {
					removed++
					os.Remove(p + ".meta")
				}
			}
			return nil
		})
		packMu.Unlock()
		writeJSON(w, map[string]int{"removed": removed})
	case "open":
		os.MkdirAll(root, 0o755)
		openFolder(root)
		w.WriteHeader(204)
	case "pick":
		packMu.Lock()
		defer packMu.Unlock()
		m := loadRoots()
		if r.URL.Query().Get("reset") != "" {
			delete(m, t)
		} else {
			dir, err := pickFolder("Zielordner für den " + targetName[t] + "-Export wählen (z. B. Assets\\WoK\\Kartenwerkstatt in deinem Unity-Projekt)")
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(501)
				json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
				return
			}
			if dir == "" {
				writeJSON(w, map[string]string{"dir": ""})
				return
			}
			m[t] = dir
		}
		b, _ := json.MarshalIndent(m, "", "  ")
		atomicWrite(packRootsPath(), b)
		writeJSON(w, map[string]string{"dir": m[t]})
	default:
		http.NotFound(w, r)
	}
}
