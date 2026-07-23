# Auto-Bestand — Design-Spec

Datum: 2026-07-23
Status: Genehmigt durch Nutzer, bereit für Implementierungsplanung

## 1. Zweck & Kontext

Lager-Management-App für das Servicefahrzeug eines Elektrikers (Handwerker, keine KFZ-Werkstatt). Erfasst Bestand an Installationsmaterial, Kabeln, Sicherungstechnik etc. Buchungen (Entnahme/Auffüllung) sollen per Sprachdiktat erfasst werden können. Ziel: möglichst einfache, "Apple-artige" Bedienung auf einem iPhone, komplett lokal ohne Cloud-Abhängigkeit, mit Jahres-Inventur-Export als PDF.

## 2. Architektur

- **App-Typ:** Progressive Web App (PWA). Installation über Safari „Zum Home-Bildschirm hinzufügen" — Vollbild, eigenes Icon, kein Browser-Chrome.
- **Technik:** Reines HTML/CSS/JavaScript, **kein Build-Schritt**, keine Frameworks, keine externen Laufzeit-Abhängigkeiten außer einer lokal eingebundenen PDF-Bibliothek (jsPDF, als Datei im Repo, kein CDN-Laden zur Laufzeit).
- **Speicherung:** Ausschließlich lokal in IndexedDB auf dem iPhone. Keine Server, keine Accounts, keine Synchronisierung.
- **Offline:** Service Worker cached App-Shell + Assets beim ersten Laden; danach voll funktionsfähig ohne Internetverbindung.
- **Icon-Badge:** Nutzung der Badging API (`navigator.setAppBadge`), unterstützt ab iOS 16.4 für installierte PWAs, um die Anzahl nachfüllbedürftiger Artikel direkt auf dem Home-Bildschirm-Icon anzuzeigen — komplett lokal, kein Server/Push nötig. Progressive Enhancement: ist die API nicht verfügbar (älteres iOS), wird sie einfach übersprungen — die In-App-Auffüll-Liste bleibt so oder so die primäre Erinnerungsquelle.
- **Kein Multi-Fahrzeug-Support:** genau ein Bestand (ein Fahrzeug).

### Deployment

- Neues **privates** GitHub-Repository, direkt von Claude erstellt und gepusht (Nutzer hat das explizit vorab freigegeben).
- GitHub Pages auf dem Repo aktiviert → feste URL, z. B. `https://<username>.github.io/<repo>/`.
- Hinweis: GitHub Pages-Seiten sind technisch öffentlich erreichbar für jeden mit Link, unabhängig von der Repo-Sichtbarkeit (kein Access-Control auf Free-Plan). Unproblematisch hier, da nur App-Code gehostet wird — alle Bestandsdaten bleiben ausschließlich lokal auf dem Gerät des Nutzers und werden nie übertragen.
- Nutzer öffnet die URL einmal in Safari auf dem iPhone und fügt sie zum Home-Bildschirm hinzu.

## 3. Datenmodell

**Artikel (Item):**
- `id`, `name`, `kategorie`, `icon` (Emoji/einfaches SVG)
- `einheit` (Stück, Liter, ml, Meter, …)
- `aktuelleMenge`, `sollMenge` (volle Auffüllung), `mindestMenge` (Schwelle für Nachfüll-Reminder)
- `aliase` (Liste alternativer Bezeichnungen für die Spracherkennung)

**Bewegung (Movement/Log-Eintrag):**
- `id`, `itemId`, `delta` (+/-), `neueMenge`, `quelle` (sprache | manuell | abhaken), `zeitstempel`

### Start-Katalog (Elektriker-Ausrichtung, frei löschbar/erweiterbar)

| Kategorie | Beispiel-Artikel |
|---|---|
| Kabel & Leitungen | NYM-J 3x1,5, NYM-J 5x2,5, Aderendhülsen (versch. Größen) |
| Installationsmaterial | Wago-Klemmen, Abzweigdosen, Steckdosen, Schalter, Rahmen |
| Sicherungstechnik | LS-Schalter (B16/B10), FI-Schutzschalter, Feinsicherungen |
| Verbrauchsmaterial | Isolierband, Kabelbinder, Schrumpfschlauch, Dübel & Schrauben |
| Beleuchtung/Leuchtmittel | LED-Lampen (E27/GU10), Notlicht-Akkus |
| Arbeitsschutz (PSA) | Isolierhandschuhe, Schutzbrille, Warnweste |
| Mess-/Kleinzubehör | Batterien (Multimeter/Prüfschraubenzieher), Prüfspitzen |

## 4. Bildschirme & Bedienung

