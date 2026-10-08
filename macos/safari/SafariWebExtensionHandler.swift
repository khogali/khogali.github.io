// Drop this in place of the handler that `xcrun safari-web-extension-converter`
// generates. Safari has no downloads API, so the extension is a window onto
// the app's mat: reads come from mat.json in the shared App Group container,
// writes go into the inbox folder the app watches.
//
// Both the app target and this extension target need the same App Group
// (com.apple.security.application-groups), and the app must be launched with
// MUDROOM_APP_GROUP set to that group id (or hard-code it in Paths.support).
import SafariServices
import Foundation

let appGroup = "group.TEAMID.mudroom"  // <- change to yours

final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    private var container: URL? { FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) }

    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems.first as? NSExtensionItem
        let message = (item?.userInfo?[SFExtensionMessageKey] as? [String: Any]) ?? [:]
        let op = message["op"] as? String ?? ""
        var reply: [String: Any] = ["ok": false]

        if let c = container {
            switch op {
            case "getState":
                if let data = try? Data(contentsOf: c.appendingPathComponent("mat.json")),
                   let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    let iso = ISO8601DateFormatter()
                    let mat = ((obj["boots"] as? [[String: Any]]) ?? []).map { b -> [String: Any] in
                        var o = b
                        if let s = b["arrivedAt"] as? String, let d = iso.date(from: s) { o["arrivedAt"] = Int(d.timeIntervalSince1970 * 1000) }
                        return o
                    }
                    reply = ["ok": true, "mat": mat, "rules": obj["rules"] ?? [:]]
                } else {
                    reply = ["ok": false, "error": "Mudroom app not running or no state yet"]
                }
            case "shoesOff", "openMat", "move":
                let inbox = c.appendingPathComponent("inbox", isDirectory: true)
                try? FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true)
                let name = String(format: "%.0f-%@.json", Date().timeIntervalSince1970 * 1000, UUID().uuidString)
                if let data = try? JSONSerialization.data(withJSONObject: message) {
                    reply = ["ok": (try? data.write(to: inbox.appendingPathComponent(name), options: .atomic)) != nil]
                }
            default:
                reply = ["ok": false, "error": "unknown op"]
            }
        }

        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: reply]
        context.completeRequest(returningItems: [response])
    }
}
