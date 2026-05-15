// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.3.4"),
        .package(name: "CapacitorCommunityFcm", path: "../../../node_modules/@capacitor-community/fcm"),
        .package(name: "CapacitorCommunityMedia", path: "../../../node_modules/@capacitor-community/media"),
        .package(name: "CapacitorApp", path: "../../../node_modules/@capacitor/app"),
        .package(name: "CapacitorBrowser", path: "../../../node_modules/@capacitor/browser"),
        .package(name: "CapacitorFilesystem", path: "../../../node_modules/@capacitor/filesystem"),
        .package(name: "CapacitorKeyboard", path: "../../../node_modules/@capacitor/keyboard"),
        .package(name: "CapacitorPushNotifications", path: "../../../node_modules/@capacitor/push-notifications"),
        .package(name: "CapacitorScreenOrientation", path: "../../../node_modules/@capacitor/screen-orientation"),
        .package(name: "CapacitorShare", path: "../../../node_modules/@capacitor/share"),
        .package(name: "CapacitorStatusBar", path: "../../../node_modules/@capacitor/status-bar"),
        .package(name: "CapawesomeCapacitorBadge", path: "../../../node_modules/@capawesome/capacitor-badge"),
        .package(name: "IndependoCapacitorVoiceRecorder", path: "../../../node_modules/@independo/capacitor-voice-recorder")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunityFcm", package: "CapacitorCommunityFcm"),
                .product(name: "CapacitorCommunityMedia", package: "CapacitorCommunityMedia"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorBrowser", package: "CapacitorBrowser"),
                .product(name: "CapacitorFilesystem", package: "CapacitorFilesystem"),
                .product(name: "CapacitorKeyboard", package: "CapacitorKeyboard"),
                .product(name: "CapacitorPushNotifications", package: "CapacitorPushNotifications"),
                .product(name: "CapacitorScreenOrientation", package: "CapacitorScreenOrientation"),
                .product(name: "CapacitorShare", package: "CapacitorShare"),
                .product(name: "CapacitorStatusBar", package: "CapacitorStatusBar"),
                .product(name: "CapawesomeCapacitorBadge", package: "CapawesomeCapacitorBadge"),
                .product(name: "IndependoCapacitorVoiceRecorder", package: "IndependoCapacitorVoiceRecorder")
            ]
        )
    ]
)
