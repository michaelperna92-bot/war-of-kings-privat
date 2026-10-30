# WoK-Spielfeld: Einbaupaket

## Sofort anschauen
ZIP vollständig entpacken und preview.html im Browser öffnen. Keine Installation, kein Build und keine Internetverbindung erforderlich. Feldpositionen lassen sich einblenden und anklicken. Dies ist eine Grafik-/Eingabeprobe, kein vollständiges Spiel.

## Inhalt
- battlefield.png: unverändertes Original, 1254 × 1254 Pixel.
- battlefield.webp: kleinere Version für das Spiel.
- layout.json: alle 39 Felder mit normalisierten Koordinaten relativ zum vollständigen Bild.
- board.js und board.css: einfache, unabhängige HTML-/JavaScript-Darstellung.
- preview.html: lokale Vorschau.
- AUFTRAG-CLAUDE.txt: konkreter Integrationsauftrag.

## Anordnung
Zeilen von oben nach unten: 3 / 7 / 7 / 5 / 7 / 7 / 3.
Spalten von links nach rechts, insgesamt sieben.
Könige: r1c4 und r7c4. Wachen: r1c3, r1c5, r7c3, r7c5.
IDs bezeichnen ausschließlich visuelle Positionen. Sie sind NICHT die IDs der unbekannten Engine. Oben/unten sind keine festen Spielerzuordnungen.

## Einbau
CSS und JS laden. Container bereitstellen und aufrufen:

```js
const view = WoKBoard.mount(document.querySelector('#board'), {
  imageUrl: 'assets/wok-battlefield/battlefield.webp',
  onSelect(slot) {
    // Hier slot.id über eine explizite Tabelle auf bestehende Engine-ID abbilden.
    // Aktionen und gültige Ziele weiterhin von engine.js prüfen lassen.
  }
});
// Vorhandenen Kartenzeichner verwenden und dessen Canvas einsetzen:
// view.setCard('r7c4', meinGerendertesCanvas);
```

Der Container muss quadratisch bleiben. Bild nicht mit object-fit:cover beschneiden. Alle Elemente gemeinsam skalieren. Karten nicht über den Hintergrund hinaus separat spiegeln. Für Gegneransichten vorhandene Engine-Zuordnung und Darstellung zusammen behandeln; Embleme im Hintergrund sind fest eingebrannt.

## Grenzen
Dieses Paket enthält ein flaches Rasterbild, keine 3D-Arena und keine animierten Feuerstellen. Perspektivisches Neigen der gesamten Fläche ist möglich, erzeugt aber keine räumlichen Mauern. Bildsymbole und Rahmen sind eingebrannt. Die Positionen wurden am Bild visuell ausgerichtet; generierte Ornamente können leicht variieren. Für spätere frei bewegliche Kameras ist eine separate 3D-Umsetzung nötig.

Das Projekt selbst wurde nicht bereitgestellt: keine verifizierte Anbindung an app.js, engine.js, Go-Wrapper oder Cloud-Speicherung. Zusätzliche Dateien müssen vom vorhandenen Build eingebunden werden. Für den Ein-Datei-Build Bild und Skripte vom Build einbetten lassen.
