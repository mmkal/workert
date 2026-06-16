import "./tsgo-wasm/wasm_exec.js";
import tsgoWasm from "./tsgo-wasm/tsgo.wasm";

export interface CompileResult {
  /** The compiled JavaScript code, or empty string if compilation failed */
  js: string;
  /** Array of diagnostic errors/warnings */
  diagnostics: Diagnostic[];
  /** Whether the compilation succeeded (no errors, only warnings allowed) */
  success: boolean;
}

export interface Diagnostic {
  /** The error/warning message */
  message: string;
  /** The TypeScript error code (e.g., 2322) */
  code: number;
  /** The category: error, warning, suggestion, or message */
  category: "error" | "warning" | "suggestion" | "message";
  /** Line number (1-indexed) where the error occurred, if applicable */
  line?: number;
  /** Column number (0-indexed) where the error occurred, if applicable */
  column?: number;
}

export interface CompilerInfo {
  name: string;
  runtime: string;
  mode: string;
  lib: string;
}

export const compilerInfo: CompilerInfo = {
  name: "typescript-go (tsgo)",
  runtime: "Go wasm",
  mode: "single in-memory /input.ts",
  lib: "bundled TypeScript lib.es2024.d.ts",
};

type NativeCompile = (code: string) => string;

interface GoRuntime {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

interface GoConstructor {
  new (): GoRuntime;
}

declare global {
  // Defined by wasm_exec.js.
  var Go: GoConstructor | undefined;
  // Registered by vendor/typescript-go/cmd/workert-wasm/main.go.
  var __workertTsgoCompile: NativeCompile | undefined;
  var Bun: { file(path: string): { arrayBuffer(): Promise<ArrayBuffer> } } | undefined;
}

let nativeCompilePromise: Promise<NativeCompile> | undefined;

/**
 * Compiles a string of TypeScript code and returns the compiled JavaScript
 * along with any diagnostic errors.
 *
 * @param code - The TypeScript source code to compile
 * @returns The compilation result including JS output and diagnostics
 */
export async function compileCode(code: string): Promise<CompileResult> {
  const nativeCompile = await getNativeCompile();
  return JSON.parse(nativeCompile(code)) as CompileResult;
}

/**
 * Formats diagnostics into a human-readable string, similar to TypeScript CLI output.
 */
export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  return diagnostics
    .map((diagnostic) => {
      const location =
        diagnostic.line !== undefined
          ? `:${diagnostic.line}:${diagnostic.column}`
          : "";
      return `${diagnostic.category} TS${diagnostic.code}${location}: ${diagnostic.message}`;
    })
    .join("\n");
}

async function createNativeCompile(
  wasmInput: WebAssembly.Module | string
): Promise<NativeCompile> {
  if (!globalThis.Go) {
    throw new Error("Go wasm runtime did not initialize");
  }

  const go = new globalThis.Go();
  const instance = await instantiateWasm(wasmInput, go.importObject);
  void go.run(instance).catch((error) => {
    console.error("tsgo wasm runtime exited", error);
  });

  const compile = await waitForNativeCompileRegistration();
  return compile;
}

function getNativeCompile(): Promise<NativeCompile> {
  if (!nativeCompilePromise) {
    nativeCompilePromise = createNativeCompile(tsgoWasm);
  }
  return nativeCompilePromise;
}

async function waitForNativeCompileRegistration(): Promise<NativeCompile> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const compile = globalThis.__workertTsgoCompile;
    if (compile) {
      return compile;
    }
    await Promise.resolve();
  }

  throw new Error("tsgo wasm compiler did not register compile(code)");
}

async function instantiateWasm(
  wasmInput: WebAssembly.Module | string,
  imports: WebAssembly.Imports
): Promise<WebAssembly.Instance> {
  if (wasmInput instanceof WebAssembly.Module) {
    const instance = await WebAssembly.instantiate(wasmInput, imports);
    return instance;
  }

  const wasmBytes = await readWasmBytes(wasmInput);
  const instantiated = await WebAssembly.instantiate(wasmBytes, imports);
  return instantiated.instance;
}

async function readWasmBytes(pathOrUrl: string): Promise<ArrayBuffer> {
  if (globalThis.Bun) {
    return globalThis.Bun.file(pathOrUrl).arrayBuffer();
  }

  const response = await fetch(pathOrUrl);
  if (!response.ok) {
    throw new Error(`failed to load tsgo wasm: ${response.status}`);
  }
  return response.arrayBuffer();
}
