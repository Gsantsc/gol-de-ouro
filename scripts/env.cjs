const fs = require("fs");
const path = require("path");

const rootEnvPath = path.resolve(__dirname, "..", ".env");

function parseEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnv(filePath = rootEnvPath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = parseEnvValue(trimmed.slice(separator + 1));
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv();

function normalizeKeys(keys) {
  return Array.isArray(keys) ? keys : [keys];
}

function optionalEnv(keys, fallback) {
  for (const key of normalizeKeys(keys)) {
    const value = process.env[key];
    if (value !== undefined && value !== "") return value;
  }
  return fallback;
}

function requireEnv(keys, hint) {
  const value = optionalEnv(keys);
  if (value !== undefined && value !== "") return value;

  const names = normalizeKeys(keys).join(" ou ");
  const suffix = hint ? ` ${hint}` : "";
  throw new Error(`Configure ${names} no .env antes de rodar este script.${suffix}`);
}

function getSupabaseUrl() {
  return requireEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_URL"]);
}

function getSupabaseAnonKey() {
  return requireEnv([
    "SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ]);
}

function getSupabaseServiceKey() {
  return requireEnv(
    ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY"],
    "Use apenas a service role key local ou de ambiente seguro.",
  );
}

function getAdminCredentials() {
  return {
    email: requireEnv("TEST_ADMIN_EMAIL"),
    password: requireEnv("TEST_ADMIN_PASSWORD"),
  };
}

function getQaUser(prefix, fallbackEmail) {
  const email = fallbackEmail === undefined ? requireEnv(`${prefix}_EMAIL`) : optionalEnv(`${prefix}_EMAIL`, fallbackEmail);
  return {
    email,
    password: requireEnv(`${prefix}_PASSWORD`),
    name: optionalEnv(`${prefix}_NAME`, "QA Test User"),
  };
}

module.exports = {
  getAdminCredentials,
  getQaUser,
  getSupabaseAnonKey,
  getSupabaseServiceKey,
  getSupabaseUrl,
  loadEnv,
  optionalEnv,
  requireEnv,
};
