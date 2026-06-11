const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");

const loadEnvFile = (filePath, override = false) => {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index <= 0) continue;

    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    if (override || process.env[key] === undefined) process.env[key] = value;
  }
};

loadEnvFile(path.join(rootDir, ".env"));
loadEnvFile(path.join(rootDir, "apps", "mobile", ".env"), true);

const appEnv = process.env.EXPO_PUBLIC_APP_ENV || process.env.APP_ENV || "development";
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const packageName = process.env.EXPO_ANDROID_PACKAGE || "";
const allowLocal = process.env.ALLOW_LOCAL_BETA_BUILD === "true";

const localUrlPattern = /^https?:\/\/(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/i;
const errors = [];

if (appEnv !== "beta") {
  errors.push(`EXPO_PUBLIC_APP_ENV precisa ser "beta" para build beta. Valor atual: "${appEnv}".`);
}

if (!supabaseUrl) {
  errors.push("EXPO_PUBLIC_SUPABASE_URL nao esta configurado.");
} else if (localUrlPattern.test(supabaseUrl) && !allowLocal) {
  errors.push(
    "EXPO_PUBLIC_SUPABASE_URL aponta para ambiente local. Use o Supabase beta remoto ou defina ALLOW_LOCAL_BETA_BUILD=true para teste interno.",
  );
}

if (!packageName || packageName === "app.goldeouro.mobile") {
  errors.push("EXPO_ANDROID_PACKAGE ainda esta no placeholder. Defina um package definitivo, ex: br.com.goldeouro.app.");
}

if (errors.length) {
  console.error("Beta env invalido:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(JSON.stringify({
  appEnv,
  packageName,
  supabaseUrl,
  status: "ok",
}, null, 2));
