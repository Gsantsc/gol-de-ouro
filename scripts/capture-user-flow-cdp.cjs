const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { optionalEnv } = require("./env.cjs");

const WebSocketClient = globalThis.WebSocket ?? require("ws");

const BASE_URL = optionalEnv("QA_USER_FLOW_BASE_URL", "http://127.0.0.1:3002/dashboard");
const EMAIL = optionalEnv("QA_USER_FLOW_EMAIL", "qa-user-flow-01@qa.local");
const PASSWORD = optionalEnv("QA_USER_FLOW_PASSWORD", "QaUserFlow#2026");
const EDGE_PATH = optionalEnv("QA_BROWSER_PATH", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
const PORT = Number(optionalEnv("QA_CDP_PORT", "9333"));
const ARTIFACT_DIR = path.join(process.cwd(), "artifacts");
const PROFILE_DIR = path.join(ARTIFACT_DIR, "edge-qa-profile");

const tabs = [
  ["home", "Home"],
  ["games", "Jogos"],
  ["predictions", "Palpites"],
  ["ranking", "Ranking"],
  ["groups", "Ligas"],
  ["profile", "Perfil"],
];

const tabReadinessText = {
  games: "Jogos da Copa do Mundo 2026",
  groups: "Minhas ligas",
  home: "Central da rodada",
  predictions: "Meus Palpites",
  profile: "Resumo de desempenho",
  ranking: "Classificacao",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
};

const waitForCdp = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      return await requestJson(`http://127.0.0.1:${PORT}/json/version`);
    } catch {
      await sleep(500);
    }
  }
  throw new Error("Edge DevTools não ficou disponível.");
};

class Cdp {
  constructor(wsUrl) {
    this.id = 0;
    this.pending = new Map();
    this.ws = new WebSocketClient(wsUrl);
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (!payload.id) return;
      const pending = this.pending.get(payload.id);
      if (!pending) return;
      this.pending.delete(payload.id);
      if (payload.error) pending.reject(new Error(payload.error.message));
      else pending.resolve(payload.result);
    };
  }

  async send(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    const promise = new Promise((resolve, reject) => this.pending.set(id, { reject, resolve }));
    this.ws.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  close() {
    this.ws.close();
  }
}

const evaluate = (cdp, expression) =>
  cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true,
  }).then((result) => result.result?.value);

const waitForExpression = async (cdp, expression, timeoutMs = 30000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(cdp, expression)) return;
    await sleep(350);
  }
  throw new Error(`Timeout aguardando expressão: ${expression}`);
};

const navigate = async (cdp, url) => {
  await cdp.send("Page.navigate", { url });
  await waitForExpression(cdp, "document.readyState === 'complete'");
  await sleep(900);
};

const waitForLoginOrDashboard = (cdp) =>
  waitForExpression(
    cdp,
    `
      (() => {
        const text = document.body.innerText || "";
        return Boolean(document.querySelector('input[type=email]')) ||
          text.includes('Central da rodada') ||
          text.includes('Jogos da Copa do Mundo 2026') ||
          text.includes('QA_USER_FLOW Participante 1') ||
          text.includes('Cadastro em análise') ||
          text.includes('Sessão administrativa detectada');
      })()
    `,
    60000,
  );

const waitForDashboardTab = async (cdp, tab) => {
  const expectedText = tabReadinessText[tab];
  await waitForExpression(
    cdp,
    `
      (() => {
        const text = (document.body.innerText || "")
          .normalize("NFD")
          .replace(/[\\u0300-\\u036f]/g, "");
        return text.includes(${JSON.stringify(expectedText)}) &&
          text.includes('QA_USER_FLOW Participante 1');
      })()
    `,
    60000,
  );
  await sleep(1000);
};

const capture = async (cdp, name) => {
  const filePath = path.join(ARTIFACT_DIR, `${name}.png`);
  const result = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: true,
    format: "png",
    fromSurface: true,
  });
  fs.writeFileSync(filePath, Buffer.from(result.data, "base64"));
  return filePath;
};

const run = async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.rmSync(PROFILE_DIR, { force: true, recursive: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const edge = spawn(EDGE_PATH, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    "--window-size=1440,900",
    "about:blank",
  ], {
    stdio: "ignore",
    windowsHide: true,
  });

  try {
    await waitForCdp();
    const target = await requestJson(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
    const cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 900,
      mobile: false,
      width: 1440,
    });

    await navigate(cdp, BASE_URL);
    await waitForLoginOrDashboard(cdp);
    const needsLogin = await evaluate(cdp, "Boolean(document.querySelector('input[type=email]'))");
    if (needsLogin) {
      const loginScript = `
        (() => {
          const setValue = (selector, value) => {
            const element = document.querySelector(selector);
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            setter.call(element, value);
            element.dispatchEvent(new Event('input', { bubbles: true }));
          };
          setValue('input[type=email]', ${JSON.stringify(EMAIL)});
          setValue('input[type=password]', ${JSON.stringify(PASSWORD)});
          const submitButton = [...document.querySelectorAll('form button')]
            .find((button) => button.type === 'submit' && button.textContent.trim() === 'Entrar');
          submitButton.click();
          return true;
        })()
      `;
      await evaluate(cdp, loginScript);
      await waitForExpression(
        cdp,
        "document.body.innerText.includes('QA_USER_FLOW Participante 1') && document.body.innerText.includes('Central da rodada')",
        60000,
      );
    }

    const files = {};
    for (const [tab] of tabs) {
      await navigate(cdp, `${BASE_URL}?tab=${tab}`);
      await waitForDashboardTab(cdp, tab);
      files[tab] = await capture(cdp, `qa-user-flow-${tab}`);
    }

    const responsive = [
      ["tablet", 768, 1024, "home", false],
      ["mobile-home", 390, 844, "home", true],
      ["mobile-games", 390, 844, "games", true],
      ["mobile-profile", 390, 844, "profile", true],
    ];

    for (const [name, width, height, tab, mobile] of responsive) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        deviceScaleFactor: mobile ? 2 : 1,
        height,
        mobile,
        width,
      });
      await navigate(cdp, `${BASE_URL}?tab=${tab}`);
      await waitForDashboardTab(cdp, tab);
      files[name] = await capture(cdp, `qa-user-flow-${name}`);
    }

    cdp.close();
    const summary = { screenshots: files };
    fs.writeFileSync(path.join(ARTIFACT_DIR, "qa-user-flow-visual-evidence.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    edge.kill();
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
