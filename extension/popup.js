const M = globalThis.Mudroom;
const api = globalThis.browser || globalThis.chrome;
const $ = (s, r = document) => r.querySelector(s);
const send = (msg) => api.runtime.sendMessage(msg);

let state = null;      // from background: { mat, rules, settings, hasDownloads, pendingIds }
let nativeMat = null;  // from the Mac app, when reachable
let open = new Set();  // ids with the shoes-off card expanded

async function load() {
  state = await send({ type: "getState" });
  if (!state.hasDownloads) {
    // Safari: the app is the only source of truth.
    const r = await send({ type: "nativeState" });
    nativeMat = r && r.ok ? r : null;
  }
  render();
}

function roomsFor(b) {
  const rules = state.rules || M.emptyRules();
  const sug = b.suggested || M.suggestRoom(rules, { domain: b.domain, ext: M.ext(b.name) });
  const list = [];
  if (sug) list.push({ room: sug.room, suggested: true, why: sug.why });
  for (const r of rules.rooms || []) if (!list.some((x) => x.room === r)) list.push({ room: r });
  if (!list.some((x) => x.room === M.MAT)) list.push({ room: M.MAT, mat: true });
  return list;
}

function bootEl(b, { atDoor = false, native = false } = {}) {
  const tpl = $("#bootTpl").content.cloneNode(true);
  const el = tpl.querySelector(".boot");
  const kind = b.kind || M.kind(b.name);
  const k = $("[data-kind]", el); k.dataset.kind = kind; k.textContent = { doc: "DOC", image: "IMG", archive: "ZIP", exec: "EXE", other: "···" }[kind];
  $("[data-name]", el).textContent = b.name;
  $("[data-domain]", el).textContent = b.domain || b.source || "unknown source";
  $("[data-age]", el).textContent = M.ageLabel(b.arrivedAt);
  $("[data-size]", el).textContent = M.fmtSize(b.size);
  $("[data-flag]", el).textContent = kind === "exec" ? "runs code" : b.quarantined ? "quarantined" : "";
  const decay = atDoor ? "" : (b.decay || M.decayState(b.arrivedAt));
  const d = $("[data-decay]", el); d.dataset.decay = decay; d.textContent = { fresh: "", dusty: "dusty", bagged: "bagged", trash: "overdue" }[decay] || "";

  const shoes = $("[data-shoes]", el);
  const rename = $("[data-rename]", el);
  const roomsEl = $("[data-rooms]", el);
  const newroom = $("[data-newroom]", el);
  const note = $("[data-note]", el);
  let selected = null;

  rename.value = b.cleanName || M.cleanName(b.name);
  for (const r of roomsFor(b)) {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "room" + (r.suggested ? " suggested" : ""); btn.textContent = r.mat ? "Mudroom (mat)" : r.room;
    if (r.why) btn.title = `learned from ${r.why}`;
    btn.onclick = () => { selected = r.room; newroom.value = ""; roomsEl.querySelectorAll(".room").forEach((x) => x.classList.toggle("selected", x === btn)); };
    roomsEl.append(btn);
    if (r.suggested) btn.click();
  }
  if (!selected && atDoor) roomsEl.querySelector(".room:last-child")?.click();

  if (atDoor) {
    note.textContent = "Pick a room and it lands there. Do nothing and it goes to the mat in a few seconds.";
    $("[data-peek]", el).remove(); $("[data-show]", el).remove(); $("[data-throw]", el).remove();
  } else if (native) {
    note.textContent = "Handled by the Mudroom app. Shoes off moves the file for real.";
    $("[data-throw]", el).remove();
  } else {
    note.textContent = "Finished file: Chrome can't move it. Shoes off teaches the rule and shows it in Finder, or lets the Mudroom app move it if installed.";
  }

  $(".row", el).onclick = () => { open.has(b.id) ? open.delete(b.id) : open.add(b.id); shoes.classList.toggle("hidden", !open.has(b.id)); };
  if (atDoor || open.has(b.id)) { shoes.classList.remove("hidden"); if (atDoor) setTimeout(() => rename.select(), 0); }

  shoes.onsubmit = async (e) => {
    e.preventDefault();
    const room = (newroom.value.trim() || selected || M.MAT).replace(/[\\/]+$/, "");
    const name = rename.value.trim() || b.name;
    if (atDoor) await send({ type: "settle", id: b.id, room, name });
    else if (native) await send({ type: "nativeShoesOff", id: b.id, room, name });
    else await send({ type: "shoesOff", id: b.id, room, name });
    open.delete(b.id);
    await load();
  };
  $("[data-peek]", el) && ($("[data-peek]", el).onclick = () => send({ type: "peek", id: b.id }));
  $("[data-show]", el) && ($("[data-show]", el).onclick = () => send({ type: "show", id: b.id }));
  $("[data-throw]", el) && ($("[data-throw]", el).onclick = async () => {
    if (!confirm(`Throw out "${b.name}"? This deletes the file from disk. It does not go to the Trash.`)) return;
    await send({ type: "throwOut", id: b.id }); await load();
  });
  return el;
}

function render() {
  const now = Date.now();
  const pendingIds = new Set(state.pendingIds || []);
  const items = nativeMat ? nativeMat.mat : state.mat;
  const door = items.filter((b) => b.state === "door" && pendingIds.has(b.id));
  const mat = items.filter((b) => b.state === "mat" || (b.state === "door" && !pendingIds.has(b.id))).filter((b) => M.decayState(b.arrivedAt, now) !== "bagged" && M.decayState(b.arrivedAt, now) !== "trash" && b.state !== "bagged");
  const bagged = items.filter((b) => b.state === "bagged" || (b.state === "mat" && ["bagged", "trash"].includes(M.decayState(b.arrivedAt, now))));

  const doorEl = $("#door"), doorList = $("#doorList");
  doorList.replaceChildren(...door.map((b) => bootEl(b, { atDoor: true })));
  doorEl.classList.toggle("hidden", !door.length);

  $("#matList").replaceChildren(...mat.map((b) => bootEl(b, { native: !!nativeMat })));
  $("#matCount").textContent = mat.length || "";
  $("#matEmpty").classList.toggle("hidden", !!mat.length);

  $("#baggedList").replaceChildren(...bagged.map((b) => bootEl(b, { native: !!nativeMat })));
  $("#bagged").classList.toggle("hidden", !bagged.length);

  $("#doorTimeout").value = Math.round((state.settings.doorTimeout || 25000) / 1000);
  $("#rulesDump").textContent = JSON.stringify(state.rules, null, 1);
  $("#nativeStatus").textContent = nativeMat ? "Mudroom app connected." : state.hasDownloads ? "Mudroom app not detected. Chrome-only mode: files are routed at the door, finished files can't be moved." : "Safari can't see downloads. Install the Mudroom app; this popup is a window onto its mat.";
  $("#foot").textContent = nativeMat ? "" : state.hasDownloads ? `Rooms are folders under Downloads. ${M.BAG_DAYS} days on the mat gets a file bagged; nothing is deleted unless you throw it out.` : "";
}

$("#settingsBtn").onclick = () => $("#settings").classList.toggle("hidden");
$("#doorTimeout").onchange = async (e) => { await send({ type: "setSettings", settings: { doorTimeout: Math.max(5, Number(e.target.value)) * 1000 } }); };
api.storage.onChanged.addListener(() => load());
load();
