// F.R.Ai.D.A.Y Mac-Agent: Fridays "Hände" auf dem Mac.
// Führt nur die fest eingebauten Aktionen aus, niemals beliebige Befehle.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import WebSocket from "ws";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(here, ".env");
const fileEnv = fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile, "utf8")) : {};
const env = (name, fallback) => (fileEnv[name] ?? process.env[name] ?? "").trim() || fallback;

const SERVER_URL = env("SERVER_URL", "ws://127.0.0.1:3000/agent");
const AGENT_TOKEN = env("AGENT_TOKEN", "");
const MUSIC_APP = env("MUSIC_APP", "Music");
const SAY_VOICE = env("SAY_VOICE", "Anna");

if (!AGENT_TOKEN) {
  console.error("AGENT_TOKEN fehlt in mac-agent/.env");
  process.exit(1);
}

function run(cmd, args, timeout = 15000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        // Verständliche Fehlermeldung statt des ganzen AppleScript-Textes.
        let text = stderr?.trim();
        if (!text && err.killed) text = `Zeitüberschreitung nach ${Math.round(timeout / 1000)} s (fragt der Mac vielleicht nach einer Erlaubnis? Systemeinstellungen → Datenschutz & Sicherheit → Automation)`;
        if (!text) text = `${cmd} ist fehlgeschlagen (Code ${err.code ?? "?"})`;
        reject(new Error(text.replace(/\s+/g, " ").slice(0, 300)));
      }
      else resolve(stdout.trim());
    });
  });
}

// AppleScript mit Argumenten: Texte werden als argv übergeben, nie in den Code eingesetzt.
function osa(script, ...args) {
  return run("osascript", ["-e", `on run argv\n${script}\nend run`, ...args.map(String)]);
}

const LEISE_AKTIONEN = new Set(["system_info"]);

const clampVolume = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

// ---------- Apple Kalender & Erinnerungen ----------
// Der Server schickt die Wünsche als JSON im Feld "value". Texte gehen als argv an AppleScript, nie in den Code.
// Zeiten kommen als Sekunden ab heute 0:00 Uhr (Ortszeit des Macs) zurück, so gibt es keine Probleme mit Datumsformaten.
const RS = String.fromCharCode(30), US = String.fromCharCode(31);
const jsonVal = (v) => { try { return JSON.parse(v || "{}") || {}; } catch { return {}; } };
const zahl = (v, min, max, std) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : std; };
const zeilen = (out) => String(out || "").split(RS).filter((z) => z.length).map((z) => z.split(US));

// Liefert ein AppleScript-Datum aus Jahr/Monat/Tag/Stunde/Minute (argv-Positionen ab "start").
const AS_DATUM = `
on machDatum(y, mo, dd, h, mi)
  set d to current date
  set day of d to 1
  set year of d to y
  set month of d to mo
  set day of d to dd
  set time of d to (h * 3600 + mi * 60)
  return d
end machDatum`;

const KALENDER_TERMINE = `
on run argv
  set vonTag to (item 1 of argv) as integer
  set anzTage to (item 2 of argv) as integer
  set nurKal to item 3 of argv
  set basis to current date
  set time of basis to 0
  set d1 to basis + vonTag * days
  set d2 to d1 + anzTage * days
  set RS to character id 30
  set US to character id 31
  set out to ""
  tell application "Calendar"
    repeat with c in calendars
      set cn to name of c
      if nurKal is "" or nurKal is cn then
        try
          set ns to summary of every event of c
          set ss to start date of every event of c
          set es to end date of every event of c
          set ads to allday event of every event of c
          set rcs to recurrence of every event of c
          repeat with i from 1 to count of ns
            set s to item i of ss
            set rc to item i of rcs
            if rc is missing value then set rc to ""
            if s < d2 and ((item i of es) > d1 or rc is not "") then
              set n to item i of ns
              if n is missing value then set n to ""
              set out to out & n & US & ((s - basis) as integer as text) & US & (((item i of es) - basis) as integer as text) & US & ((item i of ads) as text) & US & cn & US & rc & RS
            end if
          end repeat
        end try
      end if
    end repeat
  end tell
  return out
end run`;

