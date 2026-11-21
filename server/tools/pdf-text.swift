// Fridays PDF-Leser (Apple PDFKit, kostenlos, auf jedem Mac dabei).
// Aufruf: pdf-text <datei.pdf>  → gibt den Text Seite für Seite aus, Seiten getrennt durch das Zeichen \u{0C} (Seitenvorschub).
import Foundation
import PDFKit

let args = CommandLine.arguments
guard args.count > 1 else {
  FileHandle.standardError.write("Aufruf: pdf-text <datei.pdf>\n".data(using: .utf8)!)
  exit(2)
}
guard let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
  FileHandle.standardError.write("PDF nicht lesbar\n".data(using: .utf8)!)
  exit(3)
}
if doc.isLocked {
  FileHandle.standardError.write("PDF ist mit Passwort geschützt\n".data(using: .utf8)!)
  exit(4)
}
var teile: [String] = []
for i in 0..<doc.pageCount {
  teile.append(doc.page(at: i)?.string ?? "")
}
FileHandle.standardOutput.write(teile.joined(separator: "\u{0C}").data(using: .utf8)!)
