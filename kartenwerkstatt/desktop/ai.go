// KI-Brücke der Windows-Version: Namensfindung und Motiverkennung über einen frei wählbaren Anbieter.
// Ollama läuft lokal und kostenlos; Gemini hat ein kostenloses Kontingent; OpenAI (ChatGPT-API) und
// die Claude-API rechnen pro Anfrage ab. API-Schlüssel liegen nur in %LOCALAPPDATA% auf diesem PC
// und werden nie an die Oberfläche zurückgegeben.
package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type aiConfig struct {
	Provider  string            `json:"provider"` // aus | ollama | gemini | openai | anthropic
	Models    map[string]string `json:"models"`
	Keys      map[string]string `json:"keys"`
	OllamaURL string            `json:"ollamaURL"`
}

var (
	aiMu       sync.Mutex
	aiResolved = map[string]string{} // automatisch gewähltes Modell je Anbieter
)

func aiPath() string { return filepath.Join(cacheDir, "ki-verbindung.json") }

func loadAI() aiConfig {
	c := aiConfig{Provider: "aus", Models: map[string]string{}, Keys: map[string]string{}, OllamaURL: "http://127.0.0.1:11434"}
	if b, err := os.ReadFile(aiPath()); err == nil {
		json.Unmarshal(b, &c)
	}
	if c.Models == nil {
		c.Models = map[string]string{}
	}
	if c.Keys == nil {
		c.Keys = map[string]string{}
	}
	if c.OllamaURL == "" {
		c.OllamaURL = "http://127.0.0.1:11434"
	}
	return c
}

func saveAI(c aiConfig) error {
	b, _ := json.MarshalIndent(c, "", "  ")
	return atomicWrite(aiPath(), b)
}

type aiErr struct {
	Status  int
	Code    string
	Message string
}

func (e *aiErr) Error() string { return e.Code + ": " + e.Message }

func aiFail(w http.ResponseWriter, e error) {
	var ae *aiErr
	if !errors.As(e, &ae) {
		ae = &aiErr{502, "error", e.Error()}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(ae.Status)
	json.NewEncoder(w).Encode(map[string]string{"code": ae.Code, "message": ae.Message})
}

func handleAI(w http.ResponseWriter, r *http.Request, sub string) {
	aiMu.Lock()
	cfg := loadAI()
	aiMu.Unlock()
	switch sub {
	case "config":
		if r.Method == http.MethodGet {
			has := map[string]bool{}
			for _, p := range []string{"gemini", "openai", "anthropic"} {
				has[p] = cfg.Keys[p] != ""
			}
			writeJSON(w, map[string]any{"provider": cfg.Provider, "models": cfg.Models, "ollamaURL": cfg.OllamaURL, "hasKey": has})
			return
		}
		if r.Method != http.MethodPut {
			http.Error(w, "method", 405)
			return
		}
		var in struct {
			Provider  string            `json:"provider"`
			Models    map[string]string `json:"models"`
			Key       string            `json:"key"`
			ClearKey  bool              `json:"clearKey"`
			OllamaURL string            `json:"ollamaURL"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&in); err != nil {
			http.Error(w, "bad json", 400)
			return
		}
		switch in.Provider {
		case "aus", "ollama", "gemini", "openai", "anthropic":
		default:
			http.Error(w, "provider", 400)
			return
		}
		aiMu.Lock()
		defer aiMu.Unlock()
		cfg = loadAI()
		cfg.Provider = in.Provider
		for k, v := range in.Models {
			cfg.Models[k] = strings.TrimSpace(v)
			delete(aiResolved, k)
		}
		if k := strings.TrimSpace(in.Key); k != "" {
			cfg.Keys[in.Provider] = k
		}
		if in.ClearKey {
			delete(cfg.Keys, in.Provider)
		}
		if u := strings.TrimSpace(in.OllamaURL); u != "" {
			if !strings.HasPrefix(u, "http://127.0.0.1") && !strings.HasPrefix(u, "http://localhost") {
				http.Error(w, "Ollama nur auf diesem PC (127.0.0.1)", 400)
				return
			}
			cfg.OllamaURL = strings.TrimRight(u, "/")
		}
		if err := saveAI(cfg); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		w.WriteHeader(204)
	case "models":
		var in struct {
			Provider string `json:"provider"`
		}
		json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&in)
		p := in.Provider
		if p == "" {
			p = cfg.Provider
		}
		list, err := listModels(cfg, p)
		if err != nil {
			aiFail(w, err)
			return
		}
		writeJSON(w, map[string]any{"models": list, "suggested": pickModel(p, list)})
	case "ask":
		if r.Method != http.MethodPost {
			http.Error(w, "method", 405)
			return
		}
		var in struct {
			Prompt string `json:"prompt"`
			Images []struct {
				Mime string `json:"mime"`
				Data string `json:"data"`
			} `json:"images"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 60<<20)).Decode(&in); err != nil || in.Prompt == "" {
			http.Error(w, "bad json", 400)
			return
		}
		imgs := make([]aiImage, 0, len(in.Images))
		for _, im := range in.Images {
			if im.Mime == "" {
				im.Mime = "image/jpeg"
			}
			imgs = append(imgs, aiImage{im.Mime, im.Data})
		}
		text, model, err := ask(cfg, in.Prompt, imgs)
		if err != nil {
			aiFail(w, err)
			return
		}
		writeJSON(w, map[string]string{"text": text, "model": model, "provider": cfg.Provider})
	default:
		http.NotFound(w, r)
	}
}

