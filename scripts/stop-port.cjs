#!/usr/bin/env node

const { execFileSync } = require("node:child_process");

const ports = process.argv.slice(2);

if (!ports.length) {
  console.log("Informe ao menos uma porta. Ex: node scripts/stop-port.cjs 3000");
  process.exit(0);
}

const listWindowsPids = (port) => {
  const output = execFileSync("netstat", ["-ano", "-p", "tcp"], { encoding: "utf8" });
  const pids = new Set();

  for (const line of output.split(/\r?\n/)) {
    if (!line.includes(`:${port}`) || !line.includes("LISTENING")) continue;
    const pid = line.trim().split(/\s+/).at(-1);
    if (pid && pid !== "0") pids.add(pid);
  }

  return [...pids];
};

const listUnixPids = (port) => {
  try {
    const output = execFileSync("lsof", ["-ti", `tcp:${port}`], { encoding: "utf8" });
    return output.split(/\r?\n/).map((pid) => pid.trim()).filter(Boolean);
  } catch {
    return [];
  }
};

for (const port of ports) {
  const pids = process.platform === "win32" ? listWindowsPids(port) : listUnixPids(port);

  if (!pids.length) {
    console.log(`Porta ${port}: nenhum processo encontrado.`);
    continue;
  }

  for (const pid of pids) {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", pid, "/F"], { stdio: "ignore" });
    } else {
      execFileSync("kill", ["-TERM", pid], { stdio: "ignore" });
    }
    console.log(`Porta ${port}: processo ${pid} encerrado.`);
  }
}
