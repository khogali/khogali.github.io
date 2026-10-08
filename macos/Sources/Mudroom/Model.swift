import Foundation

enum BootKind: String, Codable {
    case exec, archive, image, doc, other

    static func of(_ name: String) -> BootKind {
        let e = (name as NSString).pathExtension.lowercased()
        if ["dmg", "pkg", "app", "sh", "zsh", "bash", "command", "py", "rb", "pl", "js", "jar", "exe", "msi", "bat", "cmd", "ps1", "scpt", "applescript", "workflow", "action", "terminal", "webloc"].contains(e) { return .exec }
        if ["zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "iso"].contains(e) { return .archive }
        if ["png", "jpg", "jpeg", "gif", "webp", "heic", "svg", "tiff", "bmp", "avif"].contains(e) { return .image }
        if ["pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "txt", "md", "rtf", "pages", "numbers", "key", "json", "xml", "yaml", "yml"].contains(e) { return .doc }
        return .other
    }
}

enum BootState: String, Codable { case mat, bagged, home }
enum Decay: String { case fresh, dusty, bagged, trash }

struct Boot: Codable, Identifiable, Equatable {
    var id: UUID = UUID()
    var name: String
    var path: String
    var size: Int64
    var isDirectory: Bool = false
    var arrivedAt: Date
    var source: String?       // full "where from" URL
    var domain: String?
    var quarantined: Bool = false
    var kind: BootKind
    var state: BootState = .mat
    var room: String?
    var settledAt: Date?

    var url: URL { URL(fileURLWithPath: path) }
    var cleanName: String { Rules.cleanName(name) }
    var age: TimeInterval { Date().timeIntervalSince(arrivedAt) }

    var decay: Decay {
        let days = age / 86400
        if days >= Double(Rules.trashDays) { return .trash }
        if days >= Double(Rules.bagDays) { return .bagged }
        if days >= Double(Rules.dustDays) { return .dusty }
        return .fresh
    }
}

struct RuleTable: Codable {
    var byDomain: [String: [String: Int]] = [:]
    var byExt: [String: [String: Int]] = [:]
    var rooms: [String] = []  // absolute folder paths, most recent first
}

struct Suggestion { let room: String; let confident: Bool; let why: String }

enum Rules {
    static let dustDays = 7
    static let bagDays = 14
    static let trashDays = 30

    static func cleanName(_ name: String) -> String {
        let ns = name as NSString
        let ext = ns.pathExtension
        var stem = ext.isEmpty ? name : ns.deletingPathExtension
        let original = stem
        func sub(_ pattern: String, _ repl: String, _ opts: NSRegularExpression.Options = [.caseInsensitive]) {
            guard let re = try? NSRegularExpression(pattern: pattern, options: opts) else { return }
            stem = re.stringByReplacingMatches(in: stem, range: NSRange(stem.startIndex..., in: stem), withTemplate: repl)
        }
        sub(#"^(copy of|kopie von|copie de)\s+"#, "")
        sub(#"\s*\(\d+\)\s*$"#, "")
        sub(#"[\s_-]+(final|copy)$"#, "")
        sub(#"[\s_-]*\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b[\s_-]*"#, " ")
        sub(#"[\s_-]*\b[0-9a-f]{24,}\b[\s_-]*"#, " ")
        sub(#"\s{2,}"#, " ")
        stem = stem.trimmingCharacters(in: .whitespaces)
        if stem.isEmpty { stem = original.trimmingCharacters(in: .whitespaces) }
        return ext.isEmpty ? stem : "\(stem).\(ext)"
    }

    static func domain(of urlString: String?) -> String? {
        guard let s = urlString, let u = URL(string: s), var h = u.host?.lowercased() else { return nil }
        if h.hasPrefix("www.") { h.removeFirst(4) }
        return h
    }

    private static func best(_ table: [String: Int]?) -> (String, Int)? {
        table?.max(by: { $0.value < $1.value }).map { ($0.key, $0.value) }
    }

    static func suggest(_ rules: RuleTable, domain: String?, ext: String) -> Suggestion? {
        if let d = domain, let (room, n) = best(rules.byDomain[d]) { return Suggestion(room: room, confident: n >= 2, why: d) }
        if !ext.isEmpty, let (room, n) = best(rules.byExt[ext]) { return Suggestion(room: room, confident: n >= 3, why: ".\(ext)") }
        return nil
    }

    static func learn(_ rules: inout RuleTable, domain: String?, ext: String, room: String) {
        if let d = domain { rules.byDomain[d, default: [:]][room, default: 0] += 1 }
        if !ext.isEmpty { rules.byExt[ext, default: [:]][room, default: 0] += 1 }
        rules.rooms.removeAll { $0 == room }
        rules.rooms.insert(room, at: 0)
        if rules.rooms.count > 12 { rules.rooms.removeLast(rules.rooms.count - 12) }
    }
}
