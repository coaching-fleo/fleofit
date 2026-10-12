import UIKit
import Vision
import Capacitor

// «Da un testo scritto», fase 2 (12/10/2026): la FOTO di un workout — una
// lavagna, un foglio, uno screenshot — letta con Apple Vision.
//
// Tutto sul telefono: niente IA generativa, niente rete, niente quota. La foto
// non lascia mai il dispositivo. Vision restituisce le righe con la loro
// posizione; a metterle in ordine (le lavagne su due colonne) e a trasformarle
// in blocchi ci pensa il JavaScript: src/lib/testoDaFoto.js e leggiWorkout.js.
//
// ⚠️ È un plugin DELL'APP, non un pacchetto npm: Capacitor non lo trova da sé.
// Lo registra `FleoBridgeViewController` qui sotto, che SceneDelegate usa come
// radice al posto di CAPBridgeViewController. Il gemello Android è
// LettoreTestoPlugin.java (ML Kit), registrato in MainActivity; sul web non c'è,
// e il JS lo sa da `Capacitor.isPluginAvailable('LettoreTesto')`.

@objc(LettoreTestoPlugin)
public class LettoreTestoPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LettoreTestoPlugin"
    public let jsName = "LettoreTesto"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "leggi", returnType: CAPPluginReturnPromise)
    ]

    /// `{ base64, parole? }` → `{ righe: [{ testo, x, y, w, h, fiducia }] }`.
    /// Le coordinate sono frazioni dell'immagine con l'origine in ALTO a
    /// sinistra (Vision le dà dal basso: si girano qui, una volta sola).
    @objc func leggi(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64"),
              let dati = Data(base64Encoded: base64, options: .ignoreUnknownCharacters),
              let immagine = UIImage(data: dati),
              let cg = immagine.cgImage else {
            call.reject("Immagine non leggibile")
            return
        }

        let richiesta = VNRecognizeTextRequest { richiesta, errore in
            if let errore = errore {
                call.reject(errore.localizedDescription)
                return
            }
            let osservazioni = (richiesta.results as? [VNRecognizedTextObservation]) ?? []
            let righe: [[String: Any]] = osservazioni.compactMap { o in
                guard let migliore = o.topCandidates(1).first else { return nil }
                let b = o.boundingBox
                return [
                    "testo": migliore.string,
                    "x": Double(b.minX),
                    "y": Double(1 - b.maxY),
                    "w": Double(b.width),
                    "h": Double(b.height),
                    "fiducia": Double(migliore.confidence),
                ]
            }
            call.resolve(["righe": righe])
        }
        richiesta.recognitionLevel = .accurate
        richiesta.recognitionLanguages = ["it-IT", "en-US"]
        // La correzione linguistica aiuta molto sullo scritto a mano; le parole
        // del gergo Hyrox («SkiErg», «EMOM», «wall balls») gliele passa il JS,
        // altrimenti le «correggerebbe» in parole italiane.
        richiesta.usesLanguageCorrection = true
        if let parole = call.getArray("parole", String.self), !parole.isEmpty {
            richiesta.customWords = parole
        }

        // Fuori dal thread principale: su una foto grande `.accurate` può
        // metterci più di un secondo, e la webview non deve bloccarsi.
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                // `.up`: l'immagine arriva da un canvas, che l'ha già raddrizzata.
                try VNImageRequestHandler(cgImage: cg, orientation: .up, options: [:]).perform([richiesta])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }
}

/// La radice della webview, con i plugin dell'app registrati. È il modo
/// documentato da Capacitor per i plugin locali: `capacitorDidLoad` arriva
/// quando il bridge esiste e prima che la pagina carichi.
class FleoBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(LettoreTestoPlugin())
    }
}
