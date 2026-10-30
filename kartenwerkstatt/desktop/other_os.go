//go:build !windows

package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

const (
	mbIconError = 0x10
	mbIconInfo  = 0x40
)

// Nur für Tests unter Linux: Ordner im Arbeitsverzeichnis, kein Fenster
func documentsDir() string {
	if d := os.Getenv("WOK_DOCS"); d != "" {
		return d
	}
	return filepath.Join(os.TempDir(), "wok-docs")
}
func localAppData() string {
	if d := os.Getenv("WOK_LOCAL"); d != "" {
		return d
	}
	return filepath.Join(os.TempDir(), "wok-local")
}
func msgBox(title, text string, flags uint32) int { fmt.Println(title+":", text); return 0 }
func isInstalledCopy() bool                       { return false }
func openWindow(url string) bool                  { fmt.Println("Fenster:", url); return true }
func openDefaultBrowser(url string)               {}
func openFolder(p string)                         { fmt.Println("Ordner:", p) }
func installer()                                  { fmt.Println("Installer gibt es nur unter Windows. --serve zum Testen.") }
func uninstall()                                  {}

func openWindowWait(url string) func() { fmt.Println("Fenster:", url); return func() { select {} } }

func pickFolder(title string) (string, error) {
	if d := os.Getenv("WOK_PICK"); d != "" { // nur für Tests
		return d, nil
	}
	return "", errors.New("Ordnerauswahl gibt es nur unter Windows")
}
