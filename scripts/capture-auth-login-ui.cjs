const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { optionalEnv } = require("./env.cjs");

const WebSocketClient = globalThis.WebSocket ?? require("ws");

const BASE_URL = optionalEnv("AUTH_UI_BASE_URL", "http://localhost:3000/dashboard");
const EDGE_PATH = optionalEnv("QA_BROWSER_PATH", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
const PORT = Number(optionalEnv("AUTH_UI_CDP_PORT", "9344"));
const ARTIFACT_DIR = path.join(process.cwd(), "artifacts");
const PROFILE_DIR = path.join(ARTIFACT_DIR, "edge-auth-ui-profile");

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
  throw new Error("Edge DevTools nao ficou disponivel.");
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
  throw new Error(`Timeout aguardando expressao: ${expression}`);
};

const navigate = async (cdp, url) => {
  await cdp.send("Page.navigate", { url });
  await waitForExpression(cdp, "document.readyState === 'complete'");
  await sleep(900);
};

const setViewport = (cdp, width, height, mobile = false) =>
  cdp.send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: mobile ? 2 : 1,
    height,
    mobile,
    width,
  });

const triggerInvalidLogin = async (cdp) => {
  const email = `auth-ui-${Date.now()}@qa.local`;
  await evaluate(
    cdp,
    `
      (() => {
        const setValue = (selector, value) => {
          const element = document.querySelector(selector);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(element, value);
          element.dispatchEvent(new Event('input', { bubbles: true }));
        };
        setValue('input[type=email]', ${JSON.stringify(email)});
        setValue('input[type=password]', 'SenhaFake#2026');
        const submitButton = [...document.querySelectorAll('form button')]
          .find((button) => button.textContent.trim() === 'Entrar' && button.type === 'submit');
        submitButton.click();
        return true;
      })()
    `,
  );
  await waitForExpression(cdp, "document.body.innerText.includes('Email ou senha incorretos.')", 30000);
};

const readLayout = (cdp) =>
  evaluate(
    cdp,
    `
      (() => {
        const rectFor = (element) => {
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return { bottom: rect.bottom, height: rect.height, left: rect.left, right: rect.right, top: rect.top, width: rect.width };
        };
        const logo = document.querySelector('[aria-label="GOL DE OURO"]');
        const alert = [...document.querySelectorAll('div')]
          .find((element) => element.textContent.trim() === 'Email ou senha incorretos.');
        const logoRect = rectFor(logo);
        const alertRect = rectFor(alert);
        const overlap = Boolean(logoRect && alertRect) && !(
          alertRect.bottom <= logoRect.top ||
          alertRect.top >= logoRect.bottom ||
          alertRect.right <= logoRect.left ||
          alertRect.left >= logoRect.right
        );
        return {
          alert_after_logo: Boolean(logoRect && alertRect && alertRect.top > logoRect.bottom),
          alert_rect: alertRect,
          logo_rect: logoRect,
          overlap,
        };
      })()
    `,
  );

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

    await setViewport(cdp, 1440, 900, false);
    await navigate(cdp, BASE_URL);
    await waitForExpression(cdp, "Boolean(document.querySelector('input[type=email]'))", 30000);
    await triggerInvalidLogin(cdp);

    const screenshots = {};
    const layouts = {};

    screenshots.desktop = await capture(cdp, "auth-login-desktop");
    layouts.desktop = await readLayout(cdp);

    await setViewport(cdp, 768, 1024, false);
    await sleep(500);
    screenshots.tablet = await capture(cdp, "auth-login-tablet");
    layouts.tablet = await readLayout(cdp);

    await setViewport(cdp, 390, 844, true);
    await sleep(500);
    screenshots.mobile = await capture(cdp, "auth-login-mobile");
    layouts.mobile = await readLayout(cdp);

    cdp.close();

    const summary = { layouts, screenshots };
    fs.writeFileSync(path.join(ARTIFACT_DIR, "auth-login-ui-evidence.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));

    const failed = Object.entries(layouts).filter(([, layout]) => layout.overlap || !layout.alert_after_logo);
    if (failed.length) {
      throw new Error(`Alerta sobreposto ou fora de ordem: ${failed.map(([name]) => name).join(", ")}`);
    }
  } finally {
    edge.kill();
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
