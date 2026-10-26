// Pull every piece of on-screen English out of the source into
// src/i18n/en.json (sorted keys, value = key). Re-run after adding UI text,
// then translate the new keys into the other languages.
//
//   node scripts/i18n-extract.cjs
//
// What counts as UI text: JSX text, string attributes people read
// (placeholder, aria-label, title, alt, label...), and string/template
// literals that read like language (a space or a capitalised word, no code
// punctuation). Template literals become patterns: `${n} members` -> "{0} members".
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const ROOT = path.join(__dirname, "..");
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { if (!/i18n|node_modules/.test(f)) walk(p); }
    // terms.js is the legal text: translated as whole documents, not here.
    // main.jsx holds dev-only previews.
    else if (/\.(jsx?|js)$/.test(f) && !/\.test\.|terms(\.[\w-]+)?\.js$|^main\.jsx$/.test(f)) files.push(p);
  }
})(path.join(ROOT, "src"));

// Attributes that are never words people read; every other string prop
// (title, line, hint, label, sub...) is checked like any other text.
const TECH_ATTRS = new Set(["className", "class", "id", "key", "type", "href", "src", "srcSet", "style", "name", "role", "rel", "target", "d", "viewBox",
  "fill", "stroke", "strokeWidth", "strokeLinecap", "strokeLinejoin", "accept", "autoComplete", "inputMode", "pattern", "lang", "dir", "method", "action",
  "htmlFor", "for", "loading", "decoding", "preload", "crossOrigin", "referrerPolicy", "sizes", "media", "as", "mode", "variant", "size", "color",
  "icon", "k", "tab", "kind", "status", "align", "justify", "position", "transform", "points", "x", "y", "cx", "cy", "r", "rx", "ry", "width", "height",
  "data-k", "data-on", "aria-hidden", "aria-checked", "aria-selected", "aria-expanded", "aria-haspopup", "aria-pressed", "aria-current", "aria-live",
  "enterKeyHint", "autoCapitalize", "spellCheck", "capture", "download", "tabIndex", "value", "defaultValue", "min", "max", "step", "maxLength"]);
const keys = new Set();

