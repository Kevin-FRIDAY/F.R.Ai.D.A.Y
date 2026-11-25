# Fridays Werkzeugkasten – 100 Werkzeuge (v1.162.0)

Friday hat jetzt **100 kleine Werkzeuge**: Rechner, Generatoren, Prüfer und Vorlagen für Geld, Haushalt, Zeit,
Gesundheit, Text, Sicherheit, Technik, Mathe, Reisen, Natur, Familie und Büro.
**Alle laufen ohne Claude-Guthaben.** Sie rechnen auf dem Mac oder fragen kostenlose Dienste ohne Schlüssel.

**Seit v1.165.0 gibt es kein eigenes Werkzeugkasten-Fenster mehr** (auch kein Eintrag im Werkzeug-Menü).
Alle Werkzeuge bleiben da: Du sagst Friday einfach, was du brauchst. Wenn es etwas zu sehen gibt
(QR-Code, Tabelle, Liste, Datei zum Herunterladen, Passwort/PIN 🔒), geht von selbst eine kleine
Ergebnis-Karte auf. Fragst du „Friday, öffne den Werkzeugkasten“, nennt sie dir Beispiele.

## Warum ein Werkzeugkasten statt 100 einzelner Werkzeuge?

Jedes Werkzeug, das Claude kennt, wird bei **jeder** Frage mitgeschickt. 100 einzelne Claude-Werkzeuge hätten
jede Frage etwa dreimal so teuer und langsamer gemacht. Darum gibt es für Claude nur **ein** Werkzeug
„werkzeugkasten“ mit einer kurzen Liste. Und rund **64 Werkzeuge versteht Friday sogar direkt per Sprache,
ganz ohne Claude** – das ist am schnellsten und kostet nichts.

## So sprichst du sie an (Beispiele)

| Sag zum Beispiel | Werkzeug |
|---|---|
| „Friday, Mehrwertsteuer von 250 Euro“ | Mehrwertsteuer |
| „19 Prozent von 80“ / „Was sind 30 Prozent Rabatt auf 120 Euro?“ | Prozent / Rabatt |
| „Kredit über 20000 Euro, 5 Prozent, 60 Monate“ | Kredit-Rate |
| „Teile 87 Euro durch 4 Personen“ | Rechnung teilen |
| „Was kostet ein Gerät mit 2000 Watt 3 Stunden am Tag?“ | Stromkosten |
| „Wie lange koche ich ein weiches Ei?“ | Eier-Kochzeit |
| „Was ist 30 Tage nach dem 1. März?“ / „Wie viele Arbeitstage bis 24.12.?“ | Datum / Arbeitstage |
| „Brückentage 2027“ | Brückentage |
| „Wann habe ich Feierabend, wenn ich um 7:30 angefangen habe?“ | Feierabend |
| „Wann muss ich ins Bett, wenn ich um 6 aufstehe?“ | Schlaf-Rechner |
| „BMI 80 Kilo 1,80 Meter“ | BMI |
| „Morse SOS“ / „2026 in römischen Zahlen“ | Morse / Römische Zahlen |
| „Erstelle ein Passwort mit 20 Zeichen“ / „Neue PIN“ | Passwort / PIN 🔒 |
| „Mach mir einen QR-Code für https://…“ | QR-Code |
| „Ist apple.com erreichbar?“ | Webseite prüfen 🌐 |
| „Ist 97 eine Primzahl?“ / „Welche Note bei 42 von 60 Punkten?“ | Primzahl / Noten |
| „Synonyme für schnell“ | Synonyme 🌐 |
| „Luftlinie von Berlin nach Paris“ | Luftlinie 🌐 |
| „Welche Steckdose in Thailand?“ / „Trinkgeld in den USA?“ | Steckdose / Trinkgeld |
| „Packliste für 7 Tage Strandurlaub“ | Packliste |
| „Wie ist der Pollenflug?“ / „UV-Index heute“ | Pollenflug / UV 🌐 |
| „Wichteln mit Kevin, Carla, Mama und Papa“ | Wichteln 🔒 |
| „Teile Anna, Ben, Carla, Dave in 2 Teams“ | Teams |
| „Welches Sternzeichen hat der 3. Mai?“ | Sternzeichen |
| „Checkliste Umzug“ | Checklisten |

Was Friday nicht direkt versteht, gibt sie an Claude weiter – Claude nimmt dann das passende Werkzeug
(kostet nur die normale Frage, rechnet aber exakt).

## Zeichen in der Liste

- 🎤 = geht per Sprache ohne Claude
- 🌐 = braucht Internet (kostenlose Dienste: Open-Meteo, OpenThesaurus, LanguageTool, Open Library, Have I Been Pwned)
- 🔒 = geheim: läuft **nur im Fenster**. Passwörter, PINs, Wichtel-Paare und WLAN-QR-Codes landen nie im Logbuch,
  nie in der Datenbank, werden nie vorgelesen und nie an Claude geschickt.

