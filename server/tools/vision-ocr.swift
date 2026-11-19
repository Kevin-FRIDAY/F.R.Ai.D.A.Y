// Fridays kostenlose Texterkennung auf dem Mac (Apple Vision, auch für Handschrift).
// Aufruf: vision-ocr <bild.jpg> [--spiegeln]  → gibt den erkannten Text Zeile für Zeile aus.
// --spiegeln: Bild vorher waagerecht spiegeln (Frontkamera am Mac liefert manchmal Spiegelschrift).
import Foundation
import Vision
import AppKit

let args = CommandLine.arguments
guard args.count > 1, let bild = NSImage(contentsOfFile: args[1]),
      let cg = bild.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  FileHandle.standardError.write("Bild nicht lesbar\n".data(using: .utf8)!)
  exit(2)
}
let anfrage = VNRecognizeTextRequest()
anfrage.recognitionLevel = .accurate
anfrage.usesLanguageCorrection = true
anfrage.recognitionLanguages = ["de-DE", "en-US"]
if #available(macOS 13.0, *) { anfrage.automaticallyDetectsLanguage = false }
do {
  let richtung: CGImagePropertyOrientation = args.contains("--spiegeln") ? .upMirrored : .up
  try VNImageRequestHandler(cgImage: cg, orientation: richtung, options: [:]).perform([anfrage])
} catch {
  FileHandle.standardError.write("Fehler: \(error)\n".data(using: .utf8)!)
  exit(3)
}
// Zeilen von oben nach unten (Vision: y=0 ist unten), Zeilen auf gleicher Höhe links nach rechts.
let teile = (anfrage.results ?? []).compactMap { b -> (CGRect, String)? in
  guard let t = b.topCandidates(1).first?.string else { return nil }
  return (b.boundingBox, t)
}
let sortiert = teile.sorted { a, b in
  if abs(a.0.midY - b.0.midY) > min(a.0.height, b.0.height) * 0.5 { return a.0.midY > b.0.midY }
  return a.0.minX < b.0.minX
}
var zeilen: [String] = []
var letzte: CGRect? = nil
var luecke: CGFloat = 0
for (box, text) in sortiert {
  if let l = letzte, abs(l.midY - box.midY) <= min(l.height, box.height) * 0.5 {
    zeilen[zeilen.count - 1] += " " + text
  } else {
    // Großer Abstand zur vorigen Zeile = neuer Absatz (Leerzeile), wichtig für Karten-Trennung.
    if let l = letzte { luecke = l.minY - box.maxY; if luecke > box.height * 1.2 { zeilen.append("") } }
    zeilen.append(text)
  }
  letzte = box
}
print(zeilen.joined(separator: "\n"))
