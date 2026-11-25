import { spawn } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const child = spawn(
  "cargo",
  [
    "build",
    "--locked",
    "--release",
    "--target",
    "wasm32-unknown-unknown",
    "--target-dir",
    join(directory, "target"),
  ],
  { cwd: directory, stdio: "inherit" },
);
const status = await new Promise<number>((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code) => resolve(code ?? 1));
});
if (status !== 0) {
  process.exit(status);
}
await mkdir(join(directory, "dist"), { recursive: true });
await copyFile(
  join(directory, "target/wasm32-unknown-unknown/release/kyomi_encoders.wasm"),
  join(directory, "dist/kyomi_encoders.wasm"),
);
