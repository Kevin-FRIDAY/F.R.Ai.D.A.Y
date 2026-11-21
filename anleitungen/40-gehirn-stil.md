# Alles im Gehirn-Stil (v1.129.0)

Ab dieser Version sehen alle Fenster von Friday so aus wie **Fridays Gehirn** und das **Tool-Ökosystem**.

## Was ist neu?

- **Jedes Fenster hat den Gehirn-Kopf:** links ein drehender Kern-Ring mit dem Symbol des Fensters,
  darüber die kleine Zeile „F.R.Ai.D.A.Y · BEREICH“, ein großer leuchtender Titel und rechts die
  grüne **LIVE**-Anzeige mit Uhrzeit. Der Kopf ist wie ein gebogener Glas-Bildschirm und bleibt beim Scrollen oben.
- **Neuronen-Netz und Sockel:** im Hintergrund leuchtet leise ein Netz aus Nervenzellen,
  unten im Fenster glüht ein Sockel wie unter dem Gehirn.
- **Farben nach Bereich** (wie im Tool-Ökosystem):
  - Welt = türkis
  - Erschaffen = violett (Ideen-Schmiede, Advocatus Diaboli, Spiele-Werkstatt bekommen den 3D-Würfel)
  - Kern/Friday = orange (Energie, Archiv, Logbuch, Datenbank, Agenten …)
  - Alltag = blau (Kalender, Mails, Routen, Fernseher, Lernecke …)
  - System = gelb (Einstellungen, Sicherungen, System-Check)
  - Rot bleibt nur für Fehler.
- **Werkzeug-Menü:** jede Gruppe hat ihre Ökosystem-Farbe, jedes Symbol sitzt in einer leuchtenden Kachel.
- **Vollbild-Studios** (Markt-Radar, Werkstatt, Webseiten, Schnitt-Team, Vision, Kamera, Bildschirm)
  bekommen die Glas-Kopfleiste mit Kern-Ring.

## Diagnose jetzt in der linken Leiste

Die Diagnose (gehört → gesendet → Antwort → gesprochen) schwebt nicht mehr unten links über dem Profil.
Sie steht jetzt fest in der **linken Leiste unter „Meine Dienste“ (YouTube) und über dem Profil**.
Auf dem iPhone findest du sie ganz unten auf der Startseite, unter Amazon/Netflix/YouTube.

- Antippen = alle Schritte anzeigen (noch mal antippen = wieder kurz).
- Ausschalten: Einstellungen → Assistent → „Diagnose anzeigen“.

## Für Bastler

Der ganze Stil steckt in `dashboard/gehirn-stil.js`. Neue Fenster brauchen nichts zu tun:
Alles, was als `.sheet` mit `.sheet-top` gebaut ist, wird automatisch veredelt.
Den Bereich (Farbe) eines neuen Fensters trägst du in der Liste `BEREICH` ein.
