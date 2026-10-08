// Mudroom background.
// Chrome: holds each download at the door via onDeterminingFilename, routes it
// into a room (a Downloads subfolder) or onto the mat (Downloads/Mudroom).
// Safari: no downloads API exists, so this only proxies the popup to the
// native Mudroom app, which does the catching itself.
importScripts("shared/rules.js");

const M = globalThis.Mudroom;
const api = globalThis.browser || globalThis.chrome;
const hasDownloads = !!(api.downloads && api.downloads.onDeterminingFilename);
const NATIVE_HOST = "com.khogali.mudroom";
const DEFAULT_DOOR_TIMEOUT = 25000;

// downloadId -> { suggest, entry, timer }
const pending = new Map();
let keepAlive = null;

async function getState() {
  const s = await api.storage.local.get(["mat", "rules", "settings"]);
  return {
    mat: s.mat || [],
    rules: s.rules || M.emptyRules(),
    settings: { doorTimeout: DEFAULT_DOOR_TIMEOUT, ...(s.settings || {}) },
  };
}

async function upsert(entry) {
  const { mat } = await getState();
  const i = mat.findIndex((b) => b.id === entry.id);
  if (i >= 0) mat[i] = { ...mat[i], ...entry }; else mat.unshift(entry);
  await api.storage.local.set({ mat });
}

async function remove(id) {
  const { mat } = await getState();
  await api.storage.local.set({ mat: mat.filter((b) => b.id !== id) });
}

function badge() {
  const n = pending.size;
  api.action.setBadgeText({ text: n ? String(n) : "" });
  api.action.setBadgeBackgroundColor({ color: "#8a5a2b" });
}

function ensureKeepAlive() {
  if (pending.size && !keepAlive) keepAlive = setInterval(() => api.runtime.getPlatformInfo(() => {}), 20000);
  if (!pending.size && keepAlive) { clearInterval(keepAlive); keepAlive = null; }
}

// ---- The door ------------------------------------------------------------

async function handleDoor(item, suggest) {
  const base = (item.filename || "download").split(/[\\/]/).pop();
  const domain = M.domainOf(item.referrer || item.url);
  const { rules, settings } = await getState();
  const suggestion = M.suggestRoom(rules, { domain, ext: M.ext(base) });
  const entry = {
    id: item.id,
    name: base,
    cleanName: M.cleanName(base),
    url: item.url,
    referrer: item.referrer || "",
    domain,
    size: item.fileSize > 0 ? item.fileSize : item.totalBytes,
    mime: item.mime,
    kind: M.kind(base),
    arrivedAt: Date.now(),
    state: "door",
    room: null,
    suggested: suggestion,
    path: null,
  };

  if (suggestion && suggestion.confident) {
    await settle(entry, suggestion.room, entry.cleanName, suggest, { learned: false });
    return;
  }

  const timer = setTimeout(() => settle(entry, M.MAT, base, suggest, { timedOut: true }), settings.doorTimeout);
  pending.set(item.id, { suggest, entry, timer });
  await upsert(entry);
  badge();
  ensureKeepAlive();

  try {
    await api.action.openPopup();
  } catch {
    notifyAtDoor(entry);
  }
}

function notifyAtDoor(entry) {
  if (!api.notifications) return;
  const first = entry.suggested ? `→ ${entry.suggested.room}` : "→ Mudroom (mat)";
  api.notifications.create(`door-${entry.id}`, {
    type: "basic",
    iconUrl: "icons/128.png",
    title: `${entry.name} is at the door`,
    message: entry.domain ? `from ${entry.domain}` : "unknown source",
    buttons: [{ title: first }, { title: "Choose a room…" }],
    requireInteraction: true,
  });
}

