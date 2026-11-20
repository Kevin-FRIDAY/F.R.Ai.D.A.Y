// Speichert die Oberfläche, damit die App schnell startet. Antworten von Friday kommen immer frisch vom Server.
const CACHE = "friday-v143";
const SHELL = ["/", "/index.html", "/style.css", "/einstellungen-sync.js", "/leistung.js", "/fenster.js", "/app.js", "/lagezentrum.js", "/lagebild.js", "/klimazonen.js", "/gelaende.js", "/satelliten.js", "/globus-leinwand.js", "/schiffe.js", "/flugzeuge.js", "/welttour.js", "/sat-worker.js", "/vendor/satellite.min.js", "/agenten.js", "/energie.js", "/webseiten.js", "/vision.js", "/schnitt.js", "/markt.js", "/werkstatt.js", "/alexa.js", "/land.js", "/dienste.js", "/aktiv.js", "/postfach.js", "/syscheck.js", "/systemzentrale.js", "/einstellungen-plus.js", "/fernseher.js", "/sicherung.js", "/update-balken.js", "/auftrag-balken.js", "/dokumente.js", "/archiv.js", "/logbuch.js", "/zentrale.js", "/oekosystem.js", "/spiele.js", "/routen.js", "/helfer.js", "/kuehlschrank.js", "/lernen.js", "/kaufberater.js", "/gegenrede.js", "/ideen.js", "/klangraum.js", "/vollbild.js", "/hud.js", "/status-ring.js", "/face.js", "/face2d.js", "/vendor/three.min.js", "/vendor/GLTFLoader.js", "/vendor/head.glb", "/manifest.webmanifest", "/icon.svg", "/icon-180.png", "/icon-192.png"];

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
  if (e.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
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
