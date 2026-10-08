import SwiftUI
import AppKit
import Quartz
import UniformTypeIdentifiers

struct MatView: View {
    @ObservedObject var store: Store
    let panel: EdgePanel
    @State private var expanded: UUID?
    @State private var dropping = false

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 8) {
                    if store.onMat.isEmpty { Text("Mat's clean.").italic().foregroundStyle(.secondary).padding(.top, 24) }
                    ForEach(store.onMat) { b in
                        BootRow(boot: b, store: store, expanded: expanded == b.id) { expanded = expanded == b.id ? nil : b.id }
                    }
                    if !store.bagged.isEmpty {
                        Text("BAGGED FOR PICKUP").font(.caption2.weight(.semibold)).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading).padding(.top, 10)
                        ForEach(store.bagged) { b in BaggedRow(boot: b, store: store) }
                    }
                }
                .padding(10)
            }
            footer
        }
        .frame(width: EdgePanel.width)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(dropping ? Color.orange : Color.primary.opacity(0.08), lineWidth: dropping ? 2 : 1))
        .onDrop(of: [.fileURL], isTargeted: $dropping) { providers in
            Task { @MainActor in
                var urls: [URL] = []
                for p in providers {
                    if let data = try? await p.loadItem(forTypeIdentifier: UTType.fileURL.identifier) as? Data, let u = URL(dataRepresentation: data, relativeTo: nil) { urls.append(u) }
                }
                store.drop(urls)
            }
            return true
        }
    }

    private var header: some View {
        HStack {
            Image(systemName: "shoeprints.fill")
            Text("Mudroom").font(.headline)
            Spacer()
            Text("\(store.onMat.count)").font(.caption).padding(.horizontal, 7).padding(.vertical, 2).background(Capsule().fill(Color.primary.opacity(0.08)))
            Button { panel.hide() } label: { Image(systemName: "xmark") }.buttonStyle(.plain).foregroundStyle(.secondary)
        }
        .padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 6)
    }

    private var footer: some View {
        HStack {
            Toggle("Catch Downloads", isOn: $store.watching).toggleStyle(.switch).controlSize(.mini)
            Spacer()
            Button("Open folder") { NSWorkspace.shared.open(Paths.mudroom) }.controlSize(.small)
        }
        .font(.caption)
        .padding(.horizontal, 12).padding(.vertical, 8)
    }
}

