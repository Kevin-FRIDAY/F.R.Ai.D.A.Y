# 56 · Meine Konten (Berliner Sparkasse, Revolut) – nur ansehen

Friday zeigt dir Kontostand, Umsätze, wofür dein Geld geht und welche Abos laufen.
**Friday kann kein Geld bewegen.** Keine Überweisung, keine Zahlung, kein Dauerauftrag. Das ist fest eingebaut.

Öffnen: Werkzeug-Menü → **Alltag → Meine Konten**, oder sag:

- „Friday, wie ist mein Kontostand?“
- „Was habe ich diesen Monat ausgegeben?“
- „Wie viel habe ich letzten Monat für Lebensmittel ausgegeben?“
- „Wie viel habe ich bei Netflix bezahlt?“
- „Welche Abos habe ich?“

Diese Fragen beantwortet Friday ohne Claude, also kostenlos.

---

## Welcher Weg ist der beste?

| Weg | Kosten | Aufwand | Sparkasse | Revolut | Sicherheit |
|---|---|---|---|---|---|
| **Enable Banking** (empfohlen) | kostenlos für eigene Konten | einmal 15 Min. | ✅ | ✅ | Zugelassener Dienst (PSD2), nur Lesen, Bank-Login passiert bei der Bank |
| **CSV-Datei** | kostenlos | jedes Mal Datei hochladen | ✅ | ✅ | Am sichersten, kein Internet-Zugang nötig |
| GoCardless (früher Nordigen) | – | – | – | – | Nimmt keine neuen Kunden mehr an |
| FinTS/HBCI direkt | kostenlos | Wochen (Registrierung bei der Kreditwirtschaft), PIN müsste auf dem Mac liegen | ✅ | ❌ | Schlechter: Friday hätte deine Online-Banking-PIN |
| Tink, finAPI, Salt Edge | kostenpflichtig, nur für Firmen | hoch | ✅ | ✅ | gut, aber zu teuer |

Unsere Empfehlung: **Enable Banking**. Wenn du dich dort nicht anmelden möchtest, nimm die CSV-Datei.

---

## Weg 1: Live über Enable Banking (einmal einrichten)

1. Öffne Friday **über deine Tailscale-Adresse** (https://…ts.net). Die Bank schickt dich nach der Anmeldung dorthin zurück, und sie verlangt https.
2. Gehe zu **enablebanking.com** → kostenlos registrieren → Bestätigungs-Mail abwarten → **Control Panel**.
3. **API applications → Add a new application**
   - Umgebung: **Production**
   - Schlüssel: „Generate in the browser …“ lassen. Der Browser lädt eine **.pem-Datei** herunter. Das ist dein privater Schlüssel. Gut aufheben, niemandem schicken, nicht in den Chat kopieren.
   - Name: z. B. „Friday“. Beschreibung: „Private Kontoübersicht“.
   - **Allowed redirect URLs**: die Adresse, die Friday unter *Meine Konten → Einrichten* anzeigt (endet auf `/api/konten/rueckruf`).
   - E-Mail und Datenschutz-/AGB-Adresse: deine E-Mail, als Adresse reicht deine Friday-Adresse (wird im privaten Modus nicht geprüft).
4. Nach dem Anlegen: **„Activate by linking accounts“** → Berliner Sparkasse auswählen → bei der Sparkasse anmelden (pushTAN) → Konto auswählen. Dasselbe für **Revolut** (Bestätigung in der Revolut-App). Nur verknüpfte Konten sind später sichtbar. Damit ist die App im kostenlosen „Restricted“-Modus aktiv.
5. In Friday: **Meine Konten → Einrichten**
   - App-ID (Application ID) eintragen
   - **.pem-Datei wählen**
   - **Speichern & testen**. Bei Erfolg steht da „Verbunden mit Enable Banking“.
6. Unter „Bank verbinden“ auf **Berliner Sparkasse** tippen → **Verbinden** → bei der Sparkasse anmelden. Danach landest du wieder in Friday.
   Für **Revolut** genauso. Falls Revolut unter Deutschland nicht erscheint: Land auf **Litauen (LT)** stellen.

Danach holt Friday alle 6 Stunden selbst die Kontostände. Die Banken erlauben ungefähr 4 Abrufe am Tag.
Die Freigabe läuft nach höchstens 180 Tagen ab (bei der Sparkasse oft 90). Friday zeigt dir rechtzeitig „Neu verbinden“.

## Weg 2: CSV-Datei

- **Sparkasse**: Online-Banking → Umsätze → Zeitraum wählen → Export **CSV-CAMT**.
- **Revolut**: App → Konto → ⋯ → **Kontoauszug** → Format **Excel/CSV** → Zeitraum.

In Friday: **Meine Konten → Einrichten → Weg 2** → Bank auswählen → **CSV hochladen**.
Bei der Sparkasse steht der Kontostand nicht in der Datei. Trag ihn im Feld „Kontostand heute“ ein, oder später auf der Konto-Karte.
Lädst du dieselbe Datei zweimal hoch, erkennt Friday die doppelten Umsätze.

## Wo liegen die Daten?

Nur auf deinem Mac in `~/Friday/server/data/konten/`, mit Dateirechten nur für dich.
Der Ordner wird nie von Updates überschrieben. Die tägliche Sicherung in `~/Friday-Backups` nimmt ihn mit.
Wenn du Claude eine freie Frage stellst, zum Beispiel „Kann ich mir im Dezember einen Urlaub leisten?“, schickt Friday dafür eine Zusammenfassung deiner Umsätze an Claude. Die festen Fragen oben laufen ganz ohne Claude.

## Kategorien

Friday sortiert automatisch, zum Beispiel REWE → Lebensmittel, Netflix → Abos, degewo → Miete.
Liegt etwas falsch: in **Umsätze** die Kategorie direkt am Umsatz ändern. Friday merkt sich das für alle Umsätze von diesem Empfänger.
Überweisungen zwischen deinen eigenen Konten (z. B. Sparkasse → Revolut) zählen als **Umbuchung** und nicht als Ausgabe.

## Verbindung beenden

**Einrichten → Verbunden → Trennen**. Friday widerruft dann die Freigabe bei Enable Banking und löscht die gespeicherten Umsätze dieser Bank.
Zusätzlich kannst du jederzeit im Enable-Banking-Control-Panel oder im Online-Banking der Sparkasse die Freigabe entziehen.
