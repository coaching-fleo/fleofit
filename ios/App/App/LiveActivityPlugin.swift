import Foundation
import UIKit
import AVFoundation
import AudioToolbox
import Capacitor
#if canImport(ActivityKit)
import ActivityKit
#endif

// La Live Activity del timer, lato app: la apre, la aggiorna, la chiude.
// La disegna l'estensione FleoTimer (ios/App/FleoTimer/TimerLiveActivity.swift).
//
// ⚠️ È un plugin DELL'APP, come LettoreTesto: lo registra FleoBridgeViewController
// (in LettoreTesto.swift). Il JS lo chiama da src/lib/liveActivity.js, solo su
// iPhone e solo se l'atleta l'ha attivata (switch nelle Impostazioni).
//
// 🔴 COL TELEFONO BLOCCATO IL JS NON GIRA (29/10/2026). Nella prima prova la Live
// Activity restava ferma sullo zero di «Preparati»: il cambio di passo doveva
// mandarlo la webview, sospesa. Ora il JS manda anche il PROGRAMMA dei passi,
// ognuno con l'ora in cui comincia, e qui un orologio nativo li mette in onda da
// solo e suona i beep. Per restare sveglio in background l'app tiene aperta una
// sessione audio (UIBackgroundModes `audio` in Info.plist) che si mescola alla
// musica dell'atleta, come fanno le app di timer per l'allenamento. La sessione
// vive solo finché c'è un passo da mettere in onda.
//
// Le Live Activity esistono da iOS 16.1; l'API che usiamo da 16.2. Sotto, ogni
// metodo risponde «non disponibile» e il timer va avanti come sempre.

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "disponibile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "avvia", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "aggiorna", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "termina", returnType: CAPPluginReturnPromise),
    ]

    // L'orologio che mette in onda il programma. È `AnyObject` perché l'app
    // parte da iOS 15 e una proprietà salvata non può avere un tipo da 16.2.
    private var regiaSalvata: AnyObject?
    @available(iOS 16.2, *)
    private var regia: Regia {
        if let r = regiaSalvata as? Regia { return r }
        let r = Regia()
        regiaSalvata = r
        return r
    }

    // 🔴 UNA LIVE ACTIVITY NON DEVE SOPRAVVIVERE AL TIMER (29/10/2026). Chiudendo
    // l'app dal multitasking il JS non arriva a `termina`, e iOS la lasciava sul
    // blocco schermo e nella Dynamic Island fino a 8 ore. Due reti:
    // - alla chiusura dell'app (arriva perché col timer in corso l'app è sveglia
    //   in background) si chiudono subito;
    // - all'avvio, quelle rimaste sono orfane per forza: il timer non riparte mai
    //   da solo dopo un riavvio, quindi si chiudono anche loro.
    override public func load() {
        guard #available(iOS 16.2, *) else { return }
        Task.detached { await Self.chiudiTutte() }
        NotificationCenter.default.addObserver(forName: UIApplication.willTerminateNotification, object: nil, queue: .main) { _ in
            // Dopo `willTerminate` il processo muore: si aspetta che la chiusura
            // arrivi a iOS, al massimo due secondi.
            let fatto = DispatchSemaphore(value: 0)
            Task.detached {
                await Self.chiudiTutte()
                fatto.signal()
            }
            _ = fatto.wait(timeout: .now() + 2)
        }
    }

    @available(iOS 16.2, *)
    private static func chiudiTutte() async {
        for attivita in Activity<AttivitaTimerAttributes>.activities {
            await attivita.end(nil, dismissalPolicy: .immediate)
        }
    }

    /// `{ valore }`: false se iOS ha spento le Live Activity per FLEOFIT.
    @objc func disponibile(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            call.resolve(["valore": ActivityAuthorizationInfo().areActivitiesEnabled])
        } else {
            call.resolve(["valore": false])
        }
    }

    /// `{ titoloWorkout, categoria, stato, programma, beep }`. Chiude prima quelle
    /// rimaste aperte (un timer chiuso male, l'app uccisa): ce n'è sempre una sola.
    @objc func avvia(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(["avviata": false]); return }
        guard let stato = Self.stato(da: call.getObject("stato")) else { call.reject("Stato mancante"); return }
        let attributi = AttivitaTimerAttributes(
            titoloWorkout: call.getString("titoloWorkout") ?? "Allenamento",
            categoria: call.getString("categoria") ?? ""
        )
        let voci = Regia.programma(da: call, stato: stato)
        let beep = call.getBool("beep") ?? true
        // L'orologio parte subito: finché la Live Activity non esiste i suoi
        // aggiornamenti non trovano niente da cambiare, e non fa danni.
        DispatchQueue.main.async { self.regia.metti(voci, beep: beep) }
        Task {
            for vecchia in Activity<AttivitaTimerAttributes>.activities {
                await vecchia.end(nil, dismissalPolicy: .immediate)
            }
            do {
                _ = try Activity.request(
                    attributes: attributi,
                    content: ActivityContent(state: stato, staleDate: Regia.scadenza(voci, 0)),
                    pushType: nil
                )
                call.resolve(["avviata": true])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    /// `{ stato, programma, beep }`: a ogni cambio di passo e di pausa, non a
    /// ogni secondo. Il programma nuovo sostituisce il vecchio.
    @objc func aggiorna(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        guard let stato = Self.stato(da: call.getObject("stato")) else { call.reject("Stato mancante"); return }
        let voci = Regia.programma(da: call, stato: stato)
        let beep = call.getBool("beep") ?? true
        DispatchQueue.main.async { self.regia.metti(voci, beep: beep) }
        Task {
            await Regia.mostra(stato, scadenza: Regia.scadenza(voci, 0))
            call.resolve()
        }
    }

    /// `{ stato }`: a fine allenamento «Completato» resta 15 minuti sul blocco
    /// schermo; un timer chiuso a metà sparisce subito.
    @objc func termina(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        let stato = Self.stato(da: call.getObject("stato"))
        DispatchQueue.main.async { self.regia.ferma() }
        Task {
            for attivita in Activity<AttivitaTimerAttributes>.activities {
                if let stato = stato, stato.fase == "done" {
                    await attivita.end(ActivityContent(state: stato, staleDate: nil),
                                       dismissalPolicy: .after(Date().addingTimeInterval(15 * 60)))
                } else {
                    await attivita.end(nil, dismissalPolicy: .immediate)
                }
            }
            call.resolve()
        }
    }

    // ───────── Dal JS ─────────

    // Lo stato arriva dal JS con le date in millisecondi e i numeri come NSNumber.
    @available(iOS 16.1, *)
    fileprivate static func stato(da oggetto: JSObject?) -> AttivitaTimerAttributes.ContentState? {
        guard let o = oggetto else { return nil }
        func testo(_ k: String) -> String { (o[k] as? String) ?? "" }
        func numero(_ k: String) -> NSNumber? { o[k] as? NSNumber }
        func data(_ k: String) -> Date? { numero(k).map { Date(timeIntervalSince1970: $0.doubleValue / 1000) } }
        return AttivitaTimerAttributes.ContentState(
            fase: testo("fase"),
            etichetta: testo("etichetta"),
            titolo: testo("titolo"),
            compito: testo("compito"),
            poi: testo("poi"),
            giro: numero("giro")?.intValue ?? 0,
            giri: numero("giri")?.intValue ?? 0,
            colore: testo("colore"),
            inizio: data("inizio"),
            fine: data("fine"),
            restante: numero("restante")?.intValue ?? 0,
            frazione: numero("frazione")?.doubleValue ?? 0,
            inPausa: numero("inPausa")?.boolValue ?? false,
            cronometro: numero("cronometro")?.boolValue ?? false,
            inizioAllenamento: data("inizioAllenamento"),
            fineAllenamento: data("fineAllenamento"),
            avanzamento: numero("avanzamento")?.doubleValue ?? 0,
            totale: numero("totale")?.intValue ?? 0
        )
    }

}

/// L'orologio nativo: mette in onda il programma dei passi all'ora giusta e
/// suona i beep, anche col telefono bloccato e la webview sospesa. Si usa solo
/// dal main thread.
@available(iOS 16.2, *)
final class Regia {
    private var programma: [Voce] = []
    private var inOnda = -1
    private var beepAttivi = true
    private var ultimoBeep = ""
    private var orologio: Timer?
    private var osservatori = false
    private let suoni = Suoni()

    struct Voce {
        let quando: Date
        let stato: AttivitaTimerAttributes.ContentState
    }

    func metti(_ voci: [Voce], beep: Bool) {
        programma = voci
        inOnda = 0
        beepAttivi = beep
        osserva()
        orologio?.invalidate()
        orologio = nil
        guard voci.count > 1 || Self.haBeep(voci.first?.stato) else { lasciaDormire(); return }
        // Un quinto di secondo basta: i beep arrivano entro 0,2 s dal secondo
        // giusto, e un orologio così leggero non pesa sulla batteria.
        let t = Timer(timeInterval: 0.2, repeats: true) { [weak self] _ in self?.tic() }
        RunLoop.main.add(t, forMode: .common)
        orologio = t
        if UIApplication.shared.applicationState == .background { tieniSveglio() }
    }

    private func tic() {
        let adesso = Date()
        guard let i = programma.lastIndex(where: { $0.quando <= adesso }) else { return }

        if i != inOnda {
            inOnda = i
            let stato = programma[i].stato
            let scadenza = Self.scadenza(programma, i)
            Task { await Self.mostra(stato, scadenza: scadenza) }
        }

        suonaSeServe(adesso, i)

        // Finito il programma (ultimo passo, ultimo beep suonato) non c'è più
        // niente da fare: si spegne l'orologio e l'app può tornare a dormire.
        if i == programma.count - 1 {
            let stato = programma[i].stato
            let fine = (Self.haBeep(stato) ? stato.fine : nil) ?? programma[i].quando
            if adesso > fine.addingTimeInterval(3) { ferma() }
        }
    }

    /// I beep del timer, uguali a quelli dell'app: corti a 3, 2, 1, lungo allo
    /// zero (più lungo se dopo c'è la fine). Solo con l'app in background:
    /// davanti li suona già la webview.
    private func suonaSeServe(_ adesso: Date, _ i: Int) {
        guard beepAttivi, UIApplication.shared.applicationState != .active else { return }
        let stato = programma[i].stato
        guard Self.haBeep(stato), let fine = stato.fine else { return }
        let restano = max(0, Int(ceil(fine.timeIntervalSince(adesso))))
        guard restano <= 3, adesso < fine.addingTimeInterval(1) else { return }
        let chiave = "\(programma[i].quando.timeIntervalSince1970)-\(restano)"
        guard chiave != ultimoBeep else { return }
        ultimoBeep = chiave
        if restano > 0 {
            suoni.corto()
        } else {
            let dopoLaFine = i + 1 < programma.count && programma[i + 1].stato.fase == "done"
            suoni.lungo(piuLungo: dopoLaFine)
            AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        }
    }

    func ferma() {
        orologio?.invalidate()
        orologio = nil
        programma = []
        inOnda = -1
        lasciaDormire()
    }

    // ───────── Sveglio in background ─────────

    private func osserva() {
        guard !osservatori else { return }
        osservatori = true
        let centro = NotificationCenter.default
        centro.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self = self, self.orologio != nil else { return }
            self.tieniSveglio()
        }
        centro.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main) { [weak self] _ in
            // Davanti il timer lo guida di nuovo la webview, che al risveglio
            // ricalcola il passo dall'ora (src/lib/avanzaTimer.js).
            self?.lasciaDormire()
        }
    }

    private func tieniSveglio() {
        suoni.accendi()
    }

    private func lasciaDormire() {
        suoni.spegni()
    }

    static func mostra(_ stato: AttivitaTimerAttributes.ContentState, scadenza: Date?) async {
        for attivita in Activity<AttivitaTimerAttributes>.activities {
            await attivita.update(ActivityContent(state: stato, staleDate: scadenza))
        }
    }

    /// Il programma dal JS; se manca (un'app con il JS di prima) è il solo stato di adesso.
    static func programma(da call: CAPPluginCall, stato: AttivitaTimerAttributes.ContentState) -> [Voce] {
        let grezzo = call.getArray("programma") as? [JSObject] ?? []
        let voci: [Voce] = grezzo.compactMap { o in
            guard let ms = o["quando"] as? NSNumber, let s = LiveActivityPlugin.stato(da: o["stato"] as? JSObject) else { return nil }
            return Voce(quando: Date(timeIntervalSince1970: ms.doubleValue / 1000), stato: s)
        }
        return voci.isEmpty ? [Voce(quando: Date(), stato: stato)] : voci.sorted { $0.quando < $1.quando }
    }

    /// Un passo a tempo che scorre: l'unico che ha beep e una fine.
    private static func haBeep(_ stato: AttivitaTimerAttributes.ContentState?) -> Bool {
        guard let s = stato else { return false }
        return !s.inPausa && !s.cronometro && s.fase != "done" && s.fine != nil
    }

    // Il contenuto è «scaduto» se il passo dopo non è arrivato in tempo: con il
    // programma non dovrebbe succedere, ma se l'app viene chiusa da iOS la vista
    // lo dice invece di restare ferma sullo zero.
    static func scadenza(_ voci: [Voce], _ i: Int) -> Date? {
        if i + 1 < voci.count { return voci[i + 1].quando.addingTimeInterval(3) }
        return voci.indices.contains(i) ? voci[i].stato.fine?.addingTimeInterval(1) : nil
    }
}

