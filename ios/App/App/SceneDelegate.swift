import UIKit
import Capacitor
import AVFoundation

// Da iOS 26 il ciclo di vita a UIScene non è più facoltativo: un'app compilata
// con l'SDK nuovo che non lo adotta viene TERMINATA all'avvio
// (__UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption, EXC_BREAKPOINT).
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