type aiImage struct{ Mime, Data string }

func httpJSON(method, url string, hdr map[string]string, body any, timeout time.Duration, out any) error {
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, url, rd)
	if err != nil {
		return &aiErr{400, "error", err.Error()}
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	res, err := (&http.Client{Timeout: timeout}).Do(req)
	if err != nil {
		var ne net.Error
		if errors.As(err, &ne) && ne.Timeout() {
			return &aiErr{504, "timeout", "Die KI hat zu lange gebraucht."}
		}
		return &aiErr{503, "offline", "Keine Verbindung: " + err.Error()}
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(res.Body, 8<<20))
	if res.StatusCode >= 300 {
		msg := string(b)
		var e struct {
			Error any `json:"error"`
		}
		if json.Unmarshal(b, &e) == nil && e.Error != nil {
			if m, ok := e.Error.(map[string]any); ok && m["message"] != nil {
				msg = fmt.Sprint(m["message"])
			} else {
				msg = fmt.Sprint(e.Error)
			}
		}
		if len(msg) > 300 {
			msg = msg[:300]
		}
		code := "error"
		switch res.StatusCode {
		case 401, 403:
			code = "auth"
		case 429:
			code = "rate_limited"
		case 404:
			code = "no_model"
		}
		return &aiErr{502, code, msg}
	}
	if out != nil {
		if err := json.Unmarshal(b, out); err != nil {
			return &aiErr{502, "bad_answer", "Unerwartete Antwort"}
		}
	}
	return nil
}

func needKey(cfg aiConfig, p string) (string, error) {
	k := cfg.Keys[p]
	if k == "" {
		return "", &aiErr{400, "no_key", "Für diesen Anbieter ist noch kein API-Schlüssel eingetragen."}
	}
	return k, nil
}