/// I suoni del timer col telefono bloccato, più il silenzio che tiene l'app
/// sveglia. Tutto generato qui, niente file: tre toni come quelli dell'app.
private final class Suoni {
    private lazy var silenzio = Self.lettore(frequenza: 0, durata: 1)
    private lazy var beepCorto = Self.lettore(frequenza: 600, durata: 0.2)
    private lazy var beepLungo = Self.lettore(frequenza: 1200, durata: 1.0)
    private lazy var beepFinale = Self.lettore(frequenza: 1200, durata: 1.5)
    private var acceso = false

    /// La sessione si mescola alla musica (Spotify non si ferma) e, a differenza
    /// di `ambient`, continua col telefono bloccato.
    func accendi() {
        guard !acceso else { return }
        let sessione = AVAudioSession.sharedInstance()
        osservaInterruzioni()
        do {
            try sessione.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try sessione.setActive(true)
        } catch {
            Self.diario("accendi fallito: \(error.localizedDescription)")
            return
        }
        silenzio?.numberOfLoops = -1
        silenzio?.play()
        acceso = true
        Self.diario("accesa in background")
    }

    /// Restituisce l'audio alla webview, com'era prima del blocco schermo.
    ///
    /// 🔴 Il primo giro (29/10/2026) faceva `setCategory(.ambient, options:
    /// [.mixWithOthers])`: iOS RIFIUTA `mixWithOthers` con `ambient` (vale solo
    /// per playback, playAndRecord e multiRoute), il `try?` taceva e la sessione
    /// restava quella del background. Riaprendo l'app dalla Live Activity la
    /// musica dell'atleta si fermava. Ora si spegne la sessione avvisando le altre
    /// app (`notifyOthersOnDeactivation`) e si torna `ambient` senza opzioni:
    /// `ambient` si mescola già da sé.
    func spegni() {
        guard acceso else { return }
        silenzio?.stop()
        let sessione = AVAudioSession.sharedInstance()
        do { try sessione.setActive(false, options: .notifyOthersOnDeactivation) }
        catch { Self.diario("spegni, setActive(false): \(error.localizedDescription)") }
        do { try sessione.setCategory(.ambient) }
        catch { Self.diario("spegni, ambient: \(error.localizedDescription)") }
        acceso = false
        Self.diario("spenta davanti")
    }

