const { spawnSync } = require("child_process");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

process.env.GOL_DE_OURO_ENTRY = "dashboard";
process.env.GOL_DE_OURO_COPY_WEB_OUTPUT = "1";
process.env.VERCEL ??= "1";

const result = spawnSync(npmCommand, ["run", "build", "-w", "@gol-de-ouro/admin"], {
  cwd: rootDir,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (result.error) {
  console.error(`[vercel-user-build] Failed to start ${npmCommand}: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`[vercel-user-build] User build failed with status ${result.status}.`);
  process.exit(result.status ?? 1);
}

require("./vercel-web-output.cjs");
