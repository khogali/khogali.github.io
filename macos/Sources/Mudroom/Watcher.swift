import Foundation
import CoreServices

/// Watches ~/Downloads and the command inbox. A file is only "settled" when its
/// size and modification date have not changed across two ticks and it is not a
/// browser's in-progress artefact. Moving too early corrupts a download, so this
/// is deliberately patient.
@MainActor
final class Watcher {
    private var stream: FSEventStreamRef?
    private let store: Store
    private var candidates: [String: (size: Int64, mtime: Date, stableTicks: Int)] = [:]
    private var tick: Timer?

    private static let partialExtensions: Set<String> = ["crdownload", "download", "part", "partial", "tmp", "opdownload", "safariextz"]
    private static let partialPrefixes = [".com.google.Chrome", ".com.apple.", "Unconfirmed "]

    init(store: Store) { self.store = store }

    func start() {
        guard stream == nil else { return }
        let paths = [Paths.downloads.path, Paths.inbox.path] as CFArray
        var ctx = FSEventStreamContext(version: 0, info: Unmanaged.passUnretained(self).toOpaque(), retain: nil, release: nil, copyDescription: nil)
        let flags = UInt32(kFSEventStreamCreateFlagFileEvents | kFSEventStreamCreateFlagUseCFTypes | kFSEventStreamCreateFlagNoDefer)
        stream = FSEventStreamCreate(nil, { _, info, count, eventPaths, _, _ in
            guard let info, let paths = unsafeBitCast(eventPaths, to: NSArray.self) as? [String] else { return }
            let me = Unmanaged<Watcher>.fromOpaque(info).takeUnretainedValue()
            Task { @MainActor in me.handle(paths) }
        }, &ctx, paths, FSEventStreamEventId(kFSEventStreamEventIdSinceNow), 0.3, flags)
        guard let stream else { return }
        FSEventStreamSetDispatchQueue(stream, DispatchQueue.main)
        FSEventStreamStart(stream)
        tick = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in Task { @MainActor in self?.settleTick() } }
        // Pick up anything already sitting there when we start.
        if let items = try? FileManager.default.contentsOfDirectory(atPath: Paths.downloads.path) {
            handle(items.map { Paths.downloads.appendingPathComponent($0).path })
        }
    }

    func stop() {
        if let s = stream { FSEventStreamStop(s); FSEventStreamInvalidate(s); FSEventStreamRelease(s) }
        stream = nil; tick?.invalidate(); tick = nil; candidates.removeAll()
    }

    private func handle(_ paths: [String]) {
        var touchedInbox = false
        for p in paths {
            if p.hasPrefix(Paths.inbox.path) { touchedInbox = true; continue }
            guard store.watching, isCandidate(p) else { continue }
            if let (size, mtime) = stat(p) { candidates[p] = (size, mtime, 0) } else { candidates[p] = nil }
        }
        if touchedInbox { store.drainInbox() }
    }

    private func isCandidate(_ p: String) -> Bool {
        let url = URL(fileURLWithPath: p)
        // Only direct children of Downloads; nothing inside subfolders (those are rooms).
        guard url.deletingLastPathComponent().path == Paths.downloads.path else { return false }
        let name = url.lastPathComponent
        if name.hasPrefix(".") { return false }
        if Self.partialExtensions.contains(url.pathExtension.lowercased()) { return false }
        if Self.partialPrefixes.contains(where: { name.hasPrefix($0) }) { return false }
        return FileManager.default.fileExists(atPath: p)
    }

    private func stat(_ p: String) -> (Int64, Date)? {
        guard let a = try? FileManager.default.attributesOfItem(atPath: p) else { return nil }
        return ((a[.size] as? Int64) ?? 0, (a[.modificationDate] as? Date) ?? .distantPast)
    }

    private func settleTick() {
        for (p, prev) in candidates {
            guard let (size, mtime) = stat(p), isCandidate(p) else { candidates[p] = nil; continue }
            if size == prev.size && mtime == prev.mtime {
                let ticks = prev.stableTicks + 1
                // Two quiet seconds for files, four for folders (unzips write many entries).
                let needed = (try? URL(fileURLWithPath: p).resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true ? 4 : 2
                if ticks >= needed && !isOpenElsewhere(p) {
                    candidates[p] = nil
                    store.catchFile(at: URL(fileURLWithPath: p))
                } else {
                    candidates[p] = (size, mtime, ticks)
                }
            } else {
                candidates[p] = (size, mtime, 0)
            }
        }
    }

    /// Cheap, best-effort check: catches writers that take an advisory lock.
    /// Browsers mostly don't, which is why the stable-size ticks above do the real work.
    private func isOpenElsewhere(_ p: String) -> Bool {
        let fd = open(p, O_RDONLY | O_NONBLOCK)
        guard fd >= 0 else { return true }
        defer { close(fd) }
        let locked = flock(fd, LOCK_EX | LOCK_NB) == 0
        if locked { flock(fd, LOCK_UN) }
        return !locked
    }
}
