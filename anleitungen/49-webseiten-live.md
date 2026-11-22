# Webseiten-Werkstatt: live bauen mit Countdown (v1.146.0)

**Seit v1.151.0 direkt in Friday** (vorher nur in Eve).

## Was neu ist

- **Live zuschauen:** Sobald Friday baut, siehst du links den Code, den sie gerade schreibt (er tippt mit, Neues leuchtet kurz auf), und rechts die Vorschau, die mitwächst.
- **Countdown und Ladebalken:** Oben läuft eine Uhr rückwärts bis „fertig“, darunter ein Balken mit Prozent. Darüber steht, woran Friday gerade arbeitet (Design, Kopfbereich, Abschnitt „Leistungen“, Kontaktformular …).
- **Zeitwunsch mit Humor:** Sagst du zum Beispiel
  „Friday, bau mir eine Webseite für meinen Friseursalon in 30 Minuten“,
  lacht Friday: „Haha, 30 Minuten? Gib mir 40 Sekunden, Kevin.“ Dann baut sie im **Tempo-Modus** (schnelles Modell, kompakte Seite) und ist wirklich so schnell fertig.
- **Ehrliche Zeit:** Friday nennt nur Zeiten, die sie schafft. Sie misst jeden Bau und rechnet beim nächsten Mal mit dem Durchschnitt der letzten 6 Bauten plus etwas Puffer. Dauert es doch länger, zeigt die Uhr „+0:05 · gleich fertig“, und am Ende sagt sie es auch so.
- **Friday sagt an, was sie baut (neu in v1.151.0):** „Ich plane gerade die Seite …“, „Das baue ich gerade: den Kopfbereich“, „Jetzt gestalte ich das Design“, „Das baue ich gerade: das Kontaktformular“ … und am Ende „Fertig, Chef.“ Jede Phase sagt sie nur einmal und fällt sich nicht selbst ins Wort. Abschalten: in localStorage `friday_ws_ansage` = 0.
- Ohne Zeitwunsch baut Friday ausführlicher (wie bisher) und du siehst trotzdem alles live.

## So probierst du es aus

1. Werkzeug-Menü → **Webseiten-Werkstatt**, Auftrag eintippen, z. B. „Bäckerei Sonnenschein in Hamburg, warm und gemütlich, in 30 Minuten“ → **Webseite bauen**.
   Oder per Stimme: „Friday, bau mir eine Webseite für … in 30 Minuten“.
2. Zuschauen. Nach dem Fertig-Ton erscheint die Seite wie gewohnt mit Angebot, Herunterladen und „Als verkauft eintragen“.

## Gut zu wissen

- Zeitwünsche, die Friday versteht: „in 30 Minuten“, „in einer halben Stunde“, „in 2 Stunden“, „in 45 Sekunden“, „ganz schnell“, „sofort“.
- Wünschst du dir weniger Zeit, als sie braucht („in 10 Sekunden“), sagt sie ehrlich: „10 Sekunden schaffe ich nicht ganz. Gib mir 40 Sekunden.“
- Die Messwerte liegen in `server/data/webseiten-tempo.json`.
- Der Tempo-Modus nutzt das schnelle Modell (Haiku) und kostet deutlich weniger Guthaben.
