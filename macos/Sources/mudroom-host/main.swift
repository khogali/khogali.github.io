// mudroom-host: Chrome native-messaging host.
// Protocol: 4-byte little-endian length + UTF-8 JSON, both directions, over stdio.
// It never touches files itself. Reads are served from mat.json; writes are
// dropped as command files into the inbox, which the running app picks up.
import Foundation

let home = FileManager.default.homeDirectoryForCurrentUser
let support = home.appendingPathComponent("Library/Application Support/Mudroom", isDirectory: true)
let stateFile = support.appendingPathComponent("mat.json")
let inbox = support.appendingPathComponent("inbox", isDirectory: true)
try? FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true)

func readMessage() -> [String: Any]? {
    var lenBytes = [UInt8](repeating: 0, count: 4)
    guard fread(&lenBytes, 1, 4, stdin) == 4 else { return nil }
    let len = Int(UInt32(lenBytes[0]) | UInt32(lenBytes[1]) << 8 | UInt32(lenBytes[2]) << 16 | UInt32(lenBytes[3]) << 24)
    guard len > 0, len < 1_048_576 else { return nil }
    var buf = [UInt8](repeating: 0, count: len)
    guard fread(&buf, 1, len, stdin) == len else { return nil }
    return (try? JSONSerialization.jsonObject(with: Data(buf))) as? [String: Any]
}

func writeMessage(_ obj: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: obj) else { return }
    var len = UInt32(data.count).littleEndian
    withUnsafeBytes(of: &len) { _ = fwrite($0.baseAddress, 1, 4, stdout) }
    data.withUnsafeBytes { _ = fwrite($0.baseAddress, 1, data.count, stdout) }
    fflush(stdout)
}

func enqueue(_ cmd: [String: Any]) -> Bool {
    let name = String(format: "%.0f-%@.json", Date().timeIntervalSince1970 * 1000, UUID().uuidString)
    guard let data = try? JSONSerialization.data(withJSONObject: cmd) else { return false }
    return (try? data.write(to: inbox.appendingPathComponent(name), options: .atomic)) != nil
}

while let msg = readMessage() {
    let op = msg["op"] as? String ?? ""
    switch op {
    case "getState":
        if let data = try? Data(contentsOf: stateFile), let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            // Flatten to the shape popup.js expects: { ok, mat: [...] }
            let boots = (obj["boots"] as? [[String: Any]]) ?? []
            let iso = ISO8601DateFormatter()
            let mat: [[String: Any]] = boots.map { b in
                var o = b
                if let s = b["arrivedAt"] as? String, let d = iso.date(from: s) { o["arrivedAt"] = Int(d.timeIntervalSince1970 * 1000) }
                return o
            }
            writeMessage(["ok": true, "mat": mat, "rules": obj["rules"] ?? [:]])
        } else {
            writeMessage(["ok": false, "error": "Mudroom app has no state yet"])
        }
    case "move", "shoesOff", "openMat":
        writeMessage(["ok": enqueue(msg)])
    default:
        writeMessage(["ok": false, "error": "unknown op"])
    }
}
