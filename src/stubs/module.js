// Stub for module - createRequire is used by some bundled code but not needed at runtime
export function createRequire() {
  return function require() {
    throw new Error("require() not available in this environment");
  };
}

export default { createRequire };
