// Shims for Node.js globals that TypeScript compiler references at module load time
// Must be imported before @ts-morph/bootstrap

(globalThis as any).__filename = "/compiler.js";
(globalThis as any).__dirname = "/";
(globalThis as any).process = (globalThis as any).process || {
  cwd: () => "/",
  env: {},
  platform: "linux",
  versions: { node: "20.0.0" },
};

export {};
