import UIKit
import Capacitor
import AVFoundation

// ⚠️ LA SCADENZA È iOS 27, NON iOS 26. Testuale da Apple («Transitioning to the
// UIKit scene-based life cycle»): «Beginning in iOS 27 … apps built with the latest
// SDK must adopt the scene-based life cycle or they fail to launch». Su iOS 26 il
// sistema scrive soltanto «UIScene lifecycle will soon be required» nel log, e
// l'app parte normalmente.
// Chi vede un EXC_BREAKPOINT su
// __UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption sta guardando il
// *runtime issue breakpoint* di Xcode, che scatta solo col debugger attaccato: su
// una build distribuita non esiste. È già costato un falso allarme il 21/09/2026,
// con una build in revisione che si stava per ritirare senza motivo.
// Questa classe è il template ufficiale di Capacitor 8.5.x, più la sessione audio
// che prima viveva in applicationDidBecomeActive — metodo che con le scene
// non viene più chiamato.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    // I deep link fleofit:// (callback OAuth, reset password) e gli universal link
    // NON passano più da application(_:open:) dell'AppDelegate: arrivano qui.
    // SceneDelegateProxy li riemette come notifiche Capacitor, e a freddo le
    // rimanda dopo capacitorViewDidAppear, quando i plugin sono registrati.
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        // Forza la sessione audio in Playback dopo il caricamento della WKWebView:
        // senza, i beep del timer guidato non suonano con il silenzioso inserito.
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("Errore audio in sceneDidBecomeActive: \(error.localizedDescription)")
        }
    }
}
