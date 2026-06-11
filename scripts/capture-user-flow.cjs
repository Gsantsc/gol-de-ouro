const fs = require("fs");
const Module = require("module");
const path = require("path");
const { optionalEnv } = require("./env.cjs");

let playwright;
try {
  if (process.env.NODE_PATH) Module._initPaths();
  playwright = require("playwright");
} catch (error) {
  throw new Error(`Playwright não encontrado. Execute com NODE_PATH apontando para o runtime local do Codex. Causa: ${error.message}`);
}

const BASE_URL = optionalEnv("QA_USER_FLOW_BASE_URL", "http://127.0.0.1:3002/dashboard");
const EMAIL = optionalEnv("QA_USER_FLOW_EMAIL", "qa-user-flow-01@qa.local");
const PASSWORD = optionalEnv("QA_USER_FLOW_PASSWORD", "QaUserFlow#2026");
const EDGE_PATH = optionalEnv("QA_BROWSER_PATH", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
const ARTIFACT_DIR = path.join(process.cwd(), "artifacts");
const VIDEO_DIR = path.join(ARTIFACT_DIR, "videos");

const tabs = [
  ["home", "Home"],
  ["games", "Jogos"],
  ["predictions", "Palpites"],
  ["ranking", "Ranking"],
  ["groups", "Ligas"],
  ["profile", "Perfil"],
];

const waitForApp = async (page) => {
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => undefined);
  await page.waitForTimeout(700);
};

const screenshot = async (page, name) => {
  const filePath = path.join(ARTIFACT_DIR, `${name}.png`);
  await page.screenshot({ fullPage: true, path: filePath });
  return filePath;
};

const run = async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.mkdirSync(VIDEO_DIR, { recursive: true });

  const browser = await playwright.chromium.launch({
    executablePath: fs.existsSync(EDGE_PATH) ? EDGE_PATH : undefined,
    headless: true,
  });
  const context = await browser.newContext({
    recordVideo: {
      dir: VIDEO_DIR,
      size: { height: 900, width: 1440 },
    },
    viewport: { height: 900, width: 1440 },
  });
  const page = await context.newPage();

  await page.goto(BASE_URL);
  await waitForApp(page);

  if (await page.locator('input[type="email"]').count()) {
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: /^Entrar$/ }).click();
    await page.waitForSelector("text=QA_USER_FLOW Participante 1", { timeout: 30000 });
  }

  const files = {};
  for (const [tab, label] of tabs) {
    await page.goto(`${BASE_URL}?tab=${tab}`);
    await waitForApp(page);
    await page.waitForSelector(`text=${label}`, { timeout: 30000 }).catch(() => undefined);
    files[tab] = await screenshot(page, `qa-user-flow-${tab}`);
  }

  const responsive = [
    ["tablet", 768, 1024, "home"],
    ["mobile-home", 390, 844, "home"],
    ["mobile-games", 390, 844, "games"],
    ["mobile-profile", 390, 844, "profile"],
  ];

  for (const [name, width, height, tab] of responsive) {
    await page.setViewportSize({ width, height });
    await page.goto(`${BASE_URL}?tab=${tab}`);
    await waitForApp(page);
    files[name] = await screenshot(page, `qa-user-flow-${name}`);
  }

  await context.close();
  await browser.close();

  const videoFiles = fs.existsSync(VIDEO_DIR)
    ? fs.readdirSync(VIDEO_DIR).filter((file) => file.endsWith(".webm")).map((file) => path.join(VIDEO_DIR, file))
    : [];

  const summary = {
    screenshots: files,
    video: videoFiles.at(-1) ?? null,
  };
  fs.writeFileSync(path.join(ARTIFACT_DIR, "qa-user-flow-visual-evidence.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