    // Diagnosi nella console di Xcode: se la musica dell'atleta si ferma ancora,
    // qui si vede chi l'ha interrotta e in che stato era la sessione.
    private var interruzioniOsservate = false
    private func osservaInterruzioni() {
        guard !interruzioniOsservate else { return }
        interruzioniOsservate = true
        let centro = NotificationCenter.default
        centro.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { n in
            let tipo = (n.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt) == AVAudioSession.InterruptionType.began.rawValue ? "inizio" : "fine"
            Self.diario("interruzione: \(tipo)")
        }
        centro.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { n in
            let motivo = (n.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt) ?? 0
            Self.diario("cambio di uscita, motivo \(motivo)")
        }
    }

    private static func diario(_ testo: String) {
        let s = AVAudioSession.sharedInstance()
        NSLog("[FLEOFIT audio] %@ · categoria %@ · opzioni %lu · altra musica %@",
              testo, s.category.rawValue, s.categoryOptions.rawValue, s.isOtherAudioPlaying ? "sì" : "no")
    }

    func corto() { suona(beepCorto) }
    func lungo(piuLungo: Bool) { suona(piuLungo ? beepFinale : beepLungo) }

    private func suona(_ lettore: AVAudioPlayer?) {
        guard acceso, let l = lettore else { return }
        l.currentTime = 0
        l.play()
    }

