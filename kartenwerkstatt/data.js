/* War of Kings – Stammdaten aus dem Master-Regelwerk v1.8 mit Nachträgen (Stand 26.10.2026).
 * Texte wörtlich übernommen; nur Tippfehler berichtigt (z. B. „Battlepahse“ → „Battlephase“).
 * status: 'offiziell' = im Regelwerk festgelegt; 'nur König' = Königliche Gabe;
 * crestStatus: wie verbindlich das Wappenbild ist.
 */
window.WOK_DATA = (function () {
  const RACES = [
    { id: 'mensch', name: 'Mensch', crest: 'rasse_Menschen', crestStatus: 'bestätigt' },
    { id: 'tierwesen', name: 'Tierwesen', crest: 'rasse_Tierwesen', crestStatus: 'Entwurf' },
    { id: 'bestien', name: 'Bestien', crest: 'rasse_Bestien', crestStatus: 'Entwurf' },
    { id: 'drachen', name: 'Drachen', crest: 'rasse_Drachen', crestStatus: 'Entwurf' },
    { id: 'maschinen', name: 'Maschinen', crest: 'rasse_Maschinen', crestStatus: 'Entwurf' },
    { id: 'elfen', name: 'Elfen', crest: 'rasse_Elfen', crestStatus: 'Entwurf' },
    { id: 'riesen', name: 'Riesen', crest: 'rasse_Riesen', crestStatus: 'Entwurf' },
    { id: 'daemonen', name: 'Dämonen', crest: 'rasse_Dämonen', crestStatus: 'Entwurf' },
    { id: 'engel', name: 'Engel', crest: 'rasse_Engel', crestStatus: 'Entwurf' },
    { id: 'vampire', name: 'Vampire', crest: 'rasse_Vampire', crestStatus: 'Entwurf' },
    { id: 'zwerge', name: 'Zwerge', crest: 'rasse_Zwerge', crestStatus: 'Entwurf' },
    { id: 'kobolde', name: 'Kobolde', crest: 'rasse_Kobolde', crestStatus: 'Entwurf' },
    { id: 'gargoyls', name: 'Gargoyls', crest: 'rasse_Gargoyls', crestStatus: 'Entwurf' }
  ];
  const CLASSES = [
    { id: 'pirat', name: 'Pirat', crest: 'klasse_Pirat', crestStatus: 'Entwurf' },
    { id: 'samurai', name: 'Samurai', crest: 'klasse_Samurai', crestStatus: 'bestätigt' },
    { id: 'zombie', name: 'Zombie', crest: 'klasse_Zombie', crestStatus: 'Entwurf' },
    { id: 'magier', name: 'Magier/Hexe', crest: 'klasse_Magier-Hexe', crestStatus: 'Entwurf' },
    { id: 'geist', name: 'Geist', crest: 'klasse_Geist', crestStatus: 'Entwurf' },
    { id: 'baendiger', name: 'Bestienbändiger', crest: 'klasse_Bestienbändiger', crestStatus: 'Entwurf' },
    { id: 'slayer', name: 'Demon Slayer', crest: 'klasse_Demon_Slayer', crestStatus: 'Entwurf' },
    { id: 'cyborg', name: 'Cyborg', crest: 'klasse_Cyborg', crestStatus: 'Entwurf' },
    { id: 'tueftler', name: 'Tüftler', crest: 'klasse_Tüftler', crestStatus: 'Entwurf' },
    { id: 'krieger', name: 'Krieger', crest: 'klasse_Krieger', crestStatus: 'Entwurf' },
    { id: 'ritter', name: 'Ritter', crest: 'klasse_Ritter', crestStatus: 'Entwurf' }
  ];
  const ELEMENTS = [
    { id: 'feuer', name: 'Feuer', crest: 'element_Feuer', crestStatus: 'Designreferenz' },
    { id: 'wasser', name: 'Wasser', crest: 'element_Wasser', crestStatus: 'Designreferenz' },
    { id: 'erde', name: 'Erde', crest: 'element_Erde', crestStatus: 'Designreferenz' },
    { id: 'wind', name: 'Wind', crest: 'element_Wind', crestStatus: 'Designreferenz' },
    { id: 'blitz', name: 'Blitz', crest: 'element_Blitz', crestStatus: 'Designreferenz' },
    { id: 'licht', name: 'Licht', crest: 'element_Licht', crestStatus: 'Designreferenz' },
    { id: 'dunkelheit', name: 'Dunkelheit', crest: 'element_Dunkelheit', crestStatus: 'Designreferenz' }
  ];
  const RARITIES = [
    { id: 'gewoehnlich', name: 'Gewöhnlich', crest: 'selten_Gewöhnlich', crestStatus: 'Designreferenz', limit: 3, color: 'Silber / Grau' },
    { id: 'ungewoehnlich', name: 'Ungewöhnlich', crest: 'selten_Ungewöhnlich', crestStatus: 'Designreferenz', limit: 3, color: 'Grün' },
    { id: 'selten', name: 'Selten', crest: 'selten_Selten', crestStatus: 'Designreferenz', limit: 2, color: 'Blau' },
    { id: 'legendaer', name: 'Legendär', crest: 'selten_Legendär', crestStatus: 'Abweichung', limit: 1, color: 'Gold mit Krone',
      note: 'Im Referenzbild fehlt die vorgeschriebene Krone (Regelwerk v1.5).' }
  ];
  // Heldengaben: Texte und CT laut Master-Regelwerk vom 29.10.2026, Abschnitt 10 (Schütze = Werkstatt-Ergänzung, noch nicht im Regelwerk).
  // Alle übrigen Gaben wurden auf Anweisung entfernt.
  const GIFTS = [
    { id: 'mordlust', short: '+500 ATK bis zum Zugende. Nur eigene Battlephase.', name: 'Mordlust', kind: 'ct', ct: 2, crest: 'gabe_Mordlust',
      text: 'Der Held erhält +500 ATK bis zum Zugende. Aktivierbar nur in der eigenen Battlephase.' },
    { id: 'entwaffnen', short: 'Ein Gegner in Angriffsreichweite: −500 DEF bis Zugende.', name: 'Entwaffnen', kind: 'ct', ct: 2, crest: 'gabe_Entwaffnen',
      text: 'Ein gegnerischer Held in Angriffsreichweite erhält −500 DEF bis zum Zugende. Aktivierbar nur in der eigenen Battlephase.' },
    { id: 'doppelschlag', short: 'Ein oder zwei Gegner in Angriffsrichtung angreifen; König: zwei Treffer.', name: 'Doppelschlag', kind: 'permanent', crest: 'gabe_Doppelschlag',
      text: 'Wahlweise einen oder zwei gültige gegnerische Helden in Angriffsrichtung angreifen; gegen einen König zwei Treffer. Alle gewählten Treffer gelten gleichzeitig.' },
    { id: 'poison', short: 'Vergiftet Gegner im Kampf: Tod zu Beginn deines nächsten Zuges. Nie Könige.', name: 'Poison', kind: 'permanent', crest: 'gabe_Poison',
      text: 'Angreifende oder angegriffene gegnerische Helden werden vergiftet; niemals Könige. Ein vergifteter Held stirbt zu Beginn des nächsten eigenen Zuges des Besitzers des Poison-Helden, sofern Poison bis dahin nicht entfernt wurde. Ein Held kann nur einmal gleichzeitig vergiftet sein; eine erneute Vergiftung verlängert oder erneuert die Frist nicht.' },
    { id: 'eisenpanzer', short: '+300 DEF für zwei Runden. Nur eigene Battlephase.', name: 'Eisenpanzer', kind: 'ct', ct: 5, crest: 'gabe_Eisenpanzer',
      text: 'Der Held erhält +300 DEF für zwei Runden. Die Wirkung endet zu Beginn des zweiten folgenden eigenen Zuges. Aktivierbar nur in der eigenen Battlephase.' },
    { id: 'blitzschritt', short: '1 Feld extra in erlaubter Bewegungsrichtung, danach angreifen. Nur eigene Battlephase.', name: 'Blitzschritt', kind: 'ct', ct: 3, cost: 3, role: 'Offensive Mobilität', crest: 'gabe_Blitzschritt',
      text: 'Ein zusätzliches Feld in erlaubter Bewegungsrichtung in der eigenen Battlephase; danach regulärer Angriff, sofern noch angriffsberechtigt.' },
    { id: 'rueckzug', short: 'Gewähltes Monster zieht nach der Schadensberechnung 1 Feld zurück, auch ohne Angriff.', name: 'Rückzug', kind: 'ct', ct: 4, cost: 4, role: 'Taktischer Rückzug', crest: 'gabe_Rückzug',
      text: 'In der eigenen Battlephase ein beliebiges eigenes oder gegnerisches Monster einschließlich des Anwenders wählen. Nach der gemeinsamen Schadensberechnung zieht es ein Feld gerade in Richtung seiner eigenen Spielfeldseite zurück, auch ohne eigenen Angriff; nur wenn es noch lebt und das Feld existiert und frei ist.' },
    { id: 'tausch', short: 'Positionstausch mit einer eigenen Armeekarte. Nur eigene Battlephase.', name: 'Tausch', kind: 'ct', ct: 4, crest: 'gabe_Tausch',
      text: 'Positionstausch mit einer eigenen Armeekarte. Zulässig, wenn beide Zielfelder gültig sind und keine ausdrückliche Feldsperre verletzt wird; normale Bewegungsschritte und -richtungen sind hierfür nicht erforderlich. Ein gefesselter Held darf an keinem Tausch beteiligt sein. Aktivierbar nur in der eigenen Battlephase.' },
    { id: 'goettlicher_segen', short: 'Wehrt alle negativen Effekte ab, auch Poison und Einfrieren.', name: 'Göttlicher Segen', kind: 'permanent', crest: 'gabe_Göttlicher_Segen',
      text: 'Negative Effekte, darunter ATK-/DEF-Senkungen, Poison und Einfrieren, werden vollständig abgewehrt und nicht angelegt.' },
    { id: 'heilung', short: 'Entfernt alle negativen Effekte einer eigenen Karte, auch Poison, auch beim Anwender.', name: 'Heilung', kind: 'ct', ct: 3, crest: 'gabe_Heilung',
      text: 'Entfernt sämtliche negativen Effekte von einer eigenen oder verbündeten Karte einschließlich des Anwenders; entfernt auch Poison und verhindert dessen späteren Gifttod. Aktivierbar nur in der eigenen Battlephase.' },
    { id: 'fesseln', short: 'Ein Gegner ist zwei Runden bewegungsunfähig; Angriffe und Gaben bleiben erlaubt.', name: 'Fesseln', kind: 'ct', ct: 4, crest: 'gabe_Fesseln',
      text: 'Ein gegnerischer Held ist zwei Runden bewegungsunfähig; Angriffe und Gaben bleiben zulässig. Aktivierbar nur in der eigenen Battlephase.' },
    { id: 'ansturm', short: 'Hebt die Beschwörungssperre auf.', name: 'Ansturm', kind: 'permanent', crest: 'gabe_Ansturm',
      text: 'Hebt die Beschwörungssperre auf: Der Held darf schon im Zug seiner Beschwörung laufen, angreifen und aktivierbare Gaben nutzen. Die Phasenreihenfolge bleibt bestehen.' },
    // Neu am 29.10.2026 auf Anweisung des Nutzers (noch nicht im Master-Regelwerk; Wappen = Werkstatt-Entwurf)
    { id: 'schuetze', short: 'Kann Ziele angreifen, die zwei Felder weiter weg sind.', name: 'Schütze', kind: 'permanent', crest: 'gabe_Schütze', crestStatus: 'Entwurf',
      text: 'Der Held kann gezielt gegnerische Ziele angreifen, die zwei Felder weiter weg sind. Die Gabe ist permanent.' },
    { id: 'durchbruch', short: 'Greift einen Helden zwei Felder entfernt in erlaubter Angriffsrichtung an.', name: 'Durchbruch', kind: 'ct', ct: 4, crest: 'gabe_Durchbruch',
      text: 'Ein Held zwei Felder entfernt kann in einer erlaubten Angriffsrichtung angegriffen werden. Aktivierbar nur in der eigenen Battlephase.' }
  ];
  // Königliche Gaben (nur für Königskarten). Noch nicht festgelegt – hier eintragen, sobald sie feststehen:
  // { id, name, kind: 'ct'|'permanent', ct, crest, short, text }
  // Laut Master-Regelwerk 29.10.2026 (Abschnitt 4): permanent, ohne Energie und Cooldown. Wirkungsbereich und Stärke stehen auf der Königskarte
  // und werden je Karte eingestellt: alle eigenen Monster oder nur eine Rasse, Klasse oder ein Element.
  const ROYAL_GIFTS = [
    { id: 'gebot_der_krone', name: 'Gebot der Krone', kind: 'permanent', royal: true, crest: 'koenig_Gebot_der_Krone', crestStatus: 'Entwurf',
      param: { stat: 'energy', min: 1, max: 3, step: 1, def: 1, unit: 'Energie', sign: '−' },
      tpl: n => 'Kosten {wer} −' + n + ' Energie (nie unter 0).', text: 'Reduziert die Energiekosten passender eigener Monster um den angegebenen Wert, niemals unter 0. Permanent, ohne Energie und Cooldown.' },
    { id: 'zorn_des_imperators', name: 'Zorn des Imperators', kind: 'permanent', royal: true, crest: 'koenig_Zorn_des_Imperators', crestStatus: 'Entwurf',
      param: { stat: 'atk', min: 100, max: 1000, step: 100, def: 100, unit: 'ATK', sign: '+' },
      tpl: n => '{Wer} erhalten +' + n + ' ATK.', text: 'Passende eigene Monster erhalten den angegebenen ATK-Bonus. Permanent, ohne Energie und Cooldown.' },
    { id: 'ewiges_bollwerk', name: 'Ewiges Bollwerk', kind: 'permanent', royal: true, crest: 'koenig_Ewiges_Bollwerk', crestStatus: 'Entwurf',
      param: { stat: 'def', min: 100, max: 1000, step: 100, def: 200, unit: 'DEF', sign: '+' },
      tpl: n => '{Wer} erhalten +' + n + ' DEF.', text: 'Passende eigene Monster erhalten den angegebenen DEF-Bonus. Permanent, ohne Energie und Cooldown.' },
    // Festlegung des Entwicklers vom 30.10.2026: Blitzkrieg senkt die Energiekosten jedes passenden eigenen Monsters, niemals unter 0
    { id: 'blitzkrieg', name: 'Blitzkrieg', kind: 'permanent', royal: true, crest: 'koenig_Blitzkrieg', crestStatus: 'Entwurf',
      param: { stat: 'energy', min: 1, max: 3, step: 1, def: 1, unit: 'Energie', sign: '−' },
      tpl: n => '{Wer} kosten jeweils ' + n + ' Energie weniger (nie unter 0).', text: 'Senkt die Energiekosten jedes passenden eigenen Monsters um den angegebenen Wert; 0 ist die Grenze. Gilt für alle eigenen Monster oder nur für eine Rasse, Klasse oder ein Element. Permanent, ohne Energie und Cooldown.' }
  ];
  // Wirkungsbereich als Text: alle / Rasse / Klasse / Element
  function royalScope(sel) {
    const sc = (sel && sel.scope) || 'all', t = sel && sel.target;
    const nm = (list, id) => (list.find(x => x.id === id) || {}).name || '';
    if (sc === 'race' && t) return { wer: 'eigener ' + nm(RACES, t), Wer: 'Eigene ' + nm(RACES, t) };
    if (sc === 'class' && t) return { wer: 'eigener ' + nm(CLASSES, t), Wer: 'Eigene ' + nm(CLASSES, t) };
    if (sc === 'element' && t) return { wer: 'eigener ' + nm(ELEMENTS, t) + '-Monster', Wer: 'Eigene ' + nm(ELEMENTS, t) + '-Monster' };
    return { wer: 'aller eigenen Monster', Wer: 'Alle eigenen Monster' };
  }
  function royalAmount(g, sel) { const p = g.param, n = sel && sel.amount !== undefined ? +sel.amount : p.def; return Math.max(p.min, Math.min(p.max, n)); }
  function royalShort(g, sel) { const w = royalScope(sel); return g.tpl(royalAmount(g, sel)).replace('{wer}', w.wer).replace('{Wer}', w.Wer); }
  function giftTitle(g) { return g.kind === 'ct' ? g.name + ' [' + g.ct + ']' : g.name; }
  function giftShort(g, sel) { return g.royal ? royalShort(g, sel) : (g.short || g.text); }
  function giftText(g, param) {
    if (g.royal) return royalShort(g, param) + ' ' + g.text;
    if (g.param) { const n = param || g.param.min; return n === 1 && g.textOne ? g.textOne : g.text.replace('{n}', n); }
    return g.text;
  }
  return { RACES, CLASSES, ELEMENTS, RARITIES, GIFTS, ROYAL_GIFTS, royalScope, royalAmount, royalShort, giftTitle, giftText, giftShort, SOURCE: 'Gabenwappen-Übersicht vom 27.10.2026' };
})();