func listModels(cfg aiConfig, p string) ([]string, error) {
	var out []string
	switch p {
	case "ollama":
		var r struct {
			Models []struct {
				Name string `json:"name"`
			} `json:"models"`
		}
		if err := httpJSON("GET", cfg.OllamaURL+"/api/tags", nil, nil, 5*time.Second, &r); err != nil {
			var ae *aiErr
			if errors.As(err, &ae) && ae.Code == "offline" {
				ae.Message = "Ollama läuft nicht auf diesem PC (ollama.com installieren und starten)."
			}
			return nil, err
		}
		for _, m := range r.Models {
			out = append(out, m.Name)
		}
	case "gemini":
		k, err := needKey(cfg, p)
		if err != nil {
			return nil, err
		}
		var r struct {
			Models []struct {
				Name    string   `json:"name"`
				Methods []string `json:"supportedGenerationMethods"`
			} `json:"models"`
		}
		if err := httpJSON("GET", "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", map[string]string{"x-goog-api-key": k}, nil, 15*time.Second, &r); err != nil {
			return nil, err
		}
		for _, m := range r.Models {
			for _, g := range m.Methods {
				if g == "generateContent" {
					out = append(out, strings.TrimPrefix(m.Name, "models/"))
					break
				}
			}
		}
	case "openai":
		k, err := needKey(cfg, p)
		if err != nil {
			return nil, err
		}
		var r struct {
			Data []struct {
				ID string `json:"id"`
			} `json:"data"`
		}
		if err := httpJSON("GET", "https://api.openai.com/v1/models", map[string]string{"Authorization": "Bearer " + k}, nil, 15*time.Second, &r); err != nil {
			return nil, err
		}
		for _, m := range r.Data {
			if strings.HasPrefix(m.ID, "gpt-") && !strings.Contains(m.ID, "audio") && !strings.Contains(m.ID, "realtime") && !strings.Contains(m.ID, "image") && !strings.Contains(m.ID, "tts") && !strings.Contains(m.ID, "transcribe") && !strings.Contains(m.ID, "search") {
				out = append(out, m.ID)
			}
		}
	case "anthropic":
		k, err := needKey(cfg, p)
		if err != nil {
			return nil, err
		}
		var r struct {
			Data []struct {
				ID string `json:"id"`
			} `json:"data"`
		}
		if err := httpJSON("GET", "https://api.anthropic.com/v1/models?limit=100", map[string]string{"x-api-key": k, "anthropic-version": "2023-06-01"}, nil, 15*time.Second, &r); err != nil {
			return nil, err
		}
		for _, m := range r.Data {
			out = append(out, m.ID)
		}
	default:
		return nil, &aiErr{400, "no_provider", "Keine KI-Verbindung gewählt."}
	}
	sort.Strings(out)
	return out, nil
}

// Günstiges Bildmodell bevorzugen
func pickModel(p string, list []string) string {
	has := func(s string) bool {
		for _, m := range list {
			if m == s {
				return true
			}
		}
		return false
	}
	find := func(subs ...string) string {
		for _, s := range subs {
			for _, m := range list {
				if strings.Contains(m, s) {
					return m
				}
			}
		}
		return ""
	}
	switch p {
	case "ollama":
		return find("gemma3", "qwen3-vl", "qwen2.5vl", "llama3.2-vision", "minicpm-v", "llava", "mistral-small3", "granite3.2-vision", "moondream")
	case "gemini":
		if has("gemini-flash-latest") {
			return "gemini-flash-latest"
		}
		for _, m := range list {
			if strings.Contains(m, "flash") && !strings.Contains(m, "image") && !strings.Contains(m, "tts") && !strings.Contains(m, "live") && !strings.Contains(m, "exp") {
				return m
			}
		}
	case "openai":
		for _, s := range []string{"gpt-5-mini", "gpt-5.1-mini", "gpt-4.1-mini", "gpt-4o-mini"} {
			if has(s) {
				return s
			}
		}
		return find("mini")
	case "anthropic":
		if has("claude-haiku-5-5") {
			return "claude-haiku-5-5"
		}
		return find("haiku")
	}
	if len(list) > 0 {
		return list[0]
	}
	return ""
}

func modelFor(cfg aiConfig, p string) (string, error) {
	if m := cfg.Models[p]; m != "" {
		return m, nil
	}
	aiMu.Lock()
	m := aiResolved[p]
	aiMu.Unlock()
	if m != "" {
		return m, nil
	}
	list, err := listModels(cfg, p)
	if err != nil {
		return "", err
	}
	m = pickModel(p, list)
	if m == "" {
		if p == "ollama" {
			return "", &aiErr{400, "no_model", "In Ollama ist kein Bildmodell installiert. Zum Beispiel: ollama pull gemma3"}
		}
		return "", &aiErr{400, "no_model", "Kein passendes Modell gefunden. Bitte in der KI-Verbindung eines eintragen."}
	}
	aiMu.Lock()
	aiResolved[p] = m
	aiMu.Unlock()
	return m, nil
}

