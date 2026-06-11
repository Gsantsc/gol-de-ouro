const Module = require("module");

const transientCleanupCodes = new Set(["EBUSY", "ENOTEMPTY", "EPERM"]);
const originalLoad = Module._load;

function isShallowCloneCleanupError(error, targetPath) {
  return (
    error &&
    transientCleanupCodes.has(error.code) &&
    typeof targetPath === "string" &&
    targetPath.includes("-shallow-clone")
  );
}

function patchFsExtra(fsExtra) {
  if (!fsExtra || fsExtra.__golDeOuroEasCleanupPatch) {
    return fsExtra;
  }

  const originalRemove = fsExtra.remove;
  if (typeof originalRemove === "function") {
    fsExtra.remove = async function removeWithWindowsCleanupFallback(targetPath, ...args) {
      try {
        return await originalRemove.call(this, targetPath, ...args);
      } catch (error) {
        if (isShallowCloneCleanupError(error, targetPath)) {
          return undefined;
        }
        throw error;
      }
    };
  }

  Object.defineProperty(fsExtra, "__golDeOuroEasCleanupPatch", {
    value: true,
    enumerable: false,
  });

  return fsExtra;
}

Module._load = function patchedLoad(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments);

  if (request === "fs-extra") {
    return patchFsExtra(loaded);
  }

  return loaded;
};
