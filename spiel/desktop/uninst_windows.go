//go:build windows

package main

// Deinstallieren (4.11.2026): Programm, Verknüpfungen, Startmenü, Windows-„Apps“-Eintrag und Browser-Profil entfernen.
// Auf Wunsch zusätzlich ALLE eigenen Daten (doppelte Rückfrage, nicht rückgängig zu machen).
// Gemeinsamer Ordner „War of Kings Spielpakete“ wird nur gelöscht, wenn das andere Programm nicht mehr installiert ist.

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const (
	mbIconWarn   = 0x30
	mbDefButton2 = 0x100
	idCancelBox  = 2
)

// Startmenü-Ordner „War of Kings“ mit Programm und „… deinstallieren“
func startMenuDir() string {
	if pd := programsDir(); pd != "" {
		return filepath.Join(pd, "War of Kings")
	}
	return ""
}

func installShortcuts(icon string) {
	makeShortcut(filepath.Join(desktopDir(), appName+".lnk"), installedExe(), icon, "")
	if pd := programsDir(); pd != "" {
		os.Remove(filepath.Join(pd, appName+".lnk")) // alte, flache Verknüpfung (bis 4.11.2026)
		sm := startMenuDir()
		os.MkdirAll(sm, 0o755)
		makeShortcut(filepath.Join(sm, appName+".lnk"), installedExe(), icon, "")
		makeShortcut(filepath.Join(sm, appName+" deinstallieren.lnk"), installedExe(), icon, "--uninstall")
	}
}

func removeShortcuts() {
	os.Remove(filepath.Join(desktopDir(), appName+".lnk"))
	if pd := programsDir(); pd != "" {
		os.Remove(filepath.Join(pd, appName+".lnk"))
		sm := startMenuDir()
		os.Remove(filepath.Join(sm, appName+".lnk"))
		os.Remove(filepath.Join(sm, appName+" deinstallieren.lnk"))
		os.Remove(sm) // nur wenn leer (das andere Programm kann dort noch liegen)
	}
}

func uninstall() {
	data := userDataDirs()
	list := ""
	for _, d := range data {
		list += "\n• " + d
	}
	if msgBox(appName, appName+" deinstallieren?\n\nEntfernt werden: Programm, Desktop- und Startmenü-Verknüpfungen, der Eintrag unter Windows-Einstellungen → Apps und die Zwischenspeicher."+otherNote, mbYesNo|mbIconQuest) != idYes {
		return
	}
	wipe := false
	r := msgBox(appName, "Sollen auch deine eigenen Daten gelöscht werden?"+list+"\n\nJa = ALLES löschen (Karten, Bilder, Decks, Exporte) – das Programm ist danach restlos vom PC.\nNein = Daten behalten (z. B. für eine spätere Neuinstallation).\nAbbrechen = gar nichts deinstallieren.", mbYesNoCancel|mbIconWarn|mbDefButton2)
	if r == idCancelBox || (r != idYes && r != idNo) {
		return
	}
	if r == idYes {
		if msgBox(appName, "Wirklich endgültig löschen?\n\nDiese Ordner werden mit allem Inhalt gelöscht und lassen sich nicht wiederherstellen:"+list+"\n\nTipp: Vorher eine Sicherung exportieren, falls du die Karten noch brauchst.", mbYesNo|mbIconWarn|mbDefButton2) != idYes {
			return
		}
		wipe = true
	}
	quitRunning()
	removeShortcuts()
	hidden(exec.Command("reg", "delete", uninstKey, "/f")).Run()
	os.RemoveAll(appCacheDir())
	failed := []string{}
	if wipe {
		for _, d := range data {
			if err := os.RemoveAll(d); err != nil {
				failed = append(failed, d)
			}
		}
		if !otherInstalled() {
			os.RemoveAll(filepath.Join(documentsDir(), "War of Kings Spielpakete"))
		}
	}
	// Die laufende .exe kann sich nicht selbst löschen: kurz warten, dann Programmordner entfernen
	hidden(exec.Command("cmd", "/c", "ping 127.0.0.1 -n 3 >nul & rmdir /s /q \""+installDir()+"\"")).Start()
	msg := appName + " wurde vom PC entfernt."
	if wipe && len(failed) == 0 {
		msg += "\nAuch alle eigenen Daten wurden gelöscht."
	} else if wipe {
		msg += "\n\nEinige Ordner konnten nicht gelöscht werden (vielleicht noch geöffnet):\n• " + strings.Join(failed, "\n• ") + "\nBitte von Hand löschen."
	} else if len(data) > 0 {
		msg += "\nDeine Daten liegen weiter in:" + list
	}
	msgBox(appName, msg, mbOK|mbIconInfo)
}

const otherNote = "\n\nDie Kartenwerkstatt bleibt unberührt."

func userDataDirs() []string {
	return []string{filepath.Join(documentsDir(), "War of Kings Probe-Spiel")}
}
func appCacheDir() string { return filepath.Join(localAppData(), "WoK Probe-Spiel") }
func otherInstalled() bool {
	_, err := os.Stat(filepath.Join(localAppData(), "Programs", "WoK Kartenwerkstatt", "Kartenwerkstatt.exe"))
	return err == nil
}