func ask(cfg aiConfig, prompt string, imgs []aiImage) (string, string, error) {
	p := cfg.Provider
	if p == "" || p == "aus" {
		return "", "", &aiErr{400, "no_provider", "Keine KI-Verbindung gewählt."}
	}
	model, err := modelFor(cfg, p)
	if err != nil {
		return "", "", err
	}
	switch p {
	case "ollama":
		b64 := []string{}
		for _, im := range imgs {
			b64 = append(b64, im.Data)
		}
		var r struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		}
		body := map[string]any{"model": model, "stream": false, "format": "json",
			"messages": []any{map[string]any{"role": "user", "content": prompt, "images": b64}}}
		if err := httpJSON("POST", cfg.OllamaURL+"/api/chat", nil, body, 5*time.Minute, &r); err != nil {
			return "", model, err
		}
		return r.Message.Content, model, nil
	case "gemini":
		k, err := needKey(cfg, p)
		if err != nil {
			return "", model, err
		}
		parts := []any{map[string]any{"text": prompt}}
		for _, im := range imgs {
			parts = append(parts, map[string]any{"inline_data": map[string]string{"mime_type": im.Mime, "data": im.Data}})
		}
		var r struct {
			Candidates []struct {
				Content struct {
					Parts []struct {
						Text string `json:"text"`
					} `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
		}
		body := map[string]any{"contents": []any{map[string]any{"role": "user", "parts": parts}},
			"generationConfig": map[string]any{"responseMimeType": "application/json"}}
		if err := httpJSON("POST", "https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent", map[string]string{"x-goog-api-key": k}, body, 2*time.Minute, &r); err != nil {
			return "", model, err
		}
		var sb strings.Builder
		for _, c := range r.Candidates {
			for _, pt := range c.Content.Parts {
				sb.WriteString(pt.Text)
			}
			break
		}
		return sb.String(), model, nil
	case "openai":
		k, err := needKey(cfg, p)
		if err != nil {
			return "", model, err
		}
		content := []any{map[string]any{"type": "text", "text": prompt}}
		for _, im := range imgs {
			content = append(content, map[string]any{"type": "image_url", "image_url": map[string]string{"url": "data:" + im.Mime + ";base64," + im.Data, "detail": "low"}})
		}
		var r struct {
			Choices []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
		}
		body := map[string]any{"model": model, "messages": []any{map[string]any{"role": "user", "content": content}},
			"response_format": map[string]string{"type": "json_object"}}
		if err := httpJSON("POST", "https://api.openai.com/v1/chat/completions", map[string]string{"Authorization": "Bearer " + k}, body, 2*time.Minute, &r); err != nil {
			return "", model, err
		}
		if len(r.Choices) == 0 {
			return "", model, &aiErr{502, "bad_answer", "Leere Antwort"}
		}
		return r.Choices[0].Message.Content, model, nil
	case "anthropic":
		k, err := needKey(cfg, p)
		if err != nil {
			return "", model, err
		}
		content := []any{}
		for _, im := range imgs {
			content = append(content, map[string]any{"type": "image", "source": map[string]string{"type": "base64", "media_type": im.Mime, "data": im.Data}})
		}
		content = append(content, map[string]any{"type": "text", "text": prompt})
		var r struct {
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		}
		body := map[string]any{"model": model, "max_tokens": 1500, "messages": []any{map[string]any{"role": "user", "content": content}}}
		if err := httpJSON("POST", "https://api.anthropic.com/v1/messages", map[string]string{"x-api-key": k, "anthropic-version": "2023-06-01"}, body, 2*time.Minute, &r); err != nil {
			return "", model, err
		}
		var sb strings.Builder
		for _, c := range r.Content {
			if c.Type == "text" {
				sb.WriteString(c.Text)
			}
		}
		return sb.String(), model, nil
	}
	return "", "", &aiErr{400, "no_provider", "Unbekannter Anbieter"}
}
