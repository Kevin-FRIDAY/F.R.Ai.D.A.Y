# 76 · Mark XVI: Mac-Zwilling, eigenes Netzwerk und Datenschutz (v1.188.0)

Alles läuft auf deinem Mac und kostet nichts. Friday **liest nur** und ändert keine Mac-Einstellungen.
Du findest es im **Gehirn-Cockpit → Reiter 💻 Zwilling** und **🔏 Datenschutz**.

## 💻 Mac-Zwilling
Ein Abbild deines Macs:
- System, Arbeitsspeicher, Akku, Anzahl installierter Apps
- **Speicher**: freier Platz, Verlauf und Trend. Ab 5 Tagen sagt Friday, wann es knapp wird („in etwa 40 Tagen unter 5 GB“).
- Größe von Fridays eigenen Ordnern (Friday, Sicherungen, Archiv, Videos, Webseiten)
- **Programme**: welche am meisten Rechenleistung und Arbeitsspeicher brauchen
- **Apps**: jeden Morgen um 6:10 Uhr ein Schnappschuss. Neue oder entfernte Apps stehen in der Liste.
- **Passt alles für Friday?** Node, macOS, Mac-Agent, ffmpeg, Python, Ollama
- Wird der Speicher knapp, kommt eine Mitteilung, nur als Text.
- Sag: **„Friday, wie viel Speicher ist noch frei?“** oder **„Welche Programme fressen am meisten Leistung?“**

## 🛡 Mac-Sicherheit
Friday prüft, ob diese Schutzfunktionen an sind: FileVault, Firewall, Systemschutz (SIP), Gatekeeper und automatische Updates. Ist etwas aus, steht dabei, wo du es einschaltest.
**Fridays Bausteine** werden jede Woche auf bekannte Sicherheitslücken geprüft (npm audit). Lücken behebt das nächste getestete Update.
- Sag: **„Friday, ist mein Mac sicher?“**

## 📶 Dein Netzwerk
- Friday liest die Geräteliste, die dein Mac sowieso kennt. Es gibt **keinen Scan** und keine fremden Netze.
- Alle 30 Minuten wird nachgeschaut. Taucht ein unbekanntes Gerät auf, bekommst du eine Mitteilung als Text.
- Beim allerersten Mal gelten alle Geräte als bekannt.
- Mit **„Ist meins“** und einem Namen (z. B. „Router“, „Kevins iPhone“) machst du ein Gerät bekannt.
- Handys mit „privater WLAN-Adresse“ wechseln manchmal ihre Adresse und tauchen dann neu auf.
- Dazu zeigt Friday ungewöhnliche Anmeldungen bei Friday selbst: ein neues Gerät oder eine Anmeldung zwischen 1 und 5 Uhr nachts.
- Sag: **„Friday, welche Geräte sind in meinem WLAN?“**

## 🔏 Datenschutz-Kontrolle
- **Was Friday speichert:** Fragen und Antworten, Logbuch, Gedächtnis, Anmelde-Protokoll, frühere Fassungen, Dokumente, Schlüssel und Kamera-Fotos. Zu jedem steht, wie groß es ist und seit wann es da ist.
- **Alte aufräumen:** Archiv, Logbuch und Fotos lassen sich aufräumen, wenn sie älter als 1 Monat, 3 Monate, 6 Monate oder 1 Jahr sind. Sie kommen in den **Papierkorb** (~/Friday-Archiv/Papierkorb) und sind nicht endgültig gelöscht.
- **Wohin Daten gehen können:** Claude, Telegram und deine eingerichteten Dienste. Daten gehen nur dorthin, wenn du die Funktion benutzt.
- Sag: **„Friday, öffne die Datenschutz-Kontrolle“**

## Sicherheits-Update in diesem Paket
Die Baustein-Prüfung hat 3 hohe und 1 mittlere Lücke in Fridays Mail-Bausteinen gefunden (imapflow, nodemailer, socks, ip-address). Sie sind mit diesem Update behoben. Danach meldet npm audit 0 Lücken.

## Ehrlich getestet
- **Echt geprüft:** Speicher, Programme, Geräteliste des Netzes, Kompatibilität, Baustein-Prüfung und Aufräumen in den Papierkorb liefen am Test-Server (Linux).
- **Nur am Mac möglich, im Test nicht geprüft:** FileVault, Firewall, SIP, Gatekeeper, Akku und Apps. Die Befehle dafür sind Standard-Befehle von macOS. Friday zeigt dort „nicht lesbar“, falls einer nicht antwortet.
- **Funktionstest:** „Mac-Zwilling und Netz (Speicher, Programme, Geräteliste)“.
