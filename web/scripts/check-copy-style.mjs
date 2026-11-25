import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, resolve } from "node:path";

// Keep Unicode code points here so the checker does not contain the glyphs it
// rejects. This includes common decorative midpoints and typographic bullets.
const forbidden = new Set([0x00b7, 0x2022, 0x2027, 0x2219, 0x30fb, 0x22c5]);
const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const targets = ["AGENTS.md", "README.md", "docs", "web/README.md", "web/src", "web/tests", "web/scripts"];
const allowedExtensions = new Set([".md", ".ts", ".tsx", ".css", ".mjs", ".json"]);
const errors = [];

function inspect(path) {
  const stats = statSync(path);
  if (stats.isDirectory()) {
    for (const name of readdirSync(path)) inspect(join(path, name));
    return;
  }
  if (!stats.isFile() || ![...allowedExtensions].some((ext) => path.endsWith(ext))) return;
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const found = [...lines[i]].filter((ch) => forbidden.has(ch.codePointAt(0)));
    if (found.length) errors.push(`${relative(root, path)}:${i + 1} contains a disallowed decorative separator`);
  }
}

for (const target of targets) inspect(resolve(root, target));
if (errors.length) {
  console.error(`Copy-style check failed (${errors.length} location(s)):`);
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Copy-style check passed: no decorative middle-dot or bullet glyphs in project-owned content.");
}
