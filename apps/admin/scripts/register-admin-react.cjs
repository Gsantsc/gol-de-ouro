const path = require("node:path");
const Module = require("node:module");

const appDir = path.resolve(__dirname, "..");
const adminRequire = Module.createRequire(path.join(appDir, "package.json"));
const originalResolveFilename = Module._resolveFilename;

if (!globalThis.__golDeOuroAdminReactResolver) {
  globalThis.__golDeOuroAdminReactResolver = true;

  Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
    const parentFile = parent?.filename ? parent.filename.replace(/\\/g, "/") : "";
    const isReactRequest = request === "react" || request.startsWith("react/");

    // npm hoists styled-jsx beside the mobile React 19 tree. Next 14 must render it
    // with the admin React 18 instance, otherwise prerendering fails with invalid hooks.
    if (isReactRequest && parentFile.includes("/node_modules/styled-jsx/")) {
      return adminRequire.resolve(request);
    }

    return originalResolveFilename.call(this, request, parent, isMain, options);
  };
}
