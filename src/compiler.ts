import {
  compilerInfo,
  createCompiler,
  type CompileResult as TswCompileResult,
  type CompilerInfo,
  type Diagnostic,
} from "tswasm";
import tswasmWasm from "tswasm/tswasm.wasm";

export { compilerInfo, type CompilerInfo, type Diagnostic };

export interface CompileResult {
  /** The compiled JavaScript code, or empty string if compilation failed */
  js: string;
  /** Array of diagnostic errors/warnings */
  diagnostics: Diagnostic[];
  /** Whether the compilation succeeded (no errors, only warnings allowed) */
  success: boolean;
}

let compilerPromise: Promise<Awaited<ReturnType<typeof createCompiler>>> | undefined;

/**
 * Compiles a string of TypeScript code and returns the compiled JavaScript
 * along with any diagnostic errors.
 *
 * @param code - The TypeScript source code to compile
 * @returns The compilation result including JS output and diagnostics
 */
export async function compileCode(code: string): Promise<CompileResult> {
  const compiler = await getCompiler();
  const result = compiler.compile({ code, fileName: "/input.ts" });
  return toCompileResult(result);
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

function getCompiler() {
  if (!compilerPromise) {
    compilerPromise = createCompiler({ wasm: tswasmWasm });
  }
  return compilerPromise;
}

function toCompileResult(result: TswCompileResult): CompileResult {
  return {
    js: result.js,
    diagnostics: result.diagnostics,
    success: result.success,
  };
}