struct BootRow: View {
    let boot: Boot
    @ObservedObject var store: Store
    let expanded: Bool
    let toggle: () -> Void
    @State private var name = ""
    @State private var room: URL?
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Image(nsImage: NSWorkspace.shared.icon(forFile: boot.path)).resizable().frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text(boot.name).fontWeight(.semibold).lineLimit(1).truncationMode(.middle)
                    HStack(spacing: 8) {
                        Text(boot.domain ?? "unknown source")
                        Text(age)
                        if boot.size > 0 { Text(ByteCountFormatter.string(fromByteCount: boot.size, countStyle: .file)) }
                        if boot.kind == .exec { Text("runs code").foregroundStyle(.red).fontWeight(.semibold) }
                        else if boot.quarantined { Text("quarantined").foregroundStyle(.orange) }
                    }.font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer()
                decayBadge
            }
            .contentShape(Rectangle())
            .onTapGesture(perform: toggle)
            .onDrag { NSItemProvider(contentsOf: boot.url) ?? NSItemProvider() }

            if expanded { shoesOff }
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color(nsColor: .controlBackgroundColor)))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Color.primary.opacity(0.08)))
        .onAppear { name = boot.cleanName; room = defaultRoom }
    }

    private var age: String {
        let s = boot.age
        if s < 60 { return "just now" }
        if s < 3600 { return "\(Int(s / 60))m" }
        if s < 172800 { return "\(Int(s / 3600))h" }
        return "\(Int(s / 86400))d"
    }

    @ViewBuilder private var decayBadge: some View {
        switch boot.decay {
        case .fresh: EmptyView()
        case .dusty: Text("dusty").font(.caption2).foregroundStyle(.orange)
        case .bagged, .trash: Text("overdue").font(.caption2).foregroundStyle(.red)
        }
    }

    private var defaultRoom: URL? {
        if let s = store.suggestion(for: boot) { return URL(fileURLWithPath: s.room) }
        return store.rules.rooms.first.map { URL(fileURLWithPath: $0) }
    }

    private var shoesOff: some View {
        VStack(alignment: .leading, spacing: 6) {
            Divider()
            TextField("name", text: $name).textFieldStyle(.roundedBorder).onSubmit(go)
            FlowRooms(rooms: roomChoices, selected: $room)
            HStack {
                Button("Other folder…", action: pickFolder).controlSize(.small)
                Button("Peek") { QuickLook.show(boot.url) }.controlSize(.small)
                Spacer()
                Button("Shoes off", action: go).keyboardShortcut(.defaultAction).controlSize(.small).disabled(room == nil)
            }
            if let error { Text(error).font(.caption).foregroundStyle(.red) }
            Text(room.map { "→ \($0.path.replacingOccurrences(of: Paths.home.path, with: "~"))" } ?? "Pick a room.").font(.caption2).foregroundStyle(.secondary)
        }
    }

    private var roomChoices: [RoomChoice] {
        var out: [RoomChoice] = []
        if let s = store.suggestion(for: boot) { out.append(RoomChoice(url: URL(fileURLWithPath: s.room), suggested: true)) }
        for r in store.rules.rooms where !out.contains(where: { $0.url.path == r }) { out.append(RoomChoice(url: URL(fileURLWithPath: r), suggested: false)) }
        for d in ["Documents", "Desktop", "Pictures"] {
            let u = Paths.home.appendingPathComponent(d)
            if !out.contains(where: { $0.url == u }) { out.append(RoomChoice(url: u, suggested: false)) }
        }
        return Array(out.prefix(8))
    }

    private func pickFolder() {
        let p = NSOpenPanel(); p.canChooseDirectories = true; p.canChooseFiles = false; p.canCreateDirectories = true; p.prompt = "Use as room"
        NSApp.activate(ignoringOtherApps: true)
        if p.runModal() == .OK, let u = p.url { room = u }
    }

    private func go() {
        guard let room else { return }
        switch store.shoesOff(boot.id, room: room, name: name) {
        case .success: error = nil
        case .failure(let e): error = e.localizedDescription
        }
    }
}

struct BaggedRow: View {
    let boot: Boot
    @ObservedObject var store: Store
    var body: some View {
        HStack {
            Image(nsImage: NSWorkspace.shared.icon(forFile: boot.path)).resizable().frame(width: 20, height: 20)
            Text(boot.name).lineLimit(1).truncationMode(.middle).foregroundStyle(.secondary)
            Spacer()
            Button("Rescue") { store.rescue(boot.id) }.controlSize(.mini)
            Button("Trash") { store.trash(boot.id) }.controlSize(.mini)
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color(nsColor: .controlBackgroundColor).opacity(0.6)))
    }
}

struct RoomChoice: Identifiable { let url: URL; let suggested: Bool; var id: String { url.path } }

struct FlowRooms: View {
    let rooms: [RoomChoice]
    @Binding var selected: URL?
    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 90), spacing: 6, alignment: .leading)], alignment: .leading, spacing: 6) {
            ForEach(rooms) { r in
                let u = r.url
                Button { selected = u } label: {
                    Text((r.suggested ? "★ " : "") + u.lastPathComponent).font(.caption).lineLimit(1)
                        .padding(.horizontal, 9).padding(.vertical, 4)
                        .background(Capsule().fill(selected == u ? Color.accentColor : Color.primary.opacity(0.08)))
                        .foregroundStyle(selected == u ? Color.white : Color.primary)
                }.buttonStyle(.plain).help(u.path)
            }
        }
    }
}

/// Minimal Quick Look driver for the panel.
@MainActor
enum QuickLook {
    private static let source = Source()
    static func show(_ url: URL) {
        source.url = url
        guard let p = QLPreviewPanel.shared() else { return }
        p.dataSource = source; p.delegate = source
        p.reloadData()
        p.makeKeyAndOrderFront(nil)
    }
    final class Source: NSObject, QLPreviewPanelDataSource, QLPreviewPanelDelegate {
        var url: URL?
        func numberOfPreviewItems(in panel: QLPreviewPanel!) -> Int { url == nil ? 0 : 1 }
        func previewPanel(_ panel: QLPreviewPanel!, previewItemAt index: Int) -> QLPreviewItem! { url as NSURL? }
    }
}
