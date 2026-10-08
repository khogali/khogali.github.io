import Foundation

/// Reads the breadcrumbs macOS already leaves on downloaded files.
enum Provenance {
    static func xattr(_ name: String, at path: String) -> Data? {
        let len = getxattr(path, name, nil, 0, 0, XATTR_NOFOLLOW)
        guard len > 0 else { return nil }
        var buf = [UInt8](repeating: 0, count: len)
        let got = getxattr(path, name, &buf, len, 0, XATTR_NOFOLLOW)
        guard got > 0 else { return nil }
        return Data(buf[0..<got])
    }

    /// Browsers and AirDrop stamp com.apple.metadata:kMDItemWhereFroms with a
    /// plist array: [downloadURL, referrerURL].
    static func whereFrom(_ path: String) -> (url: String?, referrer: String?) {
        guard let data = xattr("com.apple.metadata:kMDItemWhereFroms", at: path),
              let arr = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String] else { return (nil, nil) }
        return (arr.first, arr.count > 1 ? arr[1] : nil)
    }

    static func isQuarantined(_ path: String) -> Bool {
        xattr("com.apple.quarantine", at: path) != nil
    }
}