const KALENDER_NEU = `${AS_DATUM}
on run argv
  set t to item 1 of argv
  set d to machDatum((item 2 of argv) as integer, (item 3 of argv) as integer, (item 4 of argv) as integer, (item 5 of argv) as integer, (item 6 of argv) as integer)
  set dauer to (item 7 of argv) as integer
  set ganz to ((item 8 of argv) is "1")
  set kn to item 9 of argv
  set ort to item 10 of argv
  tell application "Calendar"
    set k to missing value
    if kn is not "" then
      try
        set k to first calendar whose name is kn
      end try
    end if
    if k is missing value then
      repeat with c in calendars
        try
          if writable of c then
            set k to c
            exit repeat
          end if
        end try
      end repeat
    end if
    if k is missing value then error "Kein beschreibbarer Kalender gefunden."
    if ganz then
      set e2 to d + 1 * days
    else
      set e2 to d + dauer * minutes
    end if
    set ev to make new event at end of events of k with properties {summary:t, start date:d, end date:e2, allday event:ganz}
    if ort is not "" then set location of ev to ort
    return name of k
  end tell
end run`;

const KALENDER_NAMEN = `
on run argv
  set RS to character id 30
  set out to ""
  tell application "Calendar"
    repeat with c in calendars
      set w to false
      try
        set w to writable of c
      end try
      if w then set out to out & (name of c) & RS
    end repeat
  end tell
  return out
end run`;

const ERINNERUNGEN_LISTE = `
on run argv
  set basis to current date
  set time of basis to 0
  set RS to character id 30
  set US to character id 31
  set out to ""
  tell application "Reminders"
    repeat with l in lists
      set ln to name of l
      try
        set ns to name of (every reminder of l whose completed is false)
        set ds to due date of (every reminder of l whose completed is false)
        repeat with i from 1 to count of ns
          set dd to item i of ds
          if dd is missing value then
            set dt to ""
          else
            set dt to ((dd - basis) as integer as text)
          end if
          set out to out & (item i of ns) & US & dt & US & ln & RS
        end repeat
      end try
    end repeat
  end tell
  return out
end run`;

const ERINNERUNGEN_NEU = `${AS_DATUM}
on run argv
  set t to item 1 of argv
  set mitZeit to ((item 2 of argv) is "1")
  set ln to item 8 of argv
  tell application "Reminders"
    set l to missing value
    if ln is not "" then
      try
        set l to first list whose name is ln
      end try
    end if
    if l is missing value then
      try
        set l to default list
      on error
        set l to first list
      end try
    end if
    if mitZeit then
      set d to my machDatum((item 3 of argv) as integer, (item 4 of argv) as integer, (item 5 of argv) as integer, (item 6 of argv) as integer, (item 7 of argv) as integer)
      make new reminder at end of reminders of l with properties {name:t, due date:d}
    else
      make new reminder at end of reminders of l with properties {name:t}
    end if
    return name of l
  end tell
end run`;

const ERINNERUNG_ERLEDIGT = `
on run argv
  set t to item 1 of argv
  tell application "Reminders"
    set r to first reminder whose name is t and completed is false
    set completed of r to true
  end tell
  return "ok"
end run`;

// ---------- Nachrichten (iMessage/SMS) & FaceTime ----------
// Empfänger und Text kommen als argv, nie in den Code. Erst iMessage, sonst SMS übers iPhone (SMS-Weiterleitung).
const NACHRICHT_SENDEN = `
on run argv
  set ziel to item 1 of argv
  set txt to item 2 of argv
  tell application "Messages"
    try
      set svc to 1st account whose service type = iMessage
      send txt to participant ziel of svc
      return "iMessage"
    on error e1
      try
        set svc to 1st account whose service type = SMS
        send txt to participant ziel of svc
        return "SMS"
      on error
        error e1
      end try
    end try
  end tell
end run`;
const zielOk = (s) => /^\+\d{5,16}$/.test(s) || /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(s);

