import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        FirebaseApp.configure()

        return true
    }

    // Aggancia ogni scena alla SceneDelegate. Il nome della classe è dichiarato
    // anche in Info.plist (UIApplicationSceneManifest): i due devono coincidere.
    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }

    // Le push restano sull'AppDelegate: sono dell'applicazione, non di una scena.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // Invia il token APNs di Apple a Firebase
        Messaging.messaging().apnsToken = deviceToken
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    // ⚠️ Con il ciclo di vita a UIScene, UIKit NON chiama più
    // applicationDidBecomeActive/WillResignActive/DidEnterBackground/WillTerminate
    // né application(_:open:) e continue userActivity: gli equivalenti stanno in
    // SceneDelegate.swift. Rimetterli qui non dà errore — semplicemente non parte
    // più niente, in silenzio.
}
