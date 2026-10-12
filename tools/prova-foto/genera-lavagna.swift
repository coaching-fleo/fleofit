// La «lavagna» di prova di «Da un testo scritto»: due colonne scritte con un
// carattere che imita la calligrafia, e un titolo al centro che scavalca lo
// spazio fra le colonne (il caso che il 12/10/2026 le fondeva).
// Solo macOS: swift tools/prova-foto/genera-lavagna.swift lavagna.jpg
// L'immagine già generata è lavagna-due-colonne.jpg, accanto a questo file.
import AppKit
let W = 1600.0, H = 1200.0
let img = NSImage(size: NSSize(width: W, height: H))
img.lockFocus()
NSColor(white: 0.96, alpha: 1).setFill(); NSRect(x: 0, y: 0, width: W, height: H).fill()
let font = NSFont(name: "Noteworthy-Bold", size: 58) ?? NSFont.systemFont(ofSize: 58)
let attr: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: NSColor(calibratedRed: 0.1, green: 0.15, blue: 0.5, alpha: 1)]
func scrivi(_ s: String, _ x: Double, _ yTop: Double) { (s as NSString).draw(at: NSPoint(x: x, y: H - yTop - 70), withAttributes: attr) }
scrivi("HYROX SATURDAY", 480, 50)
let sx = ["Warm up 10'", "500m row", "EMOM 12'", "min 1: 15 cal ski", "min 2: 12 burpees", "min 3: rest"]
let dx = ["4 RFT", "1000m ski", "50m sled push 150kg", "20 wall balls 9kg", "rest 3'"]
for (i, s) in sx.enumerated() { scrivi(s, 70, 200 + Double(i) * 150) }
for (i, s) in dx.enumerated() { scrivi(s, 880, 200 + Double(i) * 150) }
img.unlockFocus()
let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
try! rep.representation(using: .jpeg, properties: [.compressionFactor: 0.85])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
