#!/usr/bin/env node

const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

const entry = process.argv[2] === "dashboard" ? "dashboard" : "admin";
const defaultPort = entry === "dashboard" ? "3002" : "3000";
const port = process.argv[3] ?? defaultPort;
const appDir = path.resolve(__dirname, "..");
const route = entry === "dashboard" ? "/dashboard" : "/admin";

const isPortBusy = (targetPort) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) => {
      resolve(error.code === "EADDRINUSE");
    });
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(Number(targetPort), "::");
  });

const start = async () => {
  const url = `http://localhost:${port}${route}`;
  if (await isPortBusy(port)) {
    console.log(`Gol de Ouro ${entry} ja parece estar rodando em ${url}`);
    console.log(`Para reiniciar, rode: npm run stop:${entry}`);
    return;
  }

  console.log(`Gol de Ouro ${entry} em ${url}`);

  const child = spawn(
    process.execPath,
    ["scripts/next.cjs", "dev", "--port", port],
    {
      cwd: appDir,
      env: {
        ...process.env,
        GOL_DE_OURO_ENTRY: entry,
        NEXT_PUBLIC_GOL_DE_OURO_ENTRY: entry
      },
      stdio: "inherit"
    },
  );

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
};

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