// Läuft Kalender/Erinnerungen/Nachrichten gerade nicht, meldet macOS "-600 Das Programm läuft nicht".
// Dann das Programm unsichtbar im Hintergrund starten und es einmal neu versuchen.
const laeuftNicht = (err) => /\(-600\)|läuft nicht|isn.t running|not running/i.test(String(err?.message || ""));
async function appStarten(name) {
  try { await run("open", ["-gj", "-a", name], 8000); } catch { return; }
  for (let i = 0; i < 20; i++) {
    try { await run("pgrep", ["-x", name], 2000); await new Promise((r) => setTimeout(r, 600)); return; } catch { /* noch nicht da */ }
    await new Promise((r) => setTimeout(r, 300));
  }
}
async function osaFile(script, args, timeout) {
  const los = () => run("osascript", ["-e", script, ...args.map(String)], timeout);
  try {
    return await los();
  } catch (err) {
    const app = script.match(/tell application "([^"]+)"/)?.[1];
    if (!app || !laeuftNicht(err)) throw err;
    await appStarten(app);
    return los();
  }
}
const zeitArgs = (z) => (z = z || {}, [zahl(z.y, 2000, 2100, 2026), zahl(z.m, 1, 12, 1), zahl(z.d, 1, 31, 1), zahl(z.h, 0, 23, 9), zahl(z.mi, 0, 59, 0)]);


// ---------- v1.134.0: Apple Notizen, Kontakte, Musik (Idee aus OpenJarvis) ----------
// Wie beim Kalender: Texte gehen als argv an AppleScript, nie in den Code. Zeiten als Sekunden ab heute 0:00.
const NOTIZEN_LISTE = `
on run argv
  set RS to character id 30
  set US to character id 31
  set basis to current date
  set time of basis to 0
  set out to ""
  tell application "Notes"
    set ns to name of every note
    set ids to id of every note
    set ds to modification date of every note
    repeat with i from 1 to count of ns
      set out to out & (item i of ns) & US & (item i of ids) & US & (((item i of ds) - basis) as integer as text) & RS
    end repeat
  end tell
  return out
end run`;

const NOTIZEN_SUCHEN = `
on run argv
  set q to item 1 of argv
  set RS to character id 30
  set US to character id 31
  set basis to current date
  set time of basis to 0
  set out to ""
  set n to 0
  tell application "Notes"
    try
      set treffer to (every note whose plaintext contains q)
    on error
      set treffer to (every note whose name contains q)
    end try
    repeat with nt in treffer
      set n to n + 1
      if n > 15 then exit repeat
      set t to plaintext of nt
      if (length of t) > 1500 then set t to text 1 thru 1500 of t
      set out to out & (name of nt) & US & (id of nt) & US & (((modification date of nt) - basis) as integer as text) & US & t & RS
    end repeat
  end tell
  return out
end run`;

const NOTIZ_LESEN = `
on run argv
  set nid to item 1 of argv
  tell application "Notes"
    set nt to note id nid
    set t to plaintext of nt
    if (length of t) > 20000 then set t to text 1 thru 20000 of t
    return (name of nt) & (character id 31) & t
  end tell
end run`;

const NOTIZ_NEU = `
on run argv
  set b to item 1 of argv
  set fn to item 2 of argv
  tell application "Notes"
    set ziel to missing value
    if fn is not "" then
      try
        set ziel to folder fn
      end try
    end if
    if ziel is missing value then set ziel to default folder of default account
    set nt to make new note at ziel with properties {body:b}
    return (name of ziel)
  end tell
end run`;

const KONTAKTE_SUCHEN = `
on run argv
  set q to item 1 of argv
  set RS to character id 30
  set US to character id 31
  set GS to character id 29
  set out to ""
  set n to 0
  tell application "Contacts"
    try
      set treffer to (every person whose name contains q or nickname contains q or organization contains q)
    on error
      set treffer to (every person whose name contains q)
    end try
    repeat with p in treffer
      set n to n + 1
      if n > 12 then exit repeat
      set tel to ""
      repeat with x in phones of p
        set tel to tel & (label of x as text) & ": " & (value of x) & GS
      end repeat
      set em to ""
      repeat with x in emails of p
        set em to em & (value of x) & GS
      end repeat
      set gb to ""
      try
        set d to birth date of p
        if d is not missing value then set gb to ((year of d) as text) & "-" & ((month of d as integer) as text) & "-" & ((day of d) as text)
      end try
      set org to ""
      try
        set org to organization of p
        if org is missing value then set org to ""
      end try
      set nn to ""
      try
        set nn to nickname of p
        if nn is missing value then set nn to ""
      end try
      set out to out & (name of p) & US & tel & US & em & US & gb & US & org & US & nn & RS
    end repeat
  end tell
  return out
end run`;

const KONTAKTE_GEBURTSTAGE = `
on run argv
  set RS to character id 30
  set US to character id 31
  set out to ""
  tell application "Contacts"
    set ps to (every person whose birth date is not missing value)
    repeat with p in ps
      set d to birth date of p
      set out to out & (name of p) & US & ((year of d) as text) & "-" & ((month of d as integer) as text) & "-" & ((day of d) as text) & RS
    end repeat
  end tell
  return out
end run`;

