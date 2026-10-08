import Foundation

/// Every location Mudroom touches, in one place.
enum Paths {
    static let home = FileManager.default.homeDirectoryForCurrentUser
    static let downloads = home.appendingPathComponent("Downloads", isDirectory: true)
    static let mudroom = home.appendingPathComponent("Mudroom", isDirectory: true)
    static let bagged = mudroom.appendingPathComponent("Bagged", isDirectory: true)

    /// ~/Library/Application Support/Mudroom — state file plus the inbox the
    /// native-messaging host drops commands into. Shared with Safari via an
    /// App Group when one is configured (see README).
    static var support: URL {
        if let group = ProcessInfo.processInfo.environment["MUDROOM_APP_GROUP"],
           let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) {
            return url
        }
        return home.appendingPathComponent("Library/Application Support/Mudroom", isDirectory: true)
    }
    static var stateFile: URL { support.appendingPathComponent("mat.json") }
    static var inbox: URL { support.appendingPathComponent("inbox", isDirectory: true) }

    static func ensure() {
        for d in [mudroom, bagged, support, inbox] {
            try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        }
    }
}
