import SwiftUI
import AppKit
import ServiceManagement

@main
struct MudroomApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate

    var body: some Scene {
        MenuBarExtra("Mudroom", systemImage: "shoeprints.fill") {
            MenuContent(store: delegate.store, delegate: delegate)
        }
    }
}

struct MenuContent: View {
    @ObservedObject var store: Store
    let delegate: AppDelegate

    var body: some View {
        Button("Show the mat    ⌃⌥M") { delegate.panel?.show() }
        Divider()
        Toggle("Catch files landing in Downloads", isOn: $store.watching)
        Button("Open ~/Mudroom") { NSWorkspace.shared.open(Paths.mudroom) }
        Button("Run decay now") { store.runDecay() }
        Divider()
        Toggle("Launch at login", isOn: Binding(
            get: { SMAppService.mainApp.status == .enabled },
            set: { on in try? (on ? SMAppService.mainApp.register() : SMAppService.mainApp.unregister()) }
        ))
        Divider()
        Button("Quit Mudroom") { NSApp.terminate(nil) }.keyboardShortcut("q")
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let store = Store()
    private(set) var panel: EdgePanel?
    private var watcher: Watcher?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        panel = EdgePanel(store: store)
        watcher = Watcher(store: store)
        watcher?.start()
        store.drainInbox()
    }

    func applicationWillTerminate(_ notification: Notification) {
        watcher?.stop()
        store.save()
    }
}
