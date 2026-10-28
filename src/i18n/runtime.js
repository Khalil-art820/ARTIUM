// Live translation of everything the app shows.
//
// The app is written in English. Rather than threading t() through ~1,350
// strings in 24k lines, this layer watches the page and swaps each piece of
// English it knows (src/i18n/en.json keys, extracted by
// scripts/i18n-extract.cjs) for the chosen language's text: text nodes, the
// attributes people read (placeholder, aria-label, title, alt), the tab title,
// and alert/confirm dialogs. React keeps rendering English; when it changes a
// node, the observer sees the new English and translates that.
//
// Only exact UI strings are replaced, so what members write (names, bios,
// messages) is left alone. Anything inside [data-no-translate] or
// [translate="no"] is skipped too (the legal documents, which carry their own
// translations, and the language lists).
//
// Keys may hold placeholders — "{0} members" — for text built from template
// literals; those are matched as patterns.

const loaders = import.meta.glob("./*.json");
const ATTRS = ["placeholder", "aria-label", "title", "alt"];
// Text inside drawings (<text> in an SVG, like the globe pin) is translated too.
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);

let lang = "en";
let exact = null;      // Map english -> translated
let patterns = [];     // [{ re, out, anchor }]
const origText = new WeakMap();   // text node -> English
const setText = new WeakMap();    // text node -> what we last wrote
const origAttr = new WeakMap();   // element -> { attr: English }
const setAttr = new WeakMap();    // element -> { attr: what we last wrote }
let observer = null;
let origTitle = null;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function compile(dict) {
  exact = new Map();
  patterns = [];
  for (const [k, v] of Object.entries(dict)) {
    if (!v || v === k) continue;
    if (/\{\d+\}/.test(k)) {
      const parts = k.split(/(\{\d+\})/);
      const order = [];
      const re = new RegExp("^" + parts.map((p) => {
        const m = p.match(/^\{(\d+)\}$/);
        if (m) { order.push(+m[1]); return "(.+?)"; }
        return esc(p);
      }).join("") + "$", "s");
      // The longest literal piece, to skip patterns cheaply.
      const anchor = parts.filter((p) => !/^\{\d+\}$/.test(p)).sort((a, b) => b.length - a.length)[0] || "";
      patterns.push({ re, order, out: v, anchor });
    } else exact.set(k, v);
  }
}

function tr(s) {
  if (!exact || !s) return null;
  const lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0];
  const core = s.slice(lead.length, s.length - tail.length).replace(/\s+/g, " ");
  if (!core || !/[A-Za-z]/.test(core)) return null;
  let out = exact.get(core);
  if (out == null) {
    for (const p of patterns) {
      if (p.anchor && !core.includes(p.anchor)) continue;
      const m = core.match(p.re);
      if (!m) continue;
      const vals = {};
      p.order.forEach((n, i) => { vals[n] = m[i + 1]; });
      out = p.out.replace(/\{(\d+)\}/g, (_, n) => (vals[n] != null ? vals[n] : ""));
      break;
    }
  }
  return out == null ? null : lead + out + tail;
}
export const translateString = (s) => (lang === "en" ? s : tr(s) ?? s);

function skipped(el) {
  for (let e = el; e && e.nodeType === 1; e = e.parentNode) {
    if (SKIP_TAGS.has(e.tagName) || e.isContentEditable) return true;
    if (e.hasAttribute("data-no-translate") || e.getAttribute("translate") === "no") return true;
  }
  return false;
}

function doText(node) {
  const now = node.nodeValue;
  if (setText.get(node) === now) return;            // our own write
  origText.set(node, now);                            // React wrote new English
  if (lang === "en") return;
  if (skipped(node.parentNode)) return;
  const out = tr(now);
  if (out != null && out !== now) { setText.set(node, out); node.nodeValue = out; }
}
function doAttrs(el) {
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const now = el.getAttribute(a);
    const mine = setAttr.get(el);
    if (mine && mine[a] === now) continue;
    const o = origAttr.get(el) || {}; o[a] = now; origAttr.set(el, o);
    if (lang === "en" || skipped(el)) continue;
    const out = tr(now);
    if (out != null && out !== now) {
      const m = setAttr.get(el) || {}; m[a] = out; setAttr.set(el, m);
      el.setAttribute(a, out);
    }
  }
}
function walk(root) {
  if (root.nodeType === 3) { doText(root); return; }
  if (root.nodeType !== 1) return;
  if (SKIP_TAGS.has(root.tagName)) return;
  doAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 3) doText(n); else doAttrs(n);
  }
}

// Put everything back to the English we recorded (switching language or
// back to English).
function restoreAll() {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 3) {
      const o = origText.get(n);
      if (o != null && setText.get(n) === n.nodeValue && o !== n.nodeValue) { setText.set(n, o); n.nodeValue = o; }
    } else {
      const o = origAttr.get(n), mine = setAttr.get(n);
      if (o && mine) for (const a of Object.keys(mine)) if (n.getAttribute(a) === mine[a]) { mine[a] = o[a]; n.setAttribute(a, o[a]); }
    }
  }
}

function retitle() {
  if (origTitle == null || document.title !== (tr(origTitle) ?? origTitle)) origTitle = document.title;
  const t = lang === "en" ? origTitle : tr(origTitle);
  if (t && document.title !== t) document.title = t;
}

function start() {
  if (observer) return;
  observer = new MutationObserver((list) => {
    if (lang === "en") return;
    for (const m of list) {
      if (m.type === "characterData") doText(m.target);
      else if (m.type === "attributes") { if (m.target.nodeType === 1) doAttrs(m.target); }
      else m.addedNodes.forEach(walk);
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  // Native dialogs don't go through the DOM.
  for (const fn of ["alert", "confirm", "prompt"]) {
    const orig = window[fn].bind(window);
    window[fn] = (msg, ...rest) => orig(typeof msg === "string" ? translateString(msg) : msg, ...rest);
  }
}

export async function setLanguage(next) {
  const target = next && next !== "en" ? next : "en";
  if (target === lang && (target === "en" || exact)) return;
  restoreAll();
  if (target === "en") { lang = "en"; exact = null; patterns = []; }
  else {
    const load = loaders[`./${target}.json`];
    if (!load) { lang = "en"; return; }
    const dict = (await load()).default;
    lang = target; compile(dict);
  }
  document.documentElement.lang = target;
  start();
  if (lang !== "en") walk(document.body);
  retitle();
}
export const currentLanguage = () => lang;
