# 2. Friday von überall erreichen (Tailscale)

Friday läuft auf deinem Mac und ist aus Sicherheitsgründen nur dort direkt erreichbar. Damit iPhone, Watch und Kurzbefehle auch unterwegs funktionieren, verbindet Tailscale deine Geräte zu einem privaten Netz. Kostenlos für private Nutzung, und niemand sonst im Internet sieht Friday.

## Einrichten

1. **Mac:** Tailscale aus dem Mac App Store laden, öffnen, mit Apple-, Google- oder Microsoft-Konto anmelden.
2. **iPhone:** Tailscale aus dem App Store laden, mit **demselben Konto** anmelden, VPN erlauben.
3. **HTTPS einschalten:** Auf [login.tailscale.com/admin/dns](https://login.tailscale.com/admin/dns) unten bei "HTTPS Certificates" auf **Enable** klicken. (Nötig, damit Mikrofon und Kamera im iPhone-Browser funktionieren.)
4. **Friday freigeben:** Nochmal **Friday installieren.command** öffnen. Der Installer erkennt Tailscale und zeigt dir am Ende deine Adresse, z. B.

   `https://kevins-macbook.tail1234.ts.net`

   Falls nicht, im Terminal eingeben:

   ```
   /Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg 3000
   ```

   Die Adresse zeigt dann `.../Tailscale serve status`.

Diese Adresse ist ab jetzt **deine Friday-Adresse** für iPhone, Watch und Kurzbefehle.

## Gut zu wissen

- Auf dem iPhone muss Tailscale verbunden sein (in den Tailscale-Einstellungen "On Demand" einschalten, dann verbindet es sich von selbst).
- Ist dein Mac aus oder schläft, ist Friday nicht erreichbar. Telegram-Nachrichten werden dann beantwortet, sobald er wieder läuft.
