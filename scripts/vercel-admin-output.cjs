const fs = require("fs");
const path = require("path");

const isAdminVercelBuild =
  process.env.VERCEL === "1" && process.env.GOL_DE_OURO_ENTRY === "admin";

if (!isAdminVercelBuild) {
  process.exit(0);
}

const rootDir = path.resolve(__dirname, "..");
const sourceDir = path.join(rootDir, "apps", "admin", ".next");
const targetDir = path.join(rootDir, ".next");

if (!fs.existsSync(sourceDir)) {
  console.error(`[vercel-admin-output] Build output not found: ${sourceDir}`);
  process.exit(1);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log("[vercel-admin-output] Copied apps/admin/.next to .next for Vercel.");
