// Speichert die Oberfläche, damit die App schnell startet. Antworten von Friday kommen immer frisch vom Server.
const CACHE = "friday-v217";
const SHELL = ["/", "/index.html", "/style.css", "/eve-start.js", "/einstellungen-sync.js", "/gespeichert.js", "/leistung.js", "/fenster.js", "/app.js", "/lagezentrum.js", "/lagebild.js", "/lageplus.js", "/gehirn-stil.js", "/klimazonen.js", "/gelaende.js", "/satelliten.js", "/globus-leinwand.js", "/schiffe.js", "/flugzeuge.js", "/welttour.js", "/sat-worker.js", "/vendor/satellite.min.js", "/agenten.js", "/energie.js", "/webseiten.js", "/vision.js", "/schnitt.js", "/markt.js", "/marktplus.js", "/vendor/RGBELoader.js", "/fotostudio.js", "/vendor/studio.hdr", "/autostudio.js", "/werkstatt.js", "/zerlegelabor.js", "/sport.js", "/alexa.js", "/land.js", "/dienste.js", "/aktiv.js", "/postfach.js", "/syscheck.js", "/systemzentrale.js", "/gehirn.js", "/einstellungen-plus.js", "/fernseher.js", "/sicherung.js", "/update-balken.js", "/auftrag-balken.js", "/dokumente.js", "/grossauftrag.js", "/cockpit.js", "/cockpit-gedaechtnis.js", "/cockpit-agenten.js", "/cockpit-welt.js", "/cockpit-alltag.js", "/cockpit-arzt.js", "/cockpit-denken.js", "/cockpit-firma.js", "/cockpit-labor.js", "/cockpit-forschung.js", "/archiv.js", "/logbuch.js", "/zentrale.js", "/oekosystem.js", "/spiele.js", "/routen.js", "/helfer.js", "/werkzeugkasten.js", "/oeffentlich.js", "/vendor/qrcode.js", "/kuehlschrank.js", "/profil.js", "/kennenlernen.js", "/glocke.js", "/eve.js", "/dauerwaechter.js", "/dokwissen.js", "/apple.js", "/konten.js", "/appzentrale.js", "/hoeren.js", "/wache.js", "/kern.js", "/lernen.js", "/kaufberater.js", "/gegenrede.js", "/ideen.js", "/wunschliste.js", "/sternideen.js", "/datenbank.js", "/klangbild.js", "/klangraum.js", "/vollbild.js", "/hud.js", "/status-ring.js", "/face.js", "/face2d.js", "/vendor/three.min.js", "/vendor/GLTFLoader.js", "/buero.js", "/vendor/three-extras.js", "/vendor/roboter.glb", "/vendor/head.glb", "/manifest.webmanifest", "/icon.svg", "/icon-180.png", "/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // /datei/ = private Dateien aus der Dateisuche (z. B. Lohnabrechnungen): nie im App-Speicher ablegen.
  if (e.request.method !== "GET" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/datei/")) return;
  // Videos/Audio (z. B. Stimmungs-Sound-Videos von Wikimedia) nicht anfassen: die laden stückweise (Range) und wären zu groß für den Speicher.
  if (e.request.destination === "video" || e.request.destination === "audio" || e.request.headers.has("range")) return;
  // Erst Netz, bei Ausfall die gespeicherte Version.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});
