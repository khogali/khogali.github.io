// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "Mudroom",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "Mudroom",
            path: "Sources/Mudroom",
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("SwiftUI"),
                .linkedFramework("Quartz"),
                .linkedFramework("Carbon"),
                .linkedFramework("ServiceManagement"),
            ]
        ),
        .executableTarget(
            name: "mudroom-host",
            path: "Sources/mudroom-host"
        ),
    ]
)
