//go:build !windows

package main

import (
	"fmt"
	"os"
	"path/filepath"
)

const (
	mbIconError = 0x10
	mbIconInfo  = 0x40
)

// Nur für Tests unter Linux: kein Fenster, kein Installer
func msgBox(title, text string, flags uint32) int { fmt.Println(title+":", text); return 0 }
func isInstalledCopy() bool                       { return false }
func openWindow(url string) bool                  { fmt.Println("Fenster:", url); return true }
func openWindowWait(url string) func()            { fmt.Println("Fenster:", url); return func() { select {} } }
func openDefaultBrowser(url string)               {}
func installer()                                  { fmt.Println("Installer gibt es nur unter Windows. --serve zum Testen.") }
func uninstall()                                  {}
func localAppData() string {
	if d := os.Getenv("WOK_LOCAL"); d != "" {
		return d
	}
	return filepath.Join(os.TempDir(), "wok-spiel-local")
}
func documentsDir() string {
	if d := os.Getenv("WOK_DOCS"); d != "" {
		return d
	}
	return filepath.Join(os.TempDir(), "wok-docs")
}
