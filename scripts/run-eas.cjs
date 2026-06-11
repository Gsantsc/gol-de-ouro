const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const command = process.platform === "win32" ? "eas.cmd" : "eas";
const tempDir = path.join(os.tmpdir(), "gol-de-ouro-eas");
const projectRoot = path.resolve(process.cwd());
const cleanupPatch = path.join(__dirname, "eas-windows-cleanup-patch.cjs");
const nodeOptions = [
  process.env.NODE_OPTIONS,
  process.platform === "win32" ? `--require=${cleanupPatch}` : undefined,
]
  .filter(Boolean)
  .join(" ");

fs.rmSync(tempDir, { recursive: true, force: true });
fs.mkdirSync(tempDir, { recursive: true });

const result = spawnSync(command, process.argv.slice(2), {
  env: {
    ...process.env,
    EAS_NO_VCS: process.env.EAS_NO_VCS ?? "1",
    EAS_PROJECT_ROOT: process.env.EAS_PROJECT_ROOT ?? projectRoot,
    NODE_OPTIONS: nodeOptions || process.env.NODE_OPTIONS,
    TEMP: tempDir,
    TMP: tempDir,
    TMPDIR: tempDir,
  },
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
