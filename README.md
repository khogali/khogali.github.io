# Mudroom

Nothing enters your filesystem with its shoes on.

Every file that lands in Downloads (browser, AirDrop, Slack drag-out, Mail attachment) is caught at the door. You give it a real name and a room, or it waits on the mat. Leave it there too long and it gets bagged for pickup. Nothing is ever deleted behind your back.

Three pieces, one idea:

| Piece | What it does | Status |
|---|---|---|
| `macos/` | Menubar app. Watches `~/Downloads`, moves settled files to `~/Mudroom`, shows the mat on the right screen edge (hover the edge or ⌃⌥M). Shoes-off moves the file into a room and learns the rule. Decay: dusty at 7 days, bagged at 14, Trash at 30. | Written, **not yet compiled** (authored on Linux). Needs a Mac with Xcode 15+. |
| `extension/` in Chrome | Holds each download at the door via `onDeterminingFilename`, routes it to a room (a folder under Downloads) or onto the mat (`Downloads/Mudroom`). Learns rules; auto-routes after two sends from the same site. | Tested end to end in headless Chromium. |
| `extension/` in Safari | Safari has no downloads API, so this is a window onto the app's mat via native messaging. | Written, needs the converter and an App Group (below). |

## Chrome extension

1. `chrome://extensions`, enable Developer mode, **Load unpacked**, pick `extension/`.
2. Download something. The popup opens with the file at the door. Pick a room, press Enter.
3. Do nothing for 25 seconds and it goes to `Downloads/Mudroom`.

Chrome can route a download but cannot move a finished file. For files already on the mat, shoes-off teaches the rule and shows the file in Finder, unless the Mac app is installed, in which case it hands the move to the app.

## macOS app

```sh
cd macos
make            # swift build + assemble build/Mudroom.app, ad-hoc signed
make run
```

First launch asks for Downloads folder access. That's the only permission it needs. The hotkey and edge hover work without Accessibility access.

To let the Chrome extension hand finished files to the app:

```sh
make install-host EXT_ID=<id shown on chrome://extensions>
```

State lives in `~/Library/Application Support/Mudroom/mat.json`. The app never phones home. There is no network code in it.

### Safari extension

Safari web extensions ship inside a Mac app, so the converter builds an Xcode project around `extension/`:

```sh
xcrun safari-web-extension-converter ../extension --project-location safari-build --app-name Mudroom --bundle-identifier com.khogali.mudroom.safari --macos-only
```

Then, in that project:

1. Replace the generated `SafariWebExtensionHandler.swift` with `macos/safari/SafariWebExtensionHandler.swift` and set `appGroup`.
2. Add the same App Group to the extension target and to the Mudroom app target (uncomment it in `entitlements.plist`).
3. Launch the app with `MUDROOM_APP_GROUP=group.TEAMID.mudroom` (or hard-code it in `Paths.support`) so `mat.json` and the `inbox` folder live in the group container the extension can read.

Without an App Group, the Safari popup reports that the app isn't reachable. That's expected, not a crash.

## Rules of the house

- A file is only caught after its size and modification date sit still for two seconds (four for folders), and never while it has a browser's partial-download extension.
- Rooms are learned, not configured. Two sends from one domain to one folder makes that folder the one-keystroke default. Three sends of one extension does the same.
- Executables, installers, scripts, and anything with the quarantine flag get a badge and their source domain on the mat, before they ever touch Documents.
- The only delete path is the real Trash, at 30 days, from the Bagged folder, which you can see and rescue from.

## Known gaps

- Dragging boots from the mat into a Finder folder copies rather than moves (macOS drag semantics for file promises). Use shoes-off.
- Safari's "Open safe files after downloading" unzips archives. The resulting folder is caught as a folder.
- Browser "Show in Finder" links break once the file leaves Downloads.
