# Standort & Google Maps (ab v1.156.0)

**„Friday, wie lange brauche ich nach Hause?“** – Friday rechnet jetzt ab dem Ort, an dem du gerade bist. Mit einem Google-Schlüssel sogar mit **Live-Verkehr**, jedem Abbiege-Schritt und der echten Google-Karte.

## 1. Standort erlauben (iPhone und Mac)

Beim ersten Start fragt Friday einmal unten: **„Soll Friday wissen, wo du bist?“** → **Erlauben** tippen und im Safari-Fenster ebenfalls **Erlauben**.

Später geht es auch so: Werkzeug-Menü → **Alltag** → **Routen & Verbindungen** → unten **⚙ Meine Orte & Standort** → Haken bei **📍 Friday darf den Standort dieses Geräts kennen**.

Klappt die Frage auf dem iPhone nicht: iPhone-Einstellungen → **Datenschutz & Sicherheit** → **Ortungsdienste** → **Safari-Websites** → „Beim Verwenden der App“.

### Was passiert mit dem Standort?

- Solange Friday offen ist, schickt das Gerät den Standort an deinen Mac (höchstens alle 3 Minuten, öfter nur, wenn du dich bewegst).
- Gespeichert wird **nur der letzte Punkt** in `server/data/standort.json` auf deinem Mac. Kein Verlauf, keine Weitergabe.
- Älter als 6 Stunden? Dann nimmt Friday wieder dein Zuhause als Start.
- Ist der Standort älter als 15 Minuten, sagt Friday das dazu („Ich rechne ab deinem letzten Standort von vor 40 Minuten“).

### Sprachbefehle (ohne Claude-Guthaben)

- „Friday, wie lange brauche ich nach Hause?“
- „Friday, wo bin ich?“
- „Friday, Standort aus“ (löscht auch den letzten Punkt) / „Friday, Standort an“
- „Friday, vergiss meinen Standort“

Zuhause ist die Adresse aus dem Routen-Fenster. Steht dort nichts, nimmt Friday die Adresse aus **Mein Profil** (Straße, PLZ, Ort).

## 2. Ehrlich: Orten im Hintergrund

Eine Web-App (Friday auf dem Home-Bildschirm) darf den Standort **nur orten, solange sie offen ist**. Das ist eine Regel von Apple. Damit Friday es auch weiß, wenn sie zu ist, gibt es den Kurzbefehl **„Friday Standort“**:

1. **Kurzbefehle**-App → **+** → Name **Friday Standort**.
2. Aktion **Aktuellen Standort abrufen**.
3. Aktion **Details von Standorten abrufen** → **Breitengrad** (danach nochmal für **Längengrad**).
4. Aktion **Inhalte von URL abrufen**:
   - URL: `https://macbook-air-von-kevin-1.tailb0e1a5.ts.net/api/standort/kurzbefehl` (deine Friday-Adresse; steht auch im Routen-Fenster)
   - Methode **POST**
   - Header: `Authorization` = `Bearer DEIN-KURZBEFEHL-SCHLÜSSEL` (Einstellungen → Protokolle & Werkzeuge → **🔑 Kurzbefehl-Schlüssel**)
   - Hauptteil **JSON**: `lat` = Breitengrad, `lon` = Längengrad
5. Fertig. Antwort: „Friday: Standort gemerkt.“

**Automatisch:** Kurzbefehle → **Automation** → **+** → zum Beispiel **„Verlassen“** (Ort: Arbeit) oder **„Tageszeit“** (stündlich mehrere Zeiten) → **Sofort ausführen** → Kurzbefehl **Friday Standort**. Tailscale muss auf dem iPhone an sein.

## 3. Google Maps einrichten (optional)

Ohne Schlüssel rechnet Friday wie bisher kostenlos mit OpenStreetMap – nur ohne Stau. Mit Google bekommst du:

- Fahrzeit **mit Live-Verkehr** („Davon sind 8 Minuten Verkehr“) und Stau-Stellen rot auf der Karte
- jeden Abbiege-Schritt auf Deutsch („Rechts abbiegen auf Torstraße“) – antippen zoomt hin
- die echte **Google-Karte** mit Verkehrs-Ebene und Satellit im Routen-Fenster

### Schlüssel holen (ca. 10 Minuten)

1. Öffne **console.cloud.google.com** und melde dich mit deinem Google-Konto an.
2. Oben **Projekt auswählen** → **Neues Projekt** → Name „Friday“ → **Erstellen**.
3. Google verlangt ein **Abrechnungskonto** (Kreditkarte). Für deinen privaten Gebrauch bleibt es im Gratis-Kontingent (tausende Abfragen pro Monat frei). Friday macht höchstens 150 Google-Abfragen am Tag. Tipp: Unter **Abrechnung → Budgets & Benachrichtigungen** ein Budget von 1 € mit Mail-Warnung anlegen.
4. **APIs & Dienste** → **Bibliothek** → **Routes API** suchen → **Aktivieren**. Dann **Maps JavaScript API** suchen → **Aktivieren**.
5. **APIs & Dienste** → **Anmeldedaten** → **+ Anmeldedaten erstellen** → **API-Schlüssel**. Kopieren (beginnt mit `AIza…`).
6. Schlüssel einschränken (empfohlen): Schlüssel anklicken → **API-Einschränkungen** → **Schlüssel einschränken** → nur **Routes API** und **Maps JavaScript API** anhaken → Speichern. Bei „Anwendungseinschränkungen“ **Keine** lassen.

### In Friday eintragen

Werkzeug-Menü → **Verbindungen** → **🗺 Google Maps** → Schlüssel einfügen → **Verbinden**. Friday probiert sofort eine Testroute (Berlin → Potsdam).

**Wichtig:** Den Schlüssel nie in einen Chat posten. Er liegt nur auf deinem Mac in `server/data/verbindungen.json`. Für die Google-Karte bekommt dein angemeldetes Gerät den Schlüssel – darum die Einschränkung in Schritt 6.

Im Fenster **Verbindungen** kannst du bei Google Maps auch wählen, ob das Routen-Fenster die **Google-Karte** oder **Fridays dunkle Karte** zeigt. Im Routen-Fenster oben rechts auf der Karte wechselt der Knopf jederzeit.

## Wenn etwas nicht klappt

| Meldung | Lösung |
|---|---|
| „Routes API noch aus“ | Schritt 4 nochmal, danach 2 Minuten warten |
| „Abrechnungskonto“ | Schritt 3: Karte im Google-Projekt hinterlegen |
| „Schlüssel eingeschränkt“ | Anwendungseinschränkung auf **Keine** stellen |
| Karte grau / „Maps JavaScript API“ | Maps JavaScript API aktivieren (Schritt 4) |
| „Wo bin ich?“ → weiß ich nicht | Friday auf dem iPhone öffnen und Standort erlauben, oder Kurzbefehl einrichten |
