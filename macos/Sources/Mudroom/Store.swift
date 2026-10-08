import Foundation
import AppKit

@MainActor
final class Store: ObservableObject {
    @Published private(set) var boots: [Boot] = []
    @Published var rules = RuleTable()
    @Published var watching = true { didSet { saveSoon() } }

    private var saveTimer: Timer?
    private var decayTimer: Timer?

    var onMat: [Boot] { boots.filter { $0.state == .mat }.sorted { $0.arrivedAt > $1.arrivedAt } }
    var bagged: [Boot] { boots.filter { $0.state == .bagged }.sorted { $0.arrivedAt > $1.arrivedAt } }

    init() {
        Paths.ensure()
        load()
        reconcile()
        decayTimer = Timer.scheduledTimer(withTimeInterval: 3600, repeats: true) { [weak self] _ in Task { @MainActor in self?.runDecay() } }
        runDecay()
    }

    // MARK: Catch

    /// A file has settled in Downloads. Bring it onto the mat.
    func catchFile(at src: URL) {
        let name = src.lastPathComponent
        let dest = Mover.uniqueURL(in: Paths.mudroom, name: name)
        do {
            try Mover.move(src, to: dest)
        } catch {
            NSLog("Mudroom: could not move \(src.path): \(error)")
            return
        }
        var isDir: ObjCBool = false
        FileManager.default.fileExists(atPath: dest.path, isDirectory: &isDir)
        let prov = Provenance.whereFrom(dest.path)
        let attrs = try? FileManager.default.attributesOfItem(atPath: dest.path)
        let boot = Boot(
            name: dest.lastPathComponent,
            path: dest.path,
            size: (attrs?[.size] as? Int64) ?? 0,
            isDirectory: isDir.boolValue,
            arrivedAt: Date(),
            source: prov.url ?? prov.referrer,
            domain: Rules.domain(of: prov.referrer) ?? Rules.domain(of: prov.url),
            quarantined: Provenance.isQuarantined(dest.path),
            kind: isDir.boolValue ? .other : BootKind.of(name)
        )
        boots.insert(boot, at: 0)
        saveSoon()
        NotificationCenter.default.post(name: .mudroomArrived, object: boot)
    }

    /// Something dropped straight onto the mat (drag and drop onto the panel).
    func drop(_ urls: [URL]) {
        for u in urls where !u.path.hasPrefix(Paths.mudroom.path) { catchFile(at: u) }
    }

    // MARK: Shoes off

    func shoesOff(_ id: UUID, room: URL, name: String?) -> Result<URL, Error> {
        guard let i = boots.firstIndex(where: { $0.id == id }) else { return .failure(StoreError.gone) }
        var b = boots[i]
        let finalName = (name?.trimmingCharacters(in: .whitespaces)).flatMap { $0.isEmpty ? nil : $0 } ?? b.name
        let safe = finalName.replacingOccurrences(of: "/", with: "-").replacingOccurrences(of: ":", with: "-")
        let dest = Mover.uniqueURL(in: room, name: safe)
        do {
            try FileManager.default.createDirectory(at: room, withIntermediateDirectories: true)
            try Mover.move(b.url, to: dest)
        } catch { return .failure(error) }
        Rules.learn(&rules, domain: b.domain, ext: (safe as NSString).pathExtension.lowercased(), room: room.path)
        b.state = .home; b.room = room.path; b.path = dest.path; b.name = dest.lastPathComponent; b.settledAt = Date()
        boots[i] = b
        saveSoon()
        return .success(dest)
    }

    func suggestion(for b: Boot) -> Suggestion? {
        Rules.suggest(rules, domain: b.domain, ext: (b.name as NSString).pathExtension.lowercased())
    }

    func bag(_ id: UUID) {
        guard let i = boots.firstIndex(where: { $0.id == id }) else { return }
        var b = boots[i]
        let dest = Mover.uniqueURL(in: Paths.bagged, name: b.name)
        guard (try? Mover.move(b.url, to: dest)) != nil else { return }
        b.state = .bagged; b.path = dest.path; b.name = dest.lastPathComponent
        boots[i] = b; saveSoon()
    }

    func rescue(_ id: UUID) {
        guard let i = boots.firstIndex(where: { $0.id == id }) else { return }
        var b = boots[i]
        let dest = Mover.uniqueURL(in: Paths.mudroom, name: b.name)
        guard (try? Mover.move(b.url, to: dest)) != nil else { return }
        b.state = .mat; b.path = dest.path; b.name = dest.lastPathComponent; b.arrivedAt = Date()
        boots[i] = b; saveSoon()
    }

    /// Through the real Trash. The only path that removes a file, ever.
    func trash(_ id: UUID) {
        guard let i = boots.firstIndex(where: { $0.id == id }) else { return }
        try? FileManager.default.trashItem(at: boots[i].url, resultingItemURL: nil)
        boots.remove(at: i); saveSoon()
    }

