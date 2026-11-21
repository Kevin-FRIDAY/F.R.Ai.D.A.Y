# Helfer-Paket (v1.106.0)

Fünf neue Helfer plus Unterbrechen mit „Friday“. Fast alles läuft **ohne Claude-Guthaben**.
Knöpfe mit „braucht Guthaben“ fragen Claude und kosten etwas.

## 🛑 Friday unterbrechen

Während Friday spricht, hört sie mit. Sagst du **„Friday“**, hört sie sofort auf.

- „Friday, stopp“: Sie ist still.
- „Friday, wie wird das Wetter?“: Sie hört auf und beantwortet gleich die neue Frage.
- Nur „Friday“: Sie hört auf und hört dir zu.
- Normales Reden ohne „Friday“ unterbricht sie **nicht**.
- Hört das Mikrofon Fridays eigene Stimme (zum Beispiel wenn sie selbst „Friday“ sagt), merkt sie das und unterbricht sich nicht.
- Ausschalten kannst du das unter Einstellungen → Assistent → „Unterbrechen mit Friday“.
- Auf dem iPhone kann Safari den Ton leiser stellen, solange das Mikrofon an ist. Stört dich das, schalte es dort aus.

## 🧊 Kühlschrank & Reste-Regisseur (Werkzeug-Menü → Alltag)

- **Kassenbon:** Fotografiere ihn. Die Texterkennung läuft kostenlos auf deinem Gerät. Friday erkennt rund 50 Lebensmittel und schätzt, wann sie ablaufen. Du kannst jedes Datum ändern.
- „KI liest den Bon“ ist genauer, braucht aber Guthaben.
- **Per Sprache:**
  - „Ich habe Milch, Eier und Hackfleisch gekauft.“
  - „Die Milch läuft am Freitag ab.“
  - „Das Hackfleisch ist leer.“ Dann landet es automatisch auf der Einkaufsliste.
  - „Was muss weg?“
  - „Was kann ich kochen?“
- **Rezepte:** Es sind 34 Rezepte eingebaut. Friday sortiert sie danach, was zuerst schlecht wird. Mit „Fehlendes auf die Liste“ landet alles, was fehlt, im Organizer.
- **Warnung:** Einmal am Tag ab 9 Uhr meldet Friday per Telegram oder Mitteilung, was morgen abläuft, und schlägt ein Rezept dazu vor.

## 🛍 Anti-Fehlkauf-Berater (Werkzeug-Menü → Alltag)

1. Trag unter **„Meine Geräte“** ein, was du hast, zum Beispiel iPhone 15 Pro, MacBook Air, Samsung TV oder Echo Dot. Mit Kaufdatum gibt es den **Garantie-Wächter**: 30 Tage bevor die 2-jährige Gewährleistung endet, sagt Friday Bescheid.
2. Tipp das Produkt ein. Kopier aus dem Shop die **Bewertungen** und die **technischen Daten** dazu.
3. Friday zeigt dir dann:
   - eine Ampel
   - ob das Produkt zu deinen Geräten passt (Stecker, iPhone/Android, Mac/Windows, Alexa/HomeKit/Matter, Zigbee/Thread, Abo-Kosten, App-Pflicht)
   - **Langzeit-Mängel** (Probleme „nach 3 Monaten“, „nach einem Jahr“, Nachträge)
   - Gründe, warum Leute das Produkt zurückschicken
   - Reparatur-Anleitungen von iFixit
   - Links zu Stiftung Warentest, idealo, Geizhals, Reddit und YouTube-Langzeittests
4. „Tiefen-Recherche im Netz“ sucht öffentliche Quellen mit Claude und braucht Guthaben.

**Browser-Plugin:** Zieh den Knopf „🛍 Kauf-Check mit Friday“ aus dem Fenster in deine Lesezeichen-Leiste. Markier im Shop die Bewertungen und tipp auf das Lesezeichen. Friday prüft dann sofort.

Sprache: „Soll ich mir die AirPods Pro kaufen?“, „Kaufberater: Ring Doorbell“, „Ich habe ein iPad Air“.

Friday liest keine Shops heimlich aus und vergleicht Preise nicht selbst. Sie sagt ehrlich, wenn Daten fehlen.

## ⚖ Advocatus Diaboli (Werkzeug-Menü → Erschaffen)

Füg einen Artikel oder deinen eigenen Text ein. Friday zeigt dir dann:

