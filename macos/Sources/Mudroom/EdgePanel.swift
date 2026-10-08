import AppKit
import SwiftUI
import Carbon.HIToolbox

/// The mat: a non-activating floating panel glued to the right screen edge.
/// Slides out when the cursor hits the edge or on ⌃⌥M, slides back when the
/// cursor wanders off it.
@MainActor
final class EdgePanel {
    static let width: CGFloat = 340
    private let panel: NSPanel
    private var shown = false
    private var mouseMonitor: Any?
    private var hideWork: DispatchWorkItem?
    private var hotKeyRef: EventHotKeyRef?

    init(store: Store) {
        let screen = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let frame = NSRect(x: screen.maxX - 2, y: screen.minY + 24, width: Self.width, height: screen.height - 48)
        panel = NSPanel(contentRect: frame, styleMask: [.nonactivatingPanel, .borderless, .fullSizeContentView, .utilityWindow], backing: .buffered, defer: false)
        panel.level = .floating
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.hidesOnDeactivate = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.isMovableByWindowBackground = false
        panel.contentView = NSHostingView(rootView: MatView(store: store, panel: self))
        panel.alphaValue = 0
        panel.orderFrontRegardless()

        mouseMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.mouseMoved, .leftMouseDragged]) { [weak self] e in
            Task { @MainActor in self?.mouseMoved(NSEvent.mouseLocation, dragging: e.type == .leftMouseDragged) }
        }
        registerHotKey()
        NotificationCenter.default.addObserver(forName: .mudroomShowPanel, object: nil, queue: .main) { [weak self] _ in Task { @MainActor in self?.show() } }
        NotificationCenter.default.addObserver(forName: .mudroomArrived, object: nil, queue: .main) { [weak self] _ in Task { @MainActor in self?.peek() } }
    }

    private func mouseMoved(_ loc: NSPoint, dragging: Bool) {
        guard let screen = NSScreen.screens.first(where: { NSMouseInRect(loc, $0.frame, false) }) else { return }
        let atEdge = loc.x >= screen.frame.maxX - 2
        if atEdge && !shown { show(on: screen) }
        if shown {
            let inside = NSMouseInRect(loc, panel.frame.insetBy(dx: -40, dy: -40), false)
            if inside || dragging { hideWork?.cancel(); hideWork = nil }
            else if hideWork == nil { scheduleHide(after: 0.6) }
        }
    }

    func show(on screen: NSScreen? = nil) {
        let s = (screen ?? NSScreen.main)?.visibleFrame ?? panel.frame
        let target = NSRect(x: s.maxX - Self.width - 8, y: s.minY + 24, width: Self.width, height: s.height - 48)
        hideWork?.cancel(); hideWork = nil
        if !shown { panel.setFrame(target.offsetBy(dx: Self.width, dy: 0), display: false) }
        shown = true
        panel.orderFrontRegardless()
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.22; ctx.timingFunction = CAMediaTimingFunction(name: .easeOut)
            panel.animator().setFrame(target, display: true)
            panel.animator().alphaValue = 1
        }
    }

    func hide() {
        guard shown else { return }
        shown = false
        let f = panel.frame
        NSAnimationContext.runAnimationGroup({ ctx in
            ctx.duration = 0.18
            panel.animator().setFrame(f.offsetBy(dx: Self.width + 8, dy: 0), display: true)
            panel.animator().alphaValue = 0
        }, completionHandler: { [weak self] in Task { @MainActor in if self?.shown == false { self?.panel.orderOut(nil) } } })
    }

    func toggle() { shown ? hide() : show() }

    /// New boots arrived: show briefly so the user sees them land, then retreat.
    private func peek() {
        show()
        scheduleHide(after: 2.5)
    }

    private func scheduleHide(after s: TimeInterval) {
        hideWork?.cancel()
        let w = DispatchWorkItem { [weak self] in self?.hide(); self?.hideWork = nil }
        hideWork = w
        DispatchQueue.main.asyncAfter(deadline: .now() + s, execute: w)
    }

    // ⌃⌥M via Carbon: works without Accessibility permission.
    private func registerHotKey() {
        var spec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(), { _, _, userData in
            guard let userData else { return noErr }
            let me = Unmanaged<EdgePanel>.fromOpaque(userData).takeUnretainedValue()
            Task { @MainActor in me.toggle() }
            return noErr
        }, 1, &spec, Unmanaged.passUnretained(self).toOpaque(), nil)
        let id = EventHotKeyID(signature: OSType(0x4D55_4452), id: 1) // "MUDR"
        RegisterEventHotKey(UInt32(kVK_ANSI_M), UInt32(controlKey | optionKey), id, GetApplicationEventTarget(), 0, &hotKeyRef)
    }
}
