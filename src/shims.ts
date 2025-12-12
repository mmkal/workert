// These shims must be set up before any TypeScript compiler code runs
// They're needed because the bundled TypeScript compiler references Node.js globals

// @ts-ignore - setting up global shims for the TypeScript compiler
globalThis.__filename = "/compiler.js";
// @ts-ignore
globalThis.__dirname = "/";
// @ts-ignore
globalThis.process = globalThis.process || {
  cwd: () => "/",
  env: {},
  platform: "linux",
  versions: { node: "20.0.0" },
};

export {};
