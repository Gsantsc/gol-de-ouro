#!/usr/bin/env node

const path = require("node:path");
const Module = require("node:module");

const preloadPath = path.join(__dirname, "register-admin-react.cjs");
const workspaceNodeModules = path.join(__dirname, "..", "node_modules");

process.env.NEXT_IGNORE_INCORRECT_LOCKFILE ??= "1";
process.env.NODE_PATH = [workspaceNodeModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
Module._initPaths();

const nodeOptions = process.env.NODE_OPTIONS ?? "";
if (!nodeOptions.includes(preloadPath)) {
  process.env.NODE_OPTIONS = `${nodeOptions} --require ${preloadPath}`.trim();
}

require(preloadPath);
require("next/dist/bin/next");