- **Kritiker:** Pauschalaussagen, wertende Sprache, Entweder-oder-Fallen
- **Skeptiker:** Zahlen ohne Quelle, Ursache oder nur Zufall, Einzelfälle
- **Jurist:** Heilversprechen, „Nr. 1“-Werbung, Garantie, üble Nachrede, Urheberrecht, Datenschutz, Werbekennzeichnung, Steuer. Das sind Hinweise, keine Rechtsberatung.

Dazu bekommst du einen Wert für die Angreifbarkeit in Prozent. „Mit KI vertiefen“ sucht die stärksten Gegenargumente und gibt Tipps, wie dein Text besser wird. Das braucht Guthaben.

Sprache: „Friday, widersprich mir: Homeoffice macht faul.“ Auch hier gibt es ein Lesezeichen für Nachrichtenseiten.

## 🎧 Stimmungs-Sound (Werkzeug-Menü → Friday)

Seit v1.131.0 gibt es **19 Klänge** in sechs Gruppen:
- **Wetter:** Regen, Gewitter (mit Donner), Bergwind, Winterwald
- **Natur:** Wald & Vögel, Regenwald, Sommernacht
- **Wasser:** Meer, Bach im Wald, Unterwasser
- **Gemütlich:** Kaminfeuer, Café, Zugfahrt
- **Fokus & Ruhe:** Fokus-Rauschen, Klangschale, Herzschlag
- **Sci-Fi:** Weltraum, Raumschiff-Brücke, Energie-Puls

Alle Klänge werden live erzeugt, ohne Download und ohne Guthaben. Während Friday spricht, wird es automatisch leiser.

**Bild zum Klang:** Oben im Fenster läuft zu jedem Klang eine bewegte Szene: Regen über der Stadt, Blitze beim Gewitter (genau dann, wenn es donnert), ein knisterndes Kaminfeuer, Wellen im Sonnenuntergang, Schnee im Winterwald und so weiter.
- **📷 Echtes Foto:** zeigt statt der Animation ein echtes Foto (nur frei lizenzierte Bilder von Openverse, mit Fotograf und Lizenz). Bei Regen, Gewitter und Schnee fallen die Tropfen oder Flocken live darüber. **↻** zeigt ein anderes Foto.
- **Wo regnet es gerade?** Bei Regen, Gewitter und Winterwald zeigt Friday, in welchen von 48 Städten weltweit es gerade regnet, gewittert oder schneit (Wetter von Open-Meteo). Tipp auf eine Stadt, dann kommt ein Foto aus dieser Stadt.
- **⛶** zeigt die Szene im Vollbild, zum Beispiel das Kaminfeuer auf dem Fernseher. Esc oder ✕ schließt.

**Schlaf-Timer:** 15, 30 oder 60 Minuten, danach blendet Friday den Klang aus.

**Automatik:** Friday passt den Klang an das an, was du **in Friday** machst:
- Spiele-Werkstatt → Energie-Puls
- Weltgeschehen → Weltraum
- System-Zentrale / Fridays Gehirn → Raumschiff-Brücke
- Routen → Zugfahrt
- Ideen-Schmiede → Café
- Kühlschrank → Kaminfeuer
- Fragen zu Code → Fokus, zur Reise → Meer, zu Meditation → Klangschale

Was du außerhalb von Friday machst, liest sie nicht mit.

Sprache: „Spiel Gewitter“, „Kaminfeuer“, „Spiel Café-Geräusche“, „Wo regnet es gerade?“, „Wo schneit es?“, „Stimmungs-Sound automatisch“, „Sound aus“.

## 💡 Ideen-Schmiede (Werkzeug-Menü → Erschaffen)

- **Würfeln:** Ideen aus Alltag, Kreativität, Nischen-Business und Technik, jeweils mit dem ersten Schritt und den Startkosten.
- **Schnell-Check deiner Idee:** Ist das Problem klar? Gibt es eine Zielgruppe? Wie kommt Geld rein? Kann man es schnell testen? Was ist anders? Dazu bekommst du Hinweise auf Risiken (zum Beispiel Gewerbe oder Datenschutz) und die nächsten Schritte.
- **Ideen-Tresor:** Er speichert deine Ideen mit ihrem Stand: Idee → Test → Umsetzung.
- „Mit KI ausarbeiten“ liefert Zielgruppe, Preis, erste Kunden, einen Test in 7 Tagen und Namensideen. Das braucht Guthaben.

Sprache: „Gib mir eine Start-up-Idee“, „Idee für Technik“, „Merk dir die Idee: …“.
