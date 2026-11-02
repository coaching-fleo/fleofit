import Foundation
import UIKit
import AVFoundation
import Capacitor

// Collegare la TV con il QR (30/10/2026): la fotocamera legge il codice
// `fleofit://tv/<codice>` mostrato dalla TV. Gemello di LettoreQRPlugin.java
// (Android): stesso nome, stesso metodo, stessa risposta, così il JS
// (src/lib/lettoreQR.js) non sa quale dei due usa.
//
// È un plugin DELL'APP, come LettoreTesto: lo registra FleoBridgeViewController
// (in LettoreTesto.swift). Il permesso fotocamera si chiede solo qui, al tocco
// su «Inquadra il QR». Nessuna libreria: AVFoundation, iOS 15.

@objc(LettoreQRPlugin)
public class LettoreQRPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LettoreQRPlugin"
    public let jsName = "LettoreQR"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "leggi", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "impostazioni", returnType: CAPPluginReturnPromise),
    ]

    @objc func leggi(_ call: CAPPluginCall) {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            presenta(call)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] concesso in
                DispatchQueue.main.async {
                    if concesso { self?.presenta(call) } else { call.reject("permesso") }
                }
            }
        default:
            call.reject("permesso")
        }
    }

    @objc func impostazioni(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
            call.resolve()
        }
    }

    private func presenta(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let radice = self?.bridge?.viewController else {
                call.reject("non_disponibile")
                return
            }
            let scanner = ScannerQRViewController { esito in
                if let valore = esito {
                    call.resolve(["valore": valore])
                } else {
                    call.resolve(["annullato": true])
                }
            }
            // A tutto schermo: così non si chiude con lo swipe e la
            // risoluzione arriva solo dai nostri due punti d'uscita.
            scanner.modalPresentationStyle = .fullScreen
            radice.present(scanner, animated: true)
        }
    }
}

/// La schermata della fotocamera. `finito` parte UNA volta sola: col valore
/// letto, o con nil se si tocca «Annulla».
final class ScannerQRViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    private let sessione = AVCaptureSession()
    private let codaSessione = DispatchQueue(label: "it.federicoleo.fleofit.lettoreqr")
    private var anteprima: AVCaptureVideoPreviewLayer?
    private var finito: ((String?) -> Void)?
    private var concluso = false

    init(finito: @escaping (String?) -> Void) {
        self.finito = finito
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) non usato") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        if let camera = AVCaptureDevice.default(for: .video),
           let ingresso = try? AVCaptureDeviceInput(device: camera),
           sessione.canAddInput(ingresso) {
            sessione.addInput(ingresso)
            let uscita = AVCaptureMetadataOutput()
            if sessione.canAddOutput(uscita) {
                sessione.addOutput(uscita)
                uscita.setMetadataObjectsDelegate(self, queue: .main)
                uscita.metadataObjectTypes = [.qr]
            }
        }

        let layer = AVCaptureVideoPreviewLayer(session: sessione)
        layer.videoGravity = .resizeAspectFill
        layer.frame = view.bounds
        view.layer.addSublayer(layer)
        anteprima = layer

        // Il riquadro centrale, solo contorno.
        let riquadro = UIView()
        riquadro.translatesAutoresizingMaskIntoConstraints = false
        riquadro.layer.borderColor = UIColor.white.cgColor
        riquadro.layer.borderWidth = 3
        riquadro.layer.cornerRadius = 24
        riquadro.isUserInteractionEnabled = false
        view.addSubview(riquadro)

        let etichetta = UILabel()
        etichetta.translatesAutoresizingMaskIntoConstraints = false
        etichetta.text = "Inquadra il QR sulla TV"
        etichetta.textColor = .white
        etichetta.font = .systemFont(ofSize: 17, weight: .bold)
        etichetta.textAlignment = .center
        view.addSubview(etichetta)

        let annulla = UIButton(type: .system)
        annulla.translatesAutoresizingMaskIntoConstraints = false
        annulla.setTitle("Annulla", for: .normal)
        annulla.setTitleColor(.white, for: .normal)
        annulla.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        annulla.addTarget(self, action: #selector(annullaTocco), for: .touchUpInside)
        view.addSubview(annulla)

        NSLayoutConstraint.activate([
            riquadro.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            riquadro.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            riquadro.widthAnchor.constraint(equalToConstant: 240),
            riquadro.heightAnchor.constraint(equalToConstant: 240),
            etichetta.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            etichetta.bottomAnchor.constraint(equalTo: riquadro.topAnchor, constant: -24),
            annulla.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            annulla.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24),
        ])
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        anteprima?.frame = view.bounds
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // startRunning blocca: mai sul main thread.
        codaSessione.async { [sessione] in
            if !sessione.isRunning { sessione.startRunning() }
        }
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput,
                        didOutput metadataObjects: [AVMetadataObject],
                        from connection: AVCaptureConnection) {
        guard !concluso,
              let oggetto = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              oggetto.type == .qr,
              let valore = oggetto.stringValue else { return }
        // Niente vibrazione qui: la dà vibraSuccesso (src/lib/aptica.js) nel
        // foglio, a collegamento riuscito — l'aptica passa solo dai sei verbi.
        chiudi(con: valore)
    }

    @objc private func annullaTocco() { chiudi(con: nil) }

    private func chiudi(con valore: String?) {
        guard !concluso else { return }
        concluso = true
        codaSessione.async { [sessione] in
            if sessione.isRunning { sessione.stopRunning() }
        }
        let esito = finito
        finito = nil
        dismiss(animated: true) { esito?(valore) }
    }
}
