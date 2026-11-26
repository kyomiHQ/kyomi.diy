import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const kit = process.argv[2] ?? join(homedir(), ".agents/skills/glyph-kit");
const spec = fileURLToPath(new URL("./embeddings.glyph.json", import.meta.url));
const output = fileURLToPath(new URL("./embeddings.html", import.meta.url));
const result = spawnSync(
  process.execPath,
  [join(kit, "scripts/glyph-kit.mjs"), "export", spec, "--to", "html", "--out", output],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

// Long source paths must not set the minimum width of the report's grid columns.
// Keep this adjustment in the export so the HTML remains standalone and reproducible.
const responsive = `<style>
.r-sec, .r-text { min-width: 0; grid-template-columns: minmax(0, 1fr); }
.r-sec > *, .r-text > * { min-width: 0; }
.r-text p, .r-text code { overflow-wrap: anywhere; }
</style>`;
writeFileSync(output, readFileSync(output, "utf8").replace("</head>", `${responsive}\n</head>`));
