import Foundation

enum Mover {
    /// "invoice.pdf" -> "invoice 2.pdf" -> "invoice 3.pdf" until free.
    static func uniqueURL(in dir: URL, name: String) -> URL {
        let fm = FileManager.default
        var candidate = dir.appendingPathComponent(name)
        guard fm.fileExists(atPath: candidate.path) else { return candidate }
        let ns = name as NSString
        let stem = ns.deletingPathExtension, ext = ns.pathExtension
        var n = 2
        repeat {
            let newName = ext.isEmpty ? "\(stem) \(n)" : "\(stem) \(n).\(ext)"
            candidate = dir.appendingPathComponent(newName)
            n += 1
        } while fm.fileExists(atPath: candidate.path)
        return candidate
    }

    /// Same-volume moves are a rename: atomic and instant. Cross-volume falls
    /// back to copy-then-remove, which FileManager handles.
    static func move(_ src: URL, to dest: URL) throws {
        try FileManager.default.moveItem(at: src, to: dest)
    }
}