    func forget(_ id: UUID) { boots.removeAll { $0.id == id }; saveSoon() }

    // MARK: Decay

    func runDecay() {
        for b in boots where b.state == .mat {
            if b.decay == .bagged || b.decay == .trash { bag(b.id) }
        }
        for b in boots where b.state == .bagged && b.decay == .trash { trash(b.id) }
        // Anything that went home more than two days ago no longer needs a record.
        boots.removeAll { $0.state == .home && ($0.settledAt ?? $0.arrivedAt).timeIntervalSinceNow < -2 * 86400 }
        saveSoon()
    }

    /// Drop records for files the user moved or deleted themselves; adopt
    /// files that are sitting in ~/Mudroom without a record.
    func reconcile() {
        boots.removeAll { ($0.state == .mat || $0.state == .bagged) && !FileManager.default.fileExists(atPath: $0.path) }
        let known = Set(boots.map(\.path))
        for dir in [Paths.mudroom, Paths.bagged] {
            let items = (try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.contentModificationDateKey, .fileSizeKey, .isDirectoryKey], options: [.skipsHiddenFiles])) ?? []
            for u in items where u != Paths.bagged && !known.contains(u.path) {
                let rv = try? u.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey, .isDirectoryKey])
                let prov = Provenance.whereFrom(u.path)
                boots.append(Boot(name: u.lastPathComponent, path: u.path, size: Int64(rv?.fileSize ?? 0), isDirectory: rv?.isDirectory ?? false,
                                  arrivedAt: rv?.contentModificationDate ?? Date(), source: prov.url ?? prov.referrer,
                                  domain: Rules.domain(of: prov.referrer) ?? Rules.domain(of: prov.url),
                                  quarantined: Provenance.isQuarantined(u.path), kind: BootKind.of(u.lastPathComponent),
                                  state: dir == Paths.bagged ? .bagged : .mat))
            }
        }
        saveSoon()
    }

    // MARK: Persistence

    private struct Snapshot: Codable { var boots: [Boot]; var rules: RuleTable; var watching: Bool }

    private func load() {
        guard let data = try? Data(contentsOf: Paths.stateFile),
              let snap = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }
        boots = snap.boots; rules = snap.rules; watching = snap.watching
    }

    func saveSoon() {
        saveTimer?.invalidate()
        saveTimer = Timer.scheduledTimer(withTimeInterval: 0.3, repeats: false) { [weak self] _ in Task { @MainActor in self?.save() } }
    }

    func save() {
        let snap = Snapshot(boots: boots, rules: rules, watching: watching)
        let enc = JSONEncoder(); enc.dateEncodingStrategy = .iso8601; enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        if let data = try? enc.encode(snap) { try? data.write(to: Paths.stateFile, options: .atomic) }
    }

    // MARK: Commands from the extensions (dropped in the inbox by mudroom-host)

    func drainInbox() {
        let files = (try? FileManager.default.contentsOfDirectory(at: Paths.inbox, includingPropertiesForKeys: nil)) ?? []
        for f in files.sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) where f.pathExtension == "json" {
            defer { try? FileManager.default.removeItem(at: f) }
            guard let data = try? Data(contentsOf: f), let cmd = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let op = cmd["op"] as? String else { continue }
            switch op {
            case "move":
                // The Chrome extension handing over a finished file it cannot move itself.
                guard let path = cmd["path"] as? String, let room = cmd["room"] as? String else { continue }
                let src = URL(fileURLWithPath: path)
                let roomURL = room.hasPrefix("/") ? URL(fileURLWithPath: room) : Paths.downloads.appendingPathComponent(room)
                if let i = boots.firstIndex(where: { $0.path == path }) {
                    _ = shoesOff(boots[i].id, room: roomURL, name: cmd["name"] as? String)
                } else if FileManager.default.fileExists(atPath: path) {
                    catchFile(at: src)
                    if let b = boots.first { _ = shoesOff(b.id, room: roomURL, name: cmd["name"] as? String) }
                }
            case "shoesOff":
                guard let idS = cmd["id"] as? String, let id = UUID(uuidString: idS), let room = cmd["room"] as? String else { continue }
                let roomURL = room.hasPrefix("/") ? URL(fileURLWithPath: room) : Paths.downloads.appendingPathComponent(room)
                _ = shoesOff(id, room: roomURL, name: cmd["name"] as? String)
            case "openMat":
                NotificationCenter.default.post(name: .mudroomShowPanel, object: nil)
            default: continue
            }
        }
    }
}

enum StoreError: Error { case gone }

extension Notification.Name {
    static let mudroomArrived = Notification.Name("mudroom.arrived")
    static let mudroomShowPanel = Notification.Name("mudroom.showPanel")
}
