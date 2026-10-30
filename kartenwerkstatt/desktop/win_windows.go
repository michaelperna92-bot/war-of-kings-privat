//go:build windows

package main

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

const (
	mbOK          = 0x0
	mbYesNoCancel = 0x3
	mbYesNo       = 0x4
	mbIconError   = 0x10
	mbIconQuest   = 0x20
	mbIconInfo    = 0x40
	idYes         = 6
	idNo          = 7
)

var (
	user32  = syscall.NewLazyDLL("user32.dll")
	shell32 = syscall.NewLazyDLL("shell32.dll")
	pMsgBox = user32.NewProc("MessageBoxW")
	pFolder = shell32.NewProc("SHGetFolderPathW")
)

func msgBox(title, text string, flags uint32) int {
	t, _ := syscall.UTF16PtrFromString(text)
	c, _ := syscall.UTF16PtrFromString(title)
	r, _, _ := pMsgBox.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(c)), uintptr(flags|0x10000))
	return int(r)
}

func shellFolder(csidl int, fallback string) string {
	buf := make([]uint16, 520)
	r, _, _ := pFolder.Call(0, uintptr(csidl), 0, 0, uintptr(unsafe.Pointer(&buf[0])))
	if r == 0 {
		if p := syscall.UTF16ToString(buf); p != "" {
			return p
		}
	}
	return fallback
}

func documentsDir() string {
	return shellFolder(0x05, filepath.Join(os.Getenv("USERPROFILE"), "Documents"))
}
func localAppData() string { return shellFolder(0x1c, os.Getenv("LOCALAPPDATA")) }
func desktopDir() string {
	return shellFolder(0x10, filepath.Join(os.Getenv("USERPROFILE"), "Desktop"))
}
func programsDir() string  { return shellFolder(0x02, "") }
func installDir() string   { return filepath.Join(localAppData(), "Programs", "WoK Kartenwerkstatt") }
func installedExe() string { return filepath.Join(installDir(), "Kartenwerkstatt.exe") }

func hidden(cmd *exec.Cmd) *exec.Cmd {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	return cmd
}

func isInstalledCopy() bool {
	exe, err := os.Executable()
	if err != nil {
		return false
	}
	return strings.EqualFold(filepath.Clean(filepath.Dir(exe)), filepath.Clean(installDir()))
}

func findBrowser() string {
	var c []string
	for _, base := range []string{os.Getenv("ProgramFiles(x86)"), os.Getenv("ProgramFiles"), os.Getenv("LOCALAPPDATA")} {
		if base != "" {
			c = append(c, filepath.Join(base, "Microsoft", "Edge", "Application", "msedge.exe"))
		}
	}
	for _, base := range []string{os.Getenv("ProgramFiles"), os.Getenv("ProgramFiles(x86)"), os.Getenv("LOCALAPPDATA")} {
		if base != "" {
			c = append(c, filepath.Join(base, "Google", "Chrome", "Application", "chrome.exe"))
		}
	}
	for _, p := range c {
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p
		}
	}
	return ""
}

func openWindow(url string) bool { return openWindowWait(url) != nil }

func openWindowWait(url string) func() {
	b := findBrowser()
	if b == "" {
		return nil
	}
	prof := filepath.Join(localAppData(), "WoK Kartenwerkstatt", "browser")
	cmd := exec.Command(b, "--app="+url, "--user-data-dir="+prof, "--no-first-run", "--no-default-browser-check",
		"--window-size=1440,920", "--lang=de", "--disable-features=Translate,msEdgeSidebarV2")
	if cmd.Start() != nil {
		return nil
	}
	return func() { cmd.Wait() }
}

func openDefaultBrowser(url string) {
	hidden(exec.Command("rundll32", "url.dll,FileProtocolHandler", url)).Start()
}
func openFolder(p string) { exec.Command("explorer.exe", p).Start() }

func quitRunning() {
	for p := basePort; p < basePort+10; p++ {
		if isOurs(p) {
			c := http.Client{Timeout: time.Second}
			if r, err := c.Post(fmt.Sprintf("http://127.0.0.1:%d/api/quit", p), "text/plain", nil); err == nil {
				r.Body.Close()
			}
		}
	}
	time.Sleep(1500 * time.Millisecond)
}

func psq(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }

