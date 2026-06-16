import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const outputDir = path.join(repoRoot, "src", "tsgo-wasm");
const vendorDir = path.join(repoRoot, "vendor", "typescript-go");
const wasmExecPath = path.join(outputDir, "wasm_exec.js");

mkdirSync(outputDir, { recursive: true });

execFileSync("go", ["build", "-ldflags=-s -w", "-o", "../../src/tsgo-wasm/tsgo.wasm", "./cmd/workert-wasm"], {
  cwd: vendorDir,
  env: {
    ...process.env,
    GOARCH: "wasm",
    GOOS: "js",
  },
  stdio: "inherit",
});

const goRoot = execFileSync("go", ["env", "GOROOT"], {
  encoding: "utf8",
}).trim();

copyFileSync(path.join(goRoot, "lib", "wasm", "wasm_exec.js"), wasmExecPath);
patchWorkerSafeEntropy(wasmExecPath);

function patchWorkerSafeEntropy(filePath: string) {
  const original = "crypto.getRandomValues(loadSlice(sp + 8));";
  const replacement = `const target = loadSlice(sp + 8);
\t\t\t\t\t\tlet seed = 0x12345678;
\t\t\t\t\t\tfor (let i = 0; i < target.length; i++) {
\t\t\t\t\t\t\tseed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
\t\t\t\t\t\t\ttarget[i] = seed & 0xff;
\t\t\t\t\t\t}`;

  const runtime = readFileSync(filePath, "utf8");
  if (!runtime.includes(original)) {
    throw new Error("Go wasm_exec.js entropy hook changed; update build-tsgo-wasm.ts");
  }

  writeFileSync(filePath, runtime.replace(original, replacement));
}
