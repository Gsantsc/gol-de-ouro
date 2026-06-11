const fs = require("fs");
const path = require("path");

// Next 14 attempts to patch the root lockfile incorrectly in this npm workspace.
process.env.NEXT_IGNORE_INCORRECT_LOCKFILE ??= "1";

const configDir = __dirname;
const rootDir = path.resolve(configDir, "../..");

const loadEnvFile = (envPath) => {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
};

loadEnvFile(path.join(rootDir, ".env"));

const nextConfig = {
  distDir:
    process.env.GOL_DE_OURO_ENTRY === "dashboard"
      ? ".next-dashboard"
      : process.env.GOL_DE_OURO_ENTRY === "admin"
        ? ".next-admin"
        : ".next-build",
  transpilePackages: ["@gol-de-ouro/shared"],
  experimental: {
    optimizePackageImports: ["lucide-react"]
  }
};

module.exports = nextConfig;