async function settle(entry, room, name, suggest, { timedOut = false, learned = true } = {}) {
  const p = pending.get(entry.id);
  if (p) { clearTimeout(p.timer); pending.delete(entry.id); }
  const safeName = (name || entry.name).replace(/[\\/:*?"<>|]/g, "-").trim() || entry.name;
  const safeRoom = (room || M.MAT).replace(/^[\\/]+|[\\/]+$/g, "").replace(/\.\./g, "") || M.MAT;
  try { suggest({ filename: `${safeRoom}/${safeName}`, conflictAction: "uniquify" }); } catch {}
  const onMat = safeRoom === M.MAT;
  const patch = { ...entry, name: safeName, room: safeRoom, state: onMat ? "mat" : "home", settledAt: Date.now(), timedOut };
  if (!onMat && learned && !timedOut) {
    const { rules } = await getState();
    await api.storage.local.set({ rules: M.learn(rules, { domain: entry.domain, ext: M.ext(safeName) }, safeRoom) });
  }
  await upsert(patch);
  if (api.notifications) api.notifications.clear(`door-${entry.id}`);
  badge();
  ensureKeepAlive();
}

async function onChanged(delta) {
  if (delta.filename?.current) await upsert({ id: delta.id, path: delta.filename.current });
  if (delta.state?.current === "complete") {
    const [it] = await api.downloads.search({ id: delta.id });
    if (it) await upsert({ id: delta.id, size: it.fileSize, path: it.filename, completedAt: Date.now() });
  }
  if (delta.state?.current === "interrupted") await remove(delta.id);
}

if (hasDownloads) {
  api.downloads.onDeterminingFilename.addListener((item, suggest) => { handleDoor(item, suggest); return true; });
  api.downloads.onChanged.addListener(onChanged);
  if (api.notifications) {
    api.notifications.onButtonClicked.addListener(async (nid, idx) => {
      const id = Number(nid.replace("door-", ""));
      const p = pending.get(id);
      if (!p) return;
      if (idx === 0) await settle(p.entry, p.entry.suggested?.room || M.MAT, p.entry.cleanName, p.suggest);
      else { try { await api.action.openPopup(); } catch {} }
    });
  }
}

// ---- Decay: nothing is deleted automatically. States are relabelled. -------

api.alarms?.create("decay", { periodInMinutes: 60 });
api.alarms?.onAlarm.addListener(async (a) => {
  if (a.name !== "decay") return;
  const { mat } = await getState();
  const now = Date.now();
  const next = [];
  for (const b of mat) {
    if (b.state === "home") { if (now - (b.settledAt || b.arrivedAt) < 2 * M.DAY) next.push(b); continue; }
    if (hasDownloads) {
      const [it] = await api.downloads.search({ id: b.id });
      if (!it || !it.exists) continue; // file is gone; forget it
    }
    const d = M.decayState(b.arrivedAt, now);
    next.push({ ...b, state: d === "bagged" || d === "trash" ? "bagged" : "mat", decay: d });
  }
  await api.storage.local.set({ mat: next });
});

// ---- Native app handoff (Mac). Optional; everything works without it. ------

async function native(msg) {
  try { return await api.runtime.sendNativeMessage(NATIVE_HOST, msg); } catch (e) { return { ok: false, error: String(e) }; }
}

// ---- Popup protocol -------------------------------------------------------

api.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    switch (msg.type) {
      case "getState": {
        const s = await getState();
        return { ...s, hasDownloads, pendingIds: [...pending.keys()] };
      }
      case "settle": {
        const p = pending.get(msg.id);
        if (!p) return { ok: false, error: "no longer at the door" };
        await settle(p.entry, msg.room, msg.name, p.suggest);
        return { ok: true };
      }
      case "shoesOff": {
        // A finished file. Chrome cannot move it, so: teach the rule, hand to
        // the native app if present, otherwise open it in the file manager.
        const { mat, rules } = await getState();
        const b = mat.find((x) => x.id === msg.id);
        if (!b) return { ok: false };
        const name = msg.name || b.name;
        await api.storage.local.set({ rules: M.learn(rules, { domain: b.domain, ext: M.ext(name) }, msg.room) });
        const r = b.path ? await native({ op: "move", path: b.path, room: msg.room, name }) : { ok: false };
        if (!r.ok && hasDownloads) { try { api.downloads.show(b.id); } catch {} }
        await upsert({ id: b.id, state: "home", room: msg.room, name, settledAt: Date.now(), movedByApp: !!r.ok });
        return { ok: true, movedByApp: !!r.ok };
      }
      case "peek": if (hasDownloads) { try { api.downloads.open(msg.id); } catch {} } return { ok: true };
      case "show": if (hasDownloads) { try { api.downloads.show(msg.id); } catch {} } return { ok: true };
      case "throwOut": {
        // Explicit, user-confirmed in the popup. This is the only delete path.
        if (hasDownloads) { try { await api.downloads.removeFile(msg.id); } catch {} }
        await remove(msg.id);
        return { ok: true };
      }
      case "forget": await remove(msg.id); return { ok: true };
      case "setSettings": {
        const { settings } = await getState();
        await api.storage.local.set({ settings: { ...settings, ...msg.settings } });
        return { ok: true };
      }
      case "nativeState": return await native({ op: "getState" });
      case "nativeShoesOff": return await native({ op: "shoesOff", id: msg.id, room: msg.room, name: msg.name });
      case "nativeOpenMat": return await native({ op: "openMat" });
      default: return { ok: false, error: "unknown" };
    }
  })().then(reply, (e) => reply({ ok: false, error: String(e) }));
  return true;
});