    private static func lettore(frequenza: Double, durata: Double) -> AVAudioPlayer? {
        let l = try? AVAudioPlayer(data: wav(frequenza: frequenza, durata: durata), fileTypeHint: AVFileType.wav.rawValue)
        l?.prepareToPlay()
        return l
    }

    /// Un'onda sinusoidale mono a 16 bit, con 10 ms di attacco e rilascio per
    /// non fare «clic». Frequenza 0 = silenzio.
    private static func wav(frequenza: Double, durata: Double, volume: Double = 0.6) -> Data {
        let campionamento = 44_100
        let n = Int(Double(campionamento) * durata)
        var campioni = [Int16](repeating: 0, count: n)
        if frequenza > 0 {
            for i in 0..<n {
                let t = Double(i) / Double(campionamento)
                let inviluppo = min(1, min(t, durata - t) / 0.01)
                campioni[i] = Int16(sin(2 * .pi * frequenza * t) * volume * inviluppo * 32_767)
            }
        }
        var d = Data()
        func scrivi<T: FixedWidthInteger>(_ v: T) { withUnsafeBytes(of: v.littleEndian) { d.append(contentsOf: $0) } }
        d.append(contentsOf: Array("RIFF".utf8)); scrivi(UInt32(36 + n * 2))
        d.append(contentsOf: Array("WAVE".utf8))
        d.append(contentsOf: Array("fmt ".utf8)); scrivi(UInt32(16)); scrivi(UInt16(1)); scrivi(UInt16(1))
        scrivi(UInt32(campionamento)); scrivi(UInt32(campionamento * 2)); scrivi(UInt16(2)); scrivi(UInt16(16))
        d.append(contentsOf: Array("data".utf8)); scrivi(UInt32(n * 2))
        campioni.withUnsafeBufferPointer { d.append(Data(buffer: $0)) }
        return d
    }
}
