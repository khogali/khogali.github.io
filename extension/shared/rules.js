// Mudroom shared rules. Plain script (no modules) so the same file works in the
// MV3 service worker (importScripts), the popup, and Safari's converter output.
globalThis.Mudroom = (() => {
  const DAY = 86400000;
  const DUST_DAYS = 7;
  const BAG_DAYS = 14;
  const TRASH_DAYS = 30;
  const MAT = "Mudroom";

  const EXEC = new Set(["dmg", "pkg", "app", "sh", "zsh", "bash", "command", "py", "rb", "pl", "js", "jar", "exe", "msi", "bat", "cmd", "ps1", "scpt", "applescript", "workflow", "action", "terminal", "webloc"]);
  const ARCHIVE = new Set(["zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "iso"]);
  const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "webp", "heic", "svg", "tiff", "bmp", "avif"]);
  const DOC = new Set(["pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "txt", "md", "rtf", "pages", "numbers", "key", "json", "xml", "yaml", "yml"]);

  function ext(name) {
    const m = /\.([a-z0-9]{1,8})$/i.exec(name || "");
    return m ? m[1].toLowerCase() : "";
  }

  function kind(name) {
    const e = ext(name);
    if (EXEC.has(e)) return "exec";
    if (ARCHIVE.has(e)) return "archive";
    if (IMAGE.has(e)) return "image";
    if (DOC.has(e)) return "doc";
    return "other";
  }

  // "invoice (3).pdf" -> "invoice.pdf", "Copy of deck.key" -> "deck.key",
  // "3f2a9c1e-....pdf" stays as is only if nothing else is left.
  function cleanName(name) {
    if (!name) return name;
    const e = ext(name);
    let stem = e ? name.slice(0, -(e.length + 1)) : name;
    const original = stem;
    stem = stem
      .replace(/^(copy of|kopie von|copie de)\s+/i, "")
      .replace(/\s*\(\d+\)\s*$/, "")
      .replace(/[\s_-]+(final|final final|v\d+|copy|\d+)$/i, (m, w) => (/^v\d+$/i.test(w) ? m : ""))
      .replace(/[\s_-]*\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b[\s_-]*/i, " ")
      .replace(/[\s_-]*\b[0-9a-f]{24,}\b[\s_-]*/i, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!stem) stem = original.trim();
    return e ? `${stem}.${e}` : stem;
  }

  function domainOf(url) {
    try {
      const h = new URL(url).hostname.toLowerCase();
      return h.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  function decayState(arrivedAt, now = Date.now()) {
    const age = now - arrivedAt;
    if (age >= TRASH_DAYS * DAY) return "trash";
    if (age >= BAG_DAYS * DAY) return "bagged";
    if (age >= DUST_DAYS * DAY) return "dusty";
    return "fresh";
  }

  function ageLabel(arrivedAt, now = Date.now()) {
    const s = Math.max(0, Math.floor((now - arrivedAt) / 1000));
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 48) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  function fmtSize(n) {
    if (!n || n < 0) return "";
    const u = ["B", "KB", "MB", "GB"];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${n < 10 && i ? n.toFixed(1) : Math.round(n)} ${u[i]}`;
  }

  // rules = { byDomain: {domain: {room: count}}, byExt: {ext: {room: count}}, rooms: [names] }
  function emptyRules() { return { byDomain: {}, byExt: {}, rooms: [] }; }

  function best(table) {
    let room = null, count = 0;
    for (const [r, c] of Object.entries(table || {})) if (c > count) { room = r; count = c; }
    return { room, count };
  }

  // Domain wins over extension. Two prior sends make it "confident" (auto-route).
  function suggestRoom(rules, { domain, ext: e }) {
    const d = best(rules.byDomain?.[domain]);
    if (d.room) return { room: d.room, confident: d.count >= 2, why: domain };
    const x = best(rules.byExt?.[e]);
    if (x.room) return { room: x.room, confident: x.count >= 3, why: `.${e}` };
    return null;
  }

  function learn(rules, { domain, ext: e }, room) {
    if (!room || room === MAT) return rules;
    rules.byDomain ||= {}; rules.byExt ||= {}; rules.rooms ||= [];
    if (domain) { rules.byDomain[domain] ||= {}; rules.byDomain[domain][room] = (rules.byDomain[domain][room] || 0) + 1; }
    if (e) { rules.byExt[e] ||= {}; rules.byExt[e][room] = (rules.byExt[e][room] || 0) + 1; }
    rules.rooms = [room, ...rules.rooms.filter((r) => r !== room)].slice(0, 12);
    return rules;
  }

  return { MAT, DAY, DUST_DAYS, BAG_DAYS, TRASH_DAYS, ext, kind, cleanName, domainOf, decayState, ageLabel, fmtSize, emptyRules, suggestRoom, learn };
})();
