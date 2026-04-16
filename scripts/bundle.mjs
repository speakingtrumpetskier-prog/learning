// Bundles modular source into a single self-contained HTML file (play.html)
// that works when double-clicked (file://) — no web server required.
//
// Strategy: concatenate modules in dependency order, strip `import ... from`
// and leading `export ` keywords, wrap in an IIFE, inline in <script> tag
// (non-module) within the HTML shell.

import fs from "fs";
import path from "path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const jsDir = path.join(root, "js");

// Dependency order (topologically sorted).
const order = [
  "utils.js",
  "particles.js",
  "input.js",
  "audio.js",
  "entities.js",
  "level.js",
  "levels.js",
  "player.js",
  "render.js",
  "game.js",
  "main.js",
];

function stripModule(src) {
  // Remove import lines.
  src = src.replace(/^import\s+[^;]*;\s*$/gm, "");
  // Remove `export ` keyword prefix on declarations.
  src = src.replace(/^export\s+(class|function|const|let|var)\b/gm, "$1");
  // Collapse leftover blank runs.
  src = src.replace(/\n{3,}/g, "\n\n");
  return src;
}

const bundled = order
  .map(f => {
    const src = fs.readFileSync(path.join(jsDir, f), "utf8");
    return `// ===== ${f} =====\n` + stripModule(src);
  })
  .join("\n\n");

// HTML shell (same as index.html but with inlined styles & script).
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css  = fs.readFileSync(path.join(root, "style.css"), "utf8");

let out = html
  .replace(/<link rel="stylesheet" href="style\.css">/, `<style>\n${css}\n</style>`)
  .replace(/<script type="module" src="js\/main\.js"><\/script>/,
    `<script>\n(function(){\n${bundled}\n})();\n</script>`);

fs.writeFileSync(path.join(root, "play.html"), out);
console.log("wrote play.html (" + out.length + " bytes)");