„Passwort geleakt?“ schickt dein Passwort **nicht** ins Internet: Friday schickt nur die ersten 5 Zeichen
einer Prüfsumme (k-Anonymität) und vergleicht den Rest auf dem Mac.

„IBAN prüfen“ prüft nur, ob die Nummer gültig geschrieben ist. Friday bewegt nie Geld.

## Alle 100 Werkzeuge

**Geld & Rechnen:** Mehrwertsteuer 🎤 · Prozentrechner 🎤 · Rabatt-Rechner 🎤 · Kredit-Rate 🎤 · Sparplan & Zinseszins 🎤 · Sparziel 🎤 · Stundenlohn ↔ Monatsgehalt 🎤 · Rechnung teilen 🎤 · Angebote vergleichen · Abo-Kosten · 50/30/20-Budget 🎤

**Haushalt & Energie:** Rezept umrechnen · Küchen-Maße 🎤 · Backofen-Umrechner 🎤 · Eier-Kochzeit 🎤 · Kerntemperatur 🎤 · Saisonkalender 🎤 · Flecken-Helfer 🎤 · Wandfarbe-Bedarf · Boden & Fliesen · Spritkosten 🎤 · Stromkosten eines Geräts 🎤 · E-Auto laden

**Zeit & Kalender:** Datum rechnen 🎤 · Tage zwischen zwei Daten 🎤 · Alters-Rechner 🎤 · Arbeitstage zählen 🎤 · Brückentage 🎤 · Uhrzeit rechnen 🎤 · Feierabend-Rechner 🎤 · Stundenzettel · Kalender-Datei (.ics) · Schlaf-Rechner 🎤

**Gesundheit & Sport:** BMI-Rechner 🎤 · Kalorienbedarf · Wasserbedarf 🎤 · Puls-Zonen 🎤 · Lauf-Tempo (Pace) 🎤 · Kalorien beim Sport 🎤 · Geburtstermin

**Text & Schreiben:** Text-Statistik · Schreibweise ändern · Listen sortieren & aufräumen · Texte vergleichen · Morse-Code 🎤 · Römische Zahlen 🎤 · Zahl in Worten 🎤 · Brief-Vorlagen

**Sicherheit:** Passwort-Generator 🎤 🔒 · Merk-Passwort (Passphrase) 🎤 🔒 · Passwort-Stärke 🔒 · Passwort geleakt? 🔒 · PIN-Generator 🎤 🔒 · Prüfsumme (Hash) · Base64 kodieren

**Technik & Computer:** JSON prüfen & formatieren · CSV ↔ JSON · Zahlensysteme 🎤 · Farbcodes umrechnen · Farbpalette · Kontrast prüfen · Subnetz-Rechner · Cron-Zeitplan erklären · Download-Dauer 🎤 · QR-Code 🎤 · Webseite erreichbar? 🎤

**Mathe & Schule:** Dreisatz · Durchschnitt & Statistik 🎤 · Fläche & Umfang 🎤 · Primzahl & Teiler 🎤 · ggT & kgV 🎤 · Gleichungen lösen · Noten-Rechner 🎤

**Wissen & Sprache:** Synonyme finden 🎤 · Rechtschreibung prüfen · Buch-Suche · Periodensystem 🎤

**Unterwegs & Reisen:** Entfernung (Luftlinie) 🎤 · Koordinaten umrechnen · Länder-Vorwahl 🎤 · Steckdose im Ausland 🎤 · Trinkgeld im Ausland 🎤 · Kleider- & Schuhgrößen 🎤 · Packliste 🎤

**Natur & Umwelt:** Pollenflug 🎤 · UV-Index 🎤 · Wassertemperatur Meer 🎤 · Gefühlte Temperatur & Taupunkt · CO₂-Rechner Reise 🎤

**Spaß & Familie:** Wichtel-Auslosung 🎤 🔒 · Teams bilden 🎤 · Zufalls-Auswahl 🎤 · Würfel-Set 🎤 · Sternzeichen 🎤 · Geschenk-Ideen 🎤

**Büro & Verträge:** IBAN prüfen · Kündigungsfrist · Was kostet das Meeting? · Dienstreise & Pendeln · Checklisten 🎤

## Gut zu wissen

- Ergebnisse kannst du kopieren, vorlesen lassen oder als Datei herunterladen (z. B. Kalender-Datei .ics, Brief .txt, QR-Code .png).
- Jeder Lauf steht im Logbuch unter „🧰 Werkzeugkasten“ (geheime Werkzeuge ohne Inhalt).
- Rechner sind Hilfen für den Alltag, keine Steuer-, Rechts- oder Arztberatung.
