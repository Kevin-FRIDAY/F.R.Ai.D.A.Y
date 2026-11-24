// Echte Excel-Dateien (.xlsx) ohne Zusatz-Paket (v1.161.0).
// Eine .xlsx ist ein ZIP mit ein paar XML-Dateien. Friday schreibt beides selbst:
// Kopfzeile fett mit orangem Hintergrund, feste Kopfzeile, Filter, Spaltenbreiten, Zahlen als Zahlen
// und Formeln (alles, was mit "=" beginnt, z. B. "=SUM(B2:B10)"). Excel, Numbers und LibreOffice öffnen sie.
import zlib from "node:zlib";

// ---------- ZIP ----------
const CRC_TAB = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TAB[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** dateien: [{name, daten:Buffer|string}] → ZIP-Buffer (Deflate). */
export function zip(dateien) {
  const lokal = [], zentral = [];
  let offset = 0;
  // DOS-Zeit: 2026-01-01 00:00 reicht, Excel prüft das nicht.
  const zeit = 0, datum = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const d of dateien) {
    const name = Buffer.from(d.name, "utf8");
    const roh = Buffer.isBuffer(d.daten) ? d.daten : Buffer.from(String(d.daten), "utf8");
    const gepackt = zlib.deflateRawSync(roh, { level: 9 });
    const crc = crc32(roh);
    const kopf = Buffer.alloc(30);
    kopf.writeUInt32LE(0x04034b50, 0); kopf.writeUInt16LE(20, 4); kopf.writeUInt16LE(0x0800, 6); kopf.writeUInt16LE(8, 8);
    kopf.writeUInt16LE(zeit, 10); kopf.writeUInt16LE(datum, 12); kopf.writeUInt32LE(crc, 14);
    kopf.writeUInt32LE(gepackt.length, 18); kopf.writeUInt32LE(roh.length, 22); kopf.writeUInt16LE(name.length, 26); kopf.writeUInt16LE(0, 28);
    lokal.push(kopf, name, gepackt);
    const z = Buffer.alloc(46);
    z.writeUInt32LE(0x02014b50, 0); z.writeUInt16LE(20, 4); z.writeUInt16LE(20, 6); z.writeUInt16LE(0x0800, 8); z.writeUInt16LE(8, 10);
    z.writeUInt16LE(zeit, 12); z.writeUInt16LE(datum, 14); z.writeUInt32LE(crc, 16); z.writeUInt32LE(gepackt.length, 20);
    z.writeUInt32LE(roh.length, 24); z.writeUInt16LE(name.length, 28); z.writeUInt32LE(offset, 42);
    zentral.push(z, name);
    offset += 30 + name.length + gepackt.length;
  }
  const zGroesse = zentral.reduce((s, b) => s + b.length, 0);
  const ende = Buffer.alloc(22);
  ende.writeUInt32LE(0x06054b50, 0); ende.writeUInt16LE(dateien.length, 8); ende.writeUInt16LE(dateien.length, 10);
  ende.writeUInt32LE(zGroesse, 12); ende.writeUInt32LE(offset, 16);
  return Buffer.concat([...lokal, ...zentral, ende]);
}

// ---------- Tabelle ----------
const esc = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function spaltenName(i) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// "12,50 €", "1.234,5", "3.5", "-7" → Zahl; "12.03.2026" bleibt Text (Datum), "0171…" bleibt Text.
export function alsZahl(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.trim().replace(/\s?(€|eur|euro|\$|%)$/i, "").trim();
  if (!s || /^0\d/.test(s) || /^\+/.test(s)) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && Math.abs(n) < 1e15 ? n : null;
}
const istGeld = (v) => typeof v === "string" && /(€|eur|euro)\s*$/i.test(v.trim());
const istProzent = (v) => typeof v === "string" && /%\s*$/.test(v.trim());

function zelle(ref, v, kopf) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "boolean") return `<c r="${ref}" t="b"${kopf ? ' s="1"' : ""}><v>${v ? 1 : 0}</v></c>`;
  if (!kopf && typeof v === "string" && v.trim().startsWith("=") && v.trim().length > 1) {
    return `<c r="${ref}" s="2"><f>${esc(v.trim().slice(1))}</f></c>`;
  }
  const n = kopf ? null : alsZahl(v);
  if (n !== null) {
    const stil = istProzent(v) ? 4 : istGeld(v) ? 3 : 2;
    return `<c r="${ref}" s="${stil}"><v>${istProzent(v) ? n / 100 : n}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"${kopf ? ' s="1"' : ""}><is><t xml:space="preserve">${esc(String(v).slice(0, 32000))}</t></is></c>`;
}

function blattXml({ spalten = [], zeilen = [] }) {
  const mitKopf = spalten.length > 0;
  const alle = mitKopf ? [spalten, ...zeilen] : zeilen;
  const breite = Math.max(1, ...alle.map((z) => z.length));
  const breiten = [];
  for (let c = 0; c < breite; c++) {
    const l = Math.max(6, ...alle.map((z) => String(z[c] ?? "").length));
    breiten.push(Math.min(60, l + 2));
  }
  const rows = alle.map((z, r) => {
    const zellen = [];
    for (let c = 0; c < z.length; c++) zellen.push(zelle(`${spaltenName(c)}${r + 1}`, z[c], r === 0 && mitKopf));
    return `<row r="${r + 1}">${zellen.join("")}</row>`;
  }).join("");
  const letzte = `${spaltenName(breite - 1)}${Math.max(1, alle.length)}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0">${mitKopf ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ""}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${breiten.map((b, i) => `<col min="${i + 1}" max="${i + 1}" width="${b}" customWidth="1"/>`).join("")}</cols>
<sheetData>${rows}</sheetData>${mitKopf && alle.length > 1 ? `<autoFilter ref="A1:${letzte}"/>` : ""}
</worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFF7A1A"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

// Blattnamen: max. 31 Zeichen, ohne : \ / ? * [ ], eindeutig.
export function blattName(n, vergeben) {
  let s = String(n || "Tabelle").replace(/[:\\/?*[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Tabelle";
  let x = s;
  for (let i = 2; vergeben.has(x.toLowerCase()); i++) x = `${s.slice(0, 28)} ${i}`;
  vergeben.add(x.toLowerCase());
  return x;
}

/**
 * Baut eine .xlsx.
 * @param {{name:string, spalten:any[], zeilen:any[][]}[]} blaetter
 * @returns {Buffer}
 */
export function baueXlsx(blaetter, { titel = "Friday" } = {}) {
  const vergeben = new Set();
  const liste = (blaetter.length ? blaetter : [{ name: "Tabelle", spalten: [], zeilen: [] }]).map((b) => ({ ...b, name: blattName(b.name, vergeben) }));
  const dateien = [
    { name: "[Content_Types].xml", daten: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${liste.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { name: "_rels/.rels", daten: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: "docProps/core.xml", daten: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(titel)}</dc:title><dc:creator>F.R.Ai.D.A.Y</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</dcterms:created></cp:coreProperties>` },
    { name: "xl/workbook.xml", daten: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${liste.map((b, i) => `<sheet name="${esc(b.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", daten: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${liste.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${liste.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", daten: STYLES },
    ...liste.map((b, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, daten: blattXml(b) })),
  ];
  return zip(dateien);
}