const MUSIK_STATUS = `
on run argv
  set US to character id 31
  if not (application "Music" is running) then return "stopped"
  tell application "Music"
    set st to player state as text
    if st is "stopped" then return st
    set t to current track
    return st & US & (name of t) & US & (artist of t) & US & (album of t) & US & ((shuffle enabled) as text)
  end tell
end run`;

const MUSIK_PLAYLISTS = `
on run argv
  set RS to character id 30
  set out to ""
  tell application "Music"
    repeat with p in (every user playlist)
      set out to out & (name of p) & RS
    end repeat
  end tell
  return out
end run`;

const MUSIK_PLAYLIST_SPIELEN = `
on run argv
  set q to item 1 of argv
  tell application "Music"
    set ps to (every user playlist whose name is q)
    if (count of ps) is 0 then set ps to (every user playlist whose name contains q)
    if (count of ps) is 0 then error "Keine Playlist mit diesem Namen"
    set p to item 1 of ps
    play p
    return name of p
  end tell
end run`;

const MUSIK_SUCHEN_SPIELEN = `
on run argv
  set q to item 1 of argv
  set RS to character id 30
  set US to character id 31
  tell application "Music"
    set ts to search playlist "Library" for q
    if (count of ts) is 0 then error "Nichts in deiner Musik gefunden"
    play item 1 of ts
    set out to ""
    set n to 0
    repeat with t in ts
      set n to n + 1
      if n > 8 then exit repeat
      set out to out & (name of t) & US & (artist of t) & RS
    end repeat
    return out
  end tell
end run`;

const MUSIK_ZUFALL = `
on run argv
  tell application "Music"
    set shuffle enabled to ((item 1 of argv) is "1")
    return (shuffle enabled) as text
  end tell
end run`;