func makeShortcut(lnk, target, icon, args string) error {
	ps := "$s=(New-Object -ComObject WScript.Shell).CreateShortcut(" + psq(lnk) + ");$s.TargetPath=" + psq(target) +
		";$s.Arguments=" + psq(args) + ";$s.WorkingDirectory=" + psq(filepath.Dir(target)) + ";$s.IconLocation=" + psq(icon+",0") +
		";$s.Description=" + psq(appName) + ";$s.Save()"
	return hidden(exec.Command("powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps)).Run()
}

const uninstKey = `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\WoKKartenwerkstatt`

func regSet(name, typ, val string) {
	hidden(exec.Command("reg", "add", uninstKey, "/v", name, "/t", typ, "/d", val, "/f")).Run()
}

func copyFile(src, dst string) error {
	b, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	var last error
	for i := 0; i < 6; i++ {
		if last = os.WriteFile(dst, b, 0o755); last == nil {
			return nil
		}
		time.Sleep(time.Second)
	}
	return last
}

func installer() {
	dir := installDir()
	docs := filepath.Join(documentsDir(), appName)
	r := msgBox(appName+" "+appVersion+" – Installation",
		"War of Kings Kartenwerkstatt installieren?\n\n"+
			"• Läuft danach komplett ohne Internet, inklusive Indoor-KI und Power-Scaling-System 2.0.\n"+
			"• Ersetzt eine ältere installierte Version, deine Karten bleiben erhalten.\n"+
			"• Optional: KI-Namensfindung über Ollama (lokal, kostenlos), Gemini, ChatGPT- oder Claude-API.\n"+
			"• Keine Administratorrechte nötig.\n"+
			"• Programm: "+dir+"\n"+
			"• Deine Karten, Bilder und Exporte: "+docs+"\n\n"+
			"Ja = installieren (Desktop- und Startmenü-Verknüpfung)\n"+
			"Nein = nur dieses Mal ohne Installation starten\n"+
			"Abbrechen = nichts tun", mbYesNoCancel|mbIconQuest)
	if r == idNo {
		runApp()
		return
	}
	if r != idYes {
		return
	}
	quitRunning()
	self, _ := os.Executable()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		msgBox(appName, "Der Programmordner konnte nicht angelegt werden:\n"+err.Error(), mbIconError)
		return
	}
	if err := copyFile(self, installedExe()); err != nil {
		msgBox(appName, "Die Programmdatei konnte nicht kopiert werden. Ist die Kartenwerkstatt noch geöffnet?\n\n"+err.Error(), mbIconError)
		return
	}
	icon := filepath.Join(dir, "Kartenwerkstatt.ico")
	if b, err := appFS.ReadFile("app/icon.ico"); err == nil {
		os.WriteFile(icon, b, 0o644)
	}
	makeShortcut(filepath.Join(desktopDir(), appName+".lnk"), installedExe(), icon, "")
	if pd := programsDir(); pd != "" {
		makeShortcut(filepath.Join(pd, appName+".lnk"), installedExe(), icon, "")
	}
	regSet("DisplayName", "REG_SZ", appName)
	regSet("DisplayVersion", "REG_SZ", appVersion)
	regSet("Publisher", "REG_SZ", "War of Kings")
	regSet("DisplayIcon", "REG_SZ", icon)
	regSet("InstallLocation", "REG_SZ", dir)
	regSet("UninstallString", "REG_SZ", `"`+installedExe()+`" --uninstall`)
	regSet("NoModify", "REG_DWORD", "1")
	regSet("NoRepair", "REG_DWORD", "1")
	setupDirs()
	if msgBox(appName, "Fertig installiert.\n\nDu findest die Kartenwerkstatt auf dem Desktop und im Startmenü.\nDeinstallieren geht über Windows-Einstellungen → Apps.\n\nJetzt starten?", mbYesNo|mbIconInfo) == idYes {
		exec.Command(installedExe(), "--app").Start()
	}
}

func uninstall() {
	docs := filepath.Join(documentsDir(), appName)
	if msgBox(appName, "Kartenwerkstatt deinstallieren?\n\nDeine Karten, Bilder und Exporte in\n"+docs+"\nbleiben erhalten.", mbYesNo|mbIconQuest) != idYes {
		return
	}
	quitRunning()
	os.Remove(filepath.Join(desktopDir(), appName+".lnk"))
	if pd := programsDir(); pd != "" {
		os.Remove(filepath.Join(pd, appName+".lnk"))
	}
	hidden(exec.Command("reg", "delete", uninstKey, "/f")).Run()
	os.RemoveAll(filepath.Join(localAppData(), "WoK Kartenwerkstatt"))
	// Die laufende .exe kann sich nicht selbst löschen: kurz warten, dann Ordner entfernen
	hidden(exec.Command("cmd", "/c", "ping 127.0.0.1 -n 3 >nul & rmdir /s /q \""+installDir()+"\"")).Start()
	msgBox(appName, "Die Kartenwerkstatt wurde entfernt. Deine Karten liegen weiter in\n"+docs, mbOK|mbIconInfo)
}

// Ordnerauswahl von Windows (FolderBrowserDialog über PowerShell), Fenster im Vordergrund
func pickFolder(title string) (string, error) {
	ps := "[Console]::OutputEncoding=[Text.Encoding]::UTF8;Add-Type -AssemblyName System.Windows.Forms;" +
		"$o=New-Object System.Windows.Forms.Form -Property @{TopMost=$true;ShowInTaskbar=$false;WindowState='Minimized'};" +
		"$f=New-Object System.Windows.Forms.FolderBrowserDialog;$f.Description=" + psq(title) + ";$f.ShowNewFolderButton=$true;" +
		"if($f.ShowDialog($o) -eq 'OK'){[Console]::Out.Write($f.SelectedPath)}"
	out, err := hidden(exec.Command("powershell", "-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-Command", ps)).Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}
