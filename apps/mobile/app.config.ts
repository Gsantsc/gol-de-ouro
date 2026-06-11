const fs = require("fs");
const path = require("path");

const rootEnvPath = path.resolve(__dirname, "../..", ".env");
const mobileEnvPath = path.resolve(__dirname, ".env");

const loadEnvFile = (envPath: string, override = false) => {
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
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

loadEnvFile(rootEnvPath);
loadEnvFile(mobileEnvPath, true);

const androidVersionCode = Number(process.env.EXPO_ANDROID_VERSION_CODE ?? "1");

module.exports = {
  expo: {
    name: "Gol de Ouro",
    slug: "gol-de-ouro",
    scheme: "goldeouro",
    version: "0.1.0",
    icon: "./public/icons/icon-512.png",
    orientation: "portrait",
    userInterfaceStyle: "dark",
    platforms: ["ios", "android", "web"],
    android: {
      package: process.env.EXPO_ANDROID_PACKAGE || "br.com.goldeouro.app",
      versionCode: Number.isFinite(androidVersionCode) ? androidVersionCode : 1
    },
    web: {
      bundler: "metro",
      favicon: "./public/icons/icon-192.png",
      output: "single"
    },
    extra: {
      appEnv: process.env.EXPO_PUBLIC_APP_ENV || process.env.APP_ENV || "development",
      eas: {
        projectId: process.env.EXPO_EAS_PROJECT_ID || "a8c8cf09-d06c-4823-a2a6-c0b4c2d75196"
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    },
    entryPoint: "index.ts"
  }
};
