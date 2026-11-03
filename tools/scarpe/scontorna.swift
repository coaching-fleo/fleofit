// Scontorna una foto di scarpa: toglie lo sfondo, ritaglia al soggetto e porta il
// lato lungo a 800 px. Uso: swift tools/scarpe/scontorna.swift ingresso uscita.png
//
// Perché Vision e non un ritocco a mano: le foto prodotto dei marchi sono su fondo
// chiaro e il riconoscimento del soggetto in primo piano (macOS 14+) le separa bene
// senza dipendenze da installare. Il PNG ha il canale alfa, così nell'app la scarpa
// sta su qualunque sfondo.
import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

func esci(_ messaggio: String) -> Never {
    FileHandle.standardError.write(Data((messaggio + "\n").utf8))
    exit(1)
}

let argomenti = CommandLine.arguments
guard argomenti.count == 3 else { esci("Uso: swift scontorna.swift <ingresso> <uscita.png>") }
let urlIn = URL(fileURLWithPath: argomenti[1])
let urlOut = URL(fileURLWithPath: argomenti[2])

guard let sorgente = CGImageSourceCreateWithURL(urlIn as CFURL, nil),
      let immagine = CGImageSourceCreateImageAtIndex(sorgente, 0, nil) else {
    esci("Non riesco a leggere l'immagine: \(argomenti[1])")
}

// La maschera del soggetto: se Vision non trova niente, si esce con errore
// invece di scrivere un PNG vuoto che nessuno noterebbe.
let richiesta = VNGenerateForegroundInstanceMaskRequest()
let gestore = VNImageRequestHandler(cgImage: immagine, options: [:])
do { try gestore.perform([richiesta]) } catch { esci("Vision ha fallito: \(error)") }
guard let risultato = richiesta.results?.first, !risultato.allInstances.isEmpty else {
    esci("Nessun soggetto trovato in \(argomenti[1])")
}

let buffer: CVPixelBuffer
do {
    buffer = try risultato.generateMaskedImage(
        ofInstances: risultato.allInstances, from: gestore, croppedToInstancesExtent: false)
} catch { esci("Maschera non generata: \(error)") }

let contesto = CIContext()
let ci = CIImage(cvPixelBuffer: buffer)
guard let mascherata = contesto.createCGImage(ci, from: ci.extent) else { esci("Immagine mascherata non creata") }

// Ritaglio stretto ai pixel opachi (alfa > 8), cercato sul bitmap RGBA.
let w = mascherata.width, h = mascherata.height
let spazio = CGColorSpaceCreateDeviceRGB()
var dati = [UInt8](repeating: 0, count: w * h * 4)
guard let ctx = CGContext(data: &dati, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                          space: spazio, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
    esci("Contesto grafico non creato")
}
ctx.draw(mascherata, in: CGRect(x: 0, y: 0, width: w, height: h))
var minX = w, minY = h, maxX = -1, maxY = -1
for y in 0..<h { for x in 0..<w where dati[(y * w + x) * 4 + 3] > 8 {
    minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
} }
guard maxX >= minX, maxY >= minY else { esci("Soggetto vuoto in \(argomenti[1])") }
guard let ritagliata = mascherata.cropping(to: CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1)) else {
    esci("Ritaglio fallito")
}

// Lato lungo a 800 px, proporzioni intatte.
let scala = 800.0 / Double(max(ritagliata.width, ritagliata.height))
let nw = max(1, Int((Double(ritagliata.width) * scala).rounded()))
let nh = max(1, Int((Double(ritagliata.height) * scala).rounded()))
guard let ctxOut = CGContext(data: nil, width: nw, height: nh, bitsPerComponent: 8, bytesPerRow: 0,
                             space: spazio, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
    esci("Contesto di uscita non creato")
}
ctxOut.interpolationQuality = .high
ctxOut.draw(ritagliata, in: CGRect(x: 0, y: 0, width: nw, height: nh))
guard let finale = ctxOut.makeImage(),
      let destinazione = CGImageDestinationCreateWithURL(urlOut as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    esci("Scrittura non preparata")
}
CGImageDestinationAddImage(destinazione, finale, nil)
guard CGImageDestinationFinalize(destinazione) else { esci("Scrittura PNG fallita") }
print("\(argomenti[2]): \(nw)x\(nh)")