- **Bestandsübersicht:** Nach Kategorie gruppierte Liste (iOS-„Einstellungen"-Optik: abgerundete Karten, große Titel, dezente Trennlinien). Jeder Artikel zeigt Name, aktuelle/Soll-Menge, Statuspunkt (grün = ok, orange = knapp/unter Mindestmenge).
- **Such-/Filterfeld** oben in der Bestandsliste zum schnellen Finden von Artikeln.
- **Sprach-Buchung:** Eingabefeld mit Fokus auf der iOS-Diktier-Taste der Tastatur. Nach dem Diktat erscheint eine **Bestätigungs-Karte** mit erkannter Menge/Artikel/Richtung („2× Wago-Klemme entnehmen — Bestätigen / Ändern") vor dem eigentlichen Buchen. Fallback: +/- Stepper-Buttons pro Artikel für manuelle Buchung ohne Sprache.
- **Rückgängig-Banner:** Nach jeder Buchung (Sprache, manuell oder Abhaken) erscheint kurz ein "Rückgängig"-Hinweis.
- **Auffüll-Ansicht (eigener Tab):** Alle Artikel unter Mindestmenge als abhakbare Liste (Checkbox links, iOS-Erinnerungen-Optik). Abhaken setzt `aktuelleMenge` automatisch auf `sollMenge` und entfernt den Artikel aus der Liste.
- **Artikel-Verlauf:** Antippen eines Artikels zeigt eine kurze Historie der letzten Buchungen (Datum, Menge, Richtung, Quelle).
- **Inventur-Tab:** Button „Jahresinventur exportieren" (Jahr wählbar, Standard: laufendes Jahr) erzeugt PDF.
- **Backup-Bereich (in Einstellungen):** Manueller JSON-Export (kompletter Bestand + Log) und Import über die iOS-Freigabe-/Dateiauswahl-Funktion.
- **Optik:** Systemschrift (SF-Pro-ähnlich), **Akzentfarbe: helles Lila** (statt iOS-Standard-Blau), automatischer Dark Mode passend zu iOS-Systemeinstellung, Swipe-to-Delete/Edit auf Listenelementen, dezentes Haptik-Feedback (Vibration API) bei Buchen/Abhaken.

## 5. Sprachverarbeitung (rein lokal, keine Cloud/KI)

Regelbasierte Auswertung des diktierten Texts:

1. **Zahl erkennen:** Ziffern und deutsche Zahlwörter ("ein/eine" bis "zwanzig").
2. **Artikel erkennen:** Abgleich gegen hinterlegte Aliase jedes Artikels. Bei mehreren möglichen Treffern zeigt die Bestätigungs-Karte eine Auswahl zum Klären.
3. **Richtung erkennen:** Entnahme-Signalwörter ("entnommen", "rausgenommen", "verbraucht", "benutzt") vs. Auffüll-Signalwörter ("aufgefüllt", "nachgefüllt", "hinzugefügt", "eingeräumt"). Ohne erkanntes Signalwort: Standardannahme **Entnahme** (Hauptanwendungsfall).
4. Ergebnis geht **immer** zuerst in die Bestätigungs-Karte — nie eine stille/automatische Buchung ohne Bestätigung.
5. Wird nichts eindeutig erkannt, öffnet sich die Bestätigungs-Karte leer zur manuellen Auswahl (Artikel-Liste + Stepper), kein stiller Fehlschlag.

## 6. Erinnerungen / Nachfüllbedarf

- Ein Artikel gilt als nachfüllbedürftig, sobald `aktuelleMenge <= mindestMenge`.
- Erscheint automatisch in der Auffüll-Ansicht, sobald die Bedingung eintritt (keine manuelle Prüfung nötig).
- Zusätzlich: App-Icon-Badge auf dem Home-Bildschirm zeigt die Anzahl nachfüllbedürftiger Artikel (lokal über Badging API, auch ohne App zu öffnen sichtbar).

## 7. Jahres-Inventur (PDF-Export)

Erzeugt über jsPDF, zwei Blätter:

- **Blatt 1 – Bestandsliste:** Kategorie, Artikel, aktuelle Menge, Soll-Menge, Status (ok/knapp), Stichtag.
- **Blatt 2 – Statistik:** pro Artikel Anzahl Entnahmen und Anzahl Auffüllungen im gewählten Jahr, gesamt entnommene Menge (aus dem Bewegungs-Log gefiltert nach Kalenderjahr).

Auslösung manuell über Button, Jahr wählbar (Standard: laufendes Jahr). Ergebnis wird über die iOS-Freigabe-Funktion gespeichert/geteilt (Dateien-App, Mail, etc.).

## 8. Datensicherheit / Backup

Da alle Daten ausschließlich lokal im Browser-Storage liegen, besteht Verlustrisiko bei Safari-Datenlöschung oder Gerätewechsel. Deshalb: manueller JSON-Export/Import als vollständiges Backup, jederzeit über die Einstellungen auslösbar.

## 9. Explizit nicht enthalten (YAGNI, außerhalb des Scopes)

- Keine Mehrfahrzeug-/Mehrbenutzer-Unterstützung.
- Keine echten Push-Benachrichtigungen bei geschlossener App (technisch ohne eigenen Server auf iOS nicht zuverlässig möglich).
- Keine Cloud-Synchronisierung oder Server-Backend.
- Keine automatische Spracherkennung über eine eigene Mikrofon-Aufnahme (Safari unterstützt die Web Speech API nicht zuverlässig) — stattdessen iOS-Systemdiktat im Textfeld.
- Kein automatischer Jahresabschluss/Reset der Zähler — Statistik wird bei Bedarf aus dem vollständigen Log berechnet.