const norm = (s) => s.replace(/\s+/g, " ").trim();
function looksLikeLanguage(raw) {
  // Placeholders from template literals don't count as code punctuation.
  const s = raw.replace(/\{\d+\}/g, "0");
  if (!/[A-Za-z]{2}/.test(s)) return false;
  if (s.length > 600) return false;
  if (/^(https?:|mailto:|\/|#|\.|data:)/.test(s)) return false;
  if (/[{};=<>]|=>|\b(function|return|const|var)\b/.test(s)) return false;
  if (/^[a-z0-9_\-:.\/]+$/.test(s)) return false;          // ids, keys, classes, paths
  if (/^[a-z][a-zA-Z0-9]*$/.test(s)) return false;          // camelCase identifiers
  if (/^[a-z-]+(\s+[a-z0-9-:\[\]\/.%#()]+)+$/.test(s) && !/\b(the|a|an|to|of|and|or|your|you|is|in|on|for|with|this|it|be|not|no|my|we|our|at|as|by)\b/.test(s)) return false; // class lists
  if (/^(rgba?|hsla?|var|calc|url|linear-gradient)\(/.test(s)) return false;
  if (/^\d/.test(s) && !/[a-z]{3}/i.test(s)) return false;
  if (/^[A-Z_]+$/.test(s)) return false;                    // CONSTANTS
  if (/\.(png|jpe?g|webp|svg|mp3|mp4|pdf|json|css|js)$/i.test(s)) return false;
  if (/\b\d+(px|rem|em|ms|s|deg|%)\b|\brgba?\(|^(\d+ ?)+auto$|^[\d. ]+$/.test(s)) return false;   // CSS values
  if (/^(Escape|Enter|Tab|Backspace|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Space)$/.test(s)) return false;
  if (/^(Bearer |Component stack|\[artium\])/.test(s)) return false;   // headers and console logs
  if (/(sans-serif|serif|monospace|system-ui)\s*$/.test(s) && /,/.test(s)) return false;   // font stacks
  if (/[àâçéèêëîïôûùüÿœ].*\b(le|la|les|des|du|une|et|est|vous|nous|à)\b|\b(le|la|les|des|du|une|et|est|vous|nous)\b.*[àâçéèêëîïôûùüÿœ]/i.test(s)) return false; // French copy, already French
  return /\s/.test(s) || /^[A-Z][a-z]/.test(s) || /^[A-Z][A-Z]+[a-z]/.test(s);
}
// Never words to translate: the language names (each in its own language),
// pieces of the ARTIUM wordmark, addresses.
const NEVER = new Set(["Deutsch", "English", "Español", "Français", "Italiano", "Nederlands", "Polski", "Português do Brasil", "RTIUM", "art", "ium", "artium",
  "xMidYMid meet", "art-ium.com", "contact@art-ium.com", "@aclassicaltone", "aclassicaltone", "Règles de communauté et de sécurité"]);
function add(s) { const t = norm(s); if (t && !NEVER.has(t) && looksLikeLanguage(t)) keys.add(t); }

for (const file of files) {
  const code = fs.readFileSync(file, "utf8");
  let ast;
  try { ast = parser.parse(code, { sourceType: "module", plugins: ["jsx"], errorRecovery: true }); }
  catch (e) { console.error("skip", file, e.message); continue; }
  traverse(ast, {
    // JSX text is always on screen: any piece with a word in it, including
    // one-word sentence ends like "community." around an inline element.
    JSXText(p) { const t = norm(p.node.value); if (/[A-Za-z]{2}/.test(t) && !/[{};=<>]/.test(t) && !NEVER.has(t)) keys.add(t); },
    JSXAttribute(p) {
      const v = p.node.value;
      const name = p.node.name.name;
      if (v && v.type === "StringLiteral" && !TECH_ATTRS.has(name) && !/^on[A-Z]/.test(name)) add(v.value);
    },
    StringLiteral(p) {
      const par = p.parent;
      // Already written in each language (the legal-translation notes).
      if (p.findParent((q) => q.isVariableDeclarator() && q.node.id && q.node.id.name === "LEGAL_NOTE")) return;
      // Places (rows with coordinates): proper names, shown as written.
      const obj = p.findParent((q) => q.isObjectExpression());
      if (obj && obj.node.properties.some((pr) => pr.key && (pr.key.name === "lat" || pr.key.value === "lat"))) return;
      if (par.type === "ImportDeclaration" || par.type === "ExportAllDeclaration" || par.type === "ExportNamedDeclaration") return;
      if (par.type === "JSXAttribute") return; // handled above (className etc. skipped)
      if (par.type === "ObjectProperty" && par.key === p.node) return;
      if (par.type === "CallExpression" && par.callee && /^(require|import|getElementById|querySelector|querySelectorAll|addEventListener|removeEventListener|getItem|setItem|removeItem|from|select|eq|order|rpc|invoke|channel|matchMedia|createElement|setAttribute|getAttribute)$/.test(par.callee.property?.name || par.callee.name || "")) return;
      add(p.node.value);
    },
    TemplateLiteral(p) {
      const { quasis, expressions } = p.node;
      if (p.parent.type === "TaggedTemplateExpression") return;
      let s = "";
      quasis.forEach((q, i) => { s += q.value.cooked ?? q.value.raw; if (i < expressions.length) s += `{${i}}`; });
      const lettersOnly = s.replace(/\{\d+\}/g, "");
      if (expressions.length && !/[A-Za-z]{3}.*\s|\s.*[A-Za-z]{3}/.test(lettersOnly)) return;
      add(s);
    },
  });
}

// Keys never disappear on re-extraction: text moved or reworded stays
// harmless, and the other languages keep lining up with en.json.
const enPath = path.join(ROOT, "src/i18n/en.json");
try { Object.keys(JSON.parse(fs.readFileSync(enPath, "utf8"))).forEach((k) => keys.add(k)); } catch { /* first run */ }
const out = {};
[...keys].sort().forEach((k) => { out[k] = k; });
fs.mkdirSync(path.join(ROOT, "src/i18n"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "src/i18n/en.json"), JSON.stringify(out, null, 1) + "\n");
console.log(Object.keys(out).length, "keys,", Object.keys(out).reduce((a, k) => a + k.split(" ").length, 0), "words");