const htmlEsc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const actions = {
  async open_app({ value }) {
    await run("open", ["-a", value]);
    return `${value} geöffnet`;
  },
  async quit_app({ value }) {
    await osa('tell application (item 1 of argv) to quit', value);
    return `${value} beendet`;
  },
  async open_url({ value }) {
    if (!/^https?:\/\//i.test(value)) throw new Error("Nur http- und https-Links erlaubt");
    await run("open", [value]);
    return "Link geöffnet";
  },
  async volume_set({ value }) {
    await osa("set volume output volume (item 1 of argv as integer)", clampVolume(value));
    return `Lautstärke ${clampVolume(value)} %`;
  },
  async volume_up() {
    await osa("set volume output volume ((output volume of (get volume settings)) + 10)");
    return "Lauter";
  },
  async volume_down() {
    await osa("set volume output volume ((output volume of (get volume settings)) - 10)");
    return "Leiser";
  },
  async mute() {
    await osa("set volume output muted (not (output muted of (get volume settings)))");
    return "Ton umgeschaltet";
  },
  async music_play_pause() {
    await osa("tell application (item 1 of argv) to playpause", MUSIC_APP);
    return "Musik umgeschaltet";
  },
  async music_next() {
    await osa("tell application (item 1 of argv) to next track", MUSIC_APP);
    return "Nächster Titel";
  },
  async music_previous() {
    await osa("tell application (item 1 of argv) to previous track", MUSIC_APP);
    return "Vorheriger Titel";
  },
  async say({ value }) {
    await run("say", ["-v", SAY_VOICE, String(value).slice(0, 1000)], 60000);
    return "Gesagt";
  },
  async notify({ value }) {
    await osa('display notification (item 1 of argv) with title "F.R.Ai.D.A.Y"', String(value).slice(0, 300));
    return "Mitteilung gezeigt";
  },
  async lock_screen() {
    await osa('tell application "System Events" to keystroke "q" using {control down, command down}');
    return "Mac gesperrt";
  },
  async sleep_display() {
    await run("pmset", ["displaysleepnow"]);
    return "Bildschirm aus";
  },
  async battery() {
    return await run("pmset", ["-g", "batt"]);
  },
  async system_info() {
    const info = {};
    try {
      const b = await run("pmset", ["-g", "batt"]);
      info.akku = Number(b.match(/(\d+)%/)?.[1] ?? null);
      info.akku_laedt = /AC Power|charging/i.test(b) && !/discharging/i.test(b);
    } catch { /* egal */ }
    try {
      const cores = os.cpus().length || 1;
      info.cpu_prozent = Math.min(100, Math.round((os.loadavg()[0] / cores) * 100));
      info.kerne = cores;
    } catch { /* egal */ }
    try {
      const pm = await run("top", ["-l", "1", "-n", "0"]);
      const m = pm.match(/PhysMem:\s*([\d.]+)([MG])\s*used.*?([\d.]+)([MG])\s*unused/i);
      const toGb = (n, u) => (u.toUpperCase() === "G" ? +n : +n / 1024);
      const totalGb = os.totalmem() / 1e9;
      const used = m ? toGb(m[1], m[2]) : (os.totalmem() - os.freemem()) / 1e9;
      info.ram_benutzt_gb = Math.round(used * 10) / 10;
      info.ram_gesamt_gb = Math.round(totalGb * 10) / 10;
      info.ram_prozent = Math.round((used / totalGb) * 100);
    } catch { /* egal */ }
    try {
      const d = await run("df", ["-k", "/"]);
      const parts = d.split("\n")[1].split(/\s+/);
      const totalGb = +parts[1] / 1048576, usedGb = +parts[2] / 1048576;
      info.disk_benutzt_gb = Math.round(usedGb);
      info.disk_gesamt_gb = Math.round(totalGb);
      info.disk_prozent = Math.round((usedGb / totalGb) * 100);
    } catch { /* egal */ }
    try {
      const ifs = os.networkInterfaces();
      let ip = "";
      for (const arr of Object.values(ifs)) for (const a of arr) if (a.family === "IPv4" && !a.internal) ip = a.address;
      let ssid = "";
      try { const w = await run("/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport", ["-I"]); ssid = w.match(/ SSID: (.+)/)?.[1]?.trim() || ""; } catch { /* egal */ }
      info.netzwerk = ssid || (ip ? "Verbunden" : "Getrennt");
      info.ip = ip;
    } catch { /* egal */ }
    try {
      const t = await run("pmset", ["-g", "therm"]);
      const limit = Number(t.match(/CPU_Speed_Limit\s*=\s*(\d+)/)?.[1] ?? 100);
      info.temp = limit >= 100 ? "normal" : limit >= 60 ? "erhöht" : "heiß";
    } catch { info.temp = "normal"; }
    // Aktive Programme (nach CPU)
    try {
      const ps = await run("ps", ["-arcwwwxo", "comm,%cpu"]);
      const seen = new Set(); const apps = [];
      for (const line of ps.split("\n").slice(1)) {
        const m = line.trim().match(/^(.+?)\s+([\d.]+)$/);
        if (!m) continue;
        let name = m[1].trim(); const cpu = Math.round(+m[2]);
        if (/^(kernel_task|WindowServer|launchd|ps|top|loginwindow|coreaudiod|hidd)$/i.test(name)) continue;
        name = name.replace(/\.app$/i, "");
        if (seen.has(name)) continue; seen.add(name);
        apps.push({ name, cpu });
        if (apps.length >= 5) break;
      }
      info.prozesse = apps;
    } catch { /* egal */ }
    return info;
  },
  async dark_mode_toggle() {
    await osa('tell application "System Events" to tell appearance preferences to set dark mode to not dark mode');
    return "Design umgeschaltet";
  },
  async find_file({ value }) {
    const out = await run("mdfind", ["-name", String(value)], 25000);
    const files = out.split("\n").filter(Boolean).slice(0, 10);
    return files.length ? files.join("\n") : "Nichts gefunden";
  },
  async kalender_termine({ value }) {
    const v = jsonVal(value);
    const out = await osaFile(KALENDER_TERMINE, [zahl(v.von, -400, 400, 0), zahl(v.tage, 1, 62, 1), String(v.kalender || "").slice(0, 80)], 45000);
    return { termine: zeilen(out).map(([titel, s, e, ganz, kal, rrule]) => ({ titel, s: Number(s), e: Number(e), ganz: ganz === "true", kal, rrule: rrule || "" })) };
  },
  async kalender_neu({ value }) {
    const v = jsonVal(value);
    const titel = String(v.titel || "").trim().slice(0, 200);
    if (!titel) throw new Error("Termin ohne Titel");
    const kal = await osaFile(KALENDER_NEU, [titel, ...zeitArgs(v.zeit), zahl(v.dauer, 5, 1440, 60), v.ganztag ? "1" : "0", String(v.kalender || "").slice(0, 80), String(v.ort || "").slice(0, 120)], 30000);
    return { kalender: kal };
  },
  async kalender_namen() {
    const out = await osaFile(KALENDER_NAMEN, [], 20000);
    return { kalender: zeilen(out).map((z) => z[0]) };
  },
  async erinnerungen_liste() {
    const out = await osaFile(ERINNERUNGEN_LISTE, [], 45000);
    return { erinnerungen: zeilen(out).map(([titel, faellig, liste]) => ({ titel, faellig: faellig === "" || faellig == null ? null : Number(faellig), liste })) };
  },
  async erinnerungen_neu({ value }) {
    const v = jsonVal(value);
    const titel = String(v.titel || "").trim().slice(0, 200);
    if (!titel) throw new Error("Erinnerung ohne Text");
    const liste = await osaFile(ERINNERUNGEN_NEU, [titel, v.zeit ? "1" : "0", ...zeitArgs(v.zeit), String(v.liste || "").slice(0, 80)], 30000);
    return { liste };
  },
  async erinnerungen_erledigt({ value }) {
    const titel = String(jsonVal(value).titel || "").slice(0, 200);
    if (!titel) throw new Error("Welche Erinnerung?");
    await osaFile(ERINNERUNG_ERLEDIGT, [titel], 30000);
    return "Erledigt";
  },
  async nachricht_senden({ value }) {
    const v = jsonVal(value);
    const an = String(v.an || "").trim();
    const text = String(v.text || "").trim().slice(0, 2000);
    if (!zielOk(an)) throw new Error("Ungültige Nummer");
    if (!text) throw new Error("Leere Nachricht");
    const weg = await osaFile(NACHRICHT_SENDEN, [an, text], 25000);
    return { weg: weg || "iMessage" };
  },
  async anruf_starten({ value }) {
    const an = String(jsonVal(value).an || "").trim();
    if (!zielOk(an)) throw new Error("Ungültige Nummer");
    await run("open", [`facetime-audio://${encodeURIComponent(an).replace(/%2B/g, "+").replace(/%40/g, "@")}`]);
    return "Anruf gestartet";
  },
  // v1.134.0: Apple Notizen
  async notizen_liste({ value }) {
    const v = jsonVal(value);
    const out = await osaFile(NOTIZEN_LISTE, [], 60000);
    const alle = zeilen(out).map(([name, id, s]) => ({ name, id, s: Number(s) }));
    alle.sort((a, b) => b.s - a.s);
    return { notizen: alle.slice(0, zahl(v.anzahl, 1, 200, 30)), gesamt: alle.length };
  },
  async notizen_suchen({ value }) {
    const q = String(jsonVal(value).text || "").trim().slice(0, 100);
    if (!q) throw new Error("Wonach soll ich suchen?");
    const out = await osaFile(NOTIZEN_SUCHEN, [q], 60000);
    return { notizen: zeilen(out).map(([name, id, s, text]) => ({ name, id, s: Number(s), text })) };
  },
  async notiz_lesen({ value }) {
    const id = String(jsonVal(value).id || "");
    if (!/^x-coredata:\/\//.test(id)) throw new Error("Ungültige Notiz");
    const out = await osaFile(NOTIZ_LESEN, [id], 30000);
    const [name, ...rest] = out.split(US);
    return { name, text: rest.join(US) };
  },
  async notiz_neu({ value }) {
    const v = jsonVal(value);
    const titel = String(v.titel || "").trim().slice(0, 200);
    const text = String(v.text || "").trim().slice(0, 20000);
    if (!titel && !text) throw new Error("Leere Notiz");
    const body = `<div><h1>${htmlEsc(titel || text.split("\n")[0].slice(0, 60))}</h1></div>${text.split("\n").map((z) => `<div>${htmlEsc(z) || "<br>"}</div>`).join("")}`;
    const ordner = await osaFile(NOTIZ_NEU, [body, String(v.ordner || "").slice(0, 80)], 30000);
    return { ordner };
  },
  // v1.134.0: Apple Kontakte
  async kontakte_suchen({ value }) {
    const q = String(jsonVal(value).name || "").trim().slice(0, 80);
    if (!q) throw new Error("Wen soll ich suchen?");
    const GS = String.fromCharCode(29);
    const out = await osaFile(KONTAKTE_SUCHEN, [q], 45000);
    return { kontakte: zeilen(out).map(([name, tel, em, gb, org, spitz]) => ({ name, telefon: String(tel || "").split(GS).filter(Boolean), email: String(em || "").split(GS).filter(Boolean), geburtstag: gb || "", firma: org || "", spitzname: spitz || "" })) };
  },
  async kontakte_geburtstage() {
    const out = await osaFile(KONTAKTE_GEBURTSTAGE, [], 60000);
    return { geburtstage: zeilen(out).map(([name, gb]) => ({ name, geburtstag: gb })) };
  },
  // v1.134.0: Apple Musik (Music-App)
  async musik_status() {
    const out = await osaFile(MUSIK_STATUS, [], 15000);
    const [zustand, titel, kuenstler, album, zufall] = out.split(US);
    return { zustand, titel: titel || "", kuenstler: kuenstler || "", album: album || "", zufall: zufall === "true" };
  },
  async musik_playlists() {
    const out = await osaFile(MUSIK_PLAYLISTS, [], 30000);
    return { playlists: out.split(RS).filter(Boolean) };
  },
  async musik_playlist({ value }) {
    const q = String(jsonVal(value).name || "").trim().slice(0, 100);
    if (!q) throw new Error("Welche Playlist?");
    return { playlist: await osaFile(MUSIK_PLAYLIST_SPIELEN, [q], 30000) };
  },
  async musik_suchen({ value }) {
    const q = String(jsonVal(value).text || "").trim().slice(0, 100);
    if (!q) throw new Error("Was soll ich spielen?");
    const out = await osaFile(MUSIK_SUCHEN_SPIELEN, [q], 45000);
    return { titel: zeilen(out).map(([name, kuenstler]) => ({ name, kuenstler })) };
  },
  async musik_zufall({ value }) {
    const an = jsonVal(value).an !== false;
    return { zufall: (await osaFile(MUSIK_ZUFALL, [an ? "1" : "0"], 15000)) === "true" };
  },
  async screenshot_look() {
    const file = path.join(os.tmpdir(), `friday-${Date.now()}.jpg`);
    try {
      try {
        await run("screencapture", ["-x", "-t", "jpg", file]);
      } catch (err) {
        if (/could not create image|display/i.test(err.message)) {
          throw new Error("Der Mac liefert kein Bildschirmbild. Entweder ist der Bildschirm gesperrt bzw. aus, oder Node darf keine Bildschirmaufnahmen machen (Systemeinstellungen → Datenschutz & Sicherheit → Bildschirm- & Systemaudioaufnahme → node einschalten).");
        }
        throw err;
      }
      await run("sips", ["-Z", "1600", file]);
      return { image: fs.readFileSync(file).toString("base64") };
    } finally {
      fs.rmSync(file, { force: true });
    }
  },
};

let retryDelay = 2000;

function connect() {
  const ws = new WebSocket(SERVER_URL, { headers: { "x-agent-token": AGENT_TOKEN } });

  ws.on("open", () => {
    retryDelay = 2000;
    console.log(`Verbunden mit ${SERVER_URL}`);
    ws.send(JSON.stringify({ type: "hello", name: os.hostname() }));
  });

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type !== "command") return;
    const handler = Object.hasOwn(actions, msg.action) ? actions[msg.action] : null;
    let reply;
    if (!handler) reply = { ok: false, error: "Unbekannte Aktion" };
    else {
      try {
        const result = await handler({ value: String(msg.params?.value ?? "") });
        reply = typeof result === "object" ? { ok: true, ...result } : { ok: true, result };
      } catch (err) {
        reply = { ok: false, error: err.message };
      }
    }
    // Routine-Abfragen (alle paar Sekunden) nur bei Fehlern ins Protokoll, sonst wird es riesig.
    if (!reply.ok || !LEISE_AKTIONEN.has(msg.action)) console.log(`${msg.action}: ${reply.ok ? "ok" : reply.error}`);
    ws.send(JSON.stringify({ type: "result", id: msg.id, ...reply }));
  });

  ws.on("close", () => {
    console.log(`Getrennt. Neuer Versuch in ${retryDelay / 1000} s`);
    setTimeout(connect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 60000);
  });

  ws.on("error", (err) => console.error("Verbindungsfehler:", err.message));
}

connect();
