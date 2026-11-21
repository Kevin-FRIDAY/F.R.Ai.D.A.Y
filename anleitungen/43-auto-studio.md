# 43 · Auto-Studio in der Werkstatt (v1.134.0)

Friday zeigt Autos so wie auf den bekannten Vergleichsbildern: **Seitenansicht im hellen Studio,
Spiegelboden, Markenfarben und die Daten** (Motor, PS, 0–100 km/h, Spitze). Ganz ohne Claude-Guthaben.

## So startest du es

- Sprich: **„Friday, zeig mir die BMW M Modelle“**, „Audi RS Modellreihe“, „AMG Vergleich“,
  „Volkswagen R“, „Porsche Modelle“.
- Einzelnes Auto: **„Friday, bau mir einen RS 6“**, „bau mir einen M4 in Blau“, „Golf R“, „G 63“.
- Oder: Werkzeug-Menü → Werkstatt (3D) → **📦 Vorlagen** → die 🏁-Knöpfe ganz oben.

## Was du im Studio machen kannst

- **Farbe**: Kreise unten links (Lack wechselt sofort).
- **Ansicht**: Seite, Schräg vorn, Schräg hinten, 360°. Mit dem Finger drehen geht auch.
- **Modellreihe**: alle Modelle der Marke untereinander, mit Daten und PS-Balken. Antippen = im Studio ansehen.
- **📸 Bild / Als Bild speichern**: macht ein Bild (Modellreihe im Hochformat 1080 × 1920, gut für TikTok/Instagram).
  Am iPhone öffnet sich „Teilen“ → „Bild sichern“, am Mac landet es in „Downloads“.

## Welche Autos sind drin?

BMW M (M2, M3 Touring, M3, M4, M5, M8, X5 M), Mercedes-AMG (A 45 S, C 63 S, GT 63 S, GT 63, GLE 63 S, G 63),
Volkswagen R (Golf R, Golf R Variant, T-Roc R, Tiguan R, Arteon R, Touareg R),
Audi RS (RS 3, RS 4, RS 5, RS 6, RS 7, RS Q8, RS e-tron GT), Porsche (911 Carrera, GTS, GT3, Turbo S, Taycan, Cayenne).
Die Daten sind Herstellerangaben (gerundet, je nach Ausstattung etwas anders). Steht in `server/src/autostudio.js`.

## Noch echter: echte 3D-Modelle

Friday baut die Autos selbst (aus Form, Lack, Felgen und Bremssätteln in Markenfarbe). Das sieht aus wie ein
Studio-Modell, aber nicht wie ein Foto. **Für den Foto-Look**: in der Werkstatt unter 📦 Vorlagen den kostenlosen
**Sketchfab-Schlüssel** eintragen (Anleitung 37). Dann lädt Friday bei „bau mir einen M4“ ein echtes 3D-Modell
und stellt es ins selbe Studio (die Quelle und Lizenz stehen auf der Karte). Bei einer Modellreihe nimmt Friday
immer die eigenen Modelle, damit alle gleich aussehen.

Markenlogos baut Friday nicht nach – nur Schriftzug und Farben.
