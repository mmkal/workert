import { createProjectSync, ts } from "@ts-morph/bootstrap";

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

/**
 * Compiles a string of TypeScript code and returns the compiled JavaScript
 * along with any diagnostic errors.
 *
 * @param code - The TypeScript source code to compile
 * @returns The compilation result including JS output and diagnostics
 */
export function compileCode(code: string): CompileResult {
  const project = createProjectSync({
    useInMemoryFileSystem: true,
    skipLoadingLibFiles: false,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      lib: ["lib.es2020.d.ts"],
      strict: true,
      noEmit: false,
      declaration: false,
      sourceMap: false,
    },
  });

  // Create a source file from the input code
  const sourceFile = project.createSourceFile("/input.ts", code);

  // Create a program to get diagnostics
  const program = project.createProgram();

  // Get all pre-emit diagnostics (syntactic + semantic)
  const allDiagnostics = ts.getPreEmitDiagnostics(program, sourceFile);

  // Convert diagnostics to our format
  const diagnostics: Diagnostic[] = allDiagnostics.map((d) => {
    let line: number | undefined;
    let column: number | undefined;

    if (d.file && d.start !== undefined) {
      const pos = d.file.getLineAndCharacterOfPosition(d.start);
      line = pos.line + 1; // Convert to 1-indexed
      column = pos.character;
    }

    return {
      message: flattenDiagnosticMessage(d.messageText),
      code: d.code,
      category: getCategoryString(d.category),
      line,
      column,
    };
  });

  // Check if there are any errors (not just warnings)
  const hasErrors = diagnostics.some((d) => d.category === "error");

  // Emit the compiled code
  let js = "";
  if (!hasErrors) {
    const emitResult = program.emit(
      sourceFile,
      (fileName, text) => {
        if (fileName.endsWith(".js")) {
          js = text;
        }
      },
      undefined,
      false
    );

    // Add any emit diagnostics
    for (const d of emitResult.diagnostics) {
      diagnostics.push({
        message: flattenDiagnosticMessage(d.messageText),
        code: d.code,
        category: getCategoryString(d.category),
      });
    }
  }

  return {
    js,
    diagnostics,
    success: !hasErrors,
  };
}

function flattenDiagnosticMessage(
  messageText: string | ts.DiagnosticMessageChain
): string {
  if (typeof messageText === "string") {
    return messageText;
  }
  // For DiagnosticMessageChain, concatenate all messages
  let result = messageText.messageText;
  if (messageText.next) {
    for (const next of messageText.next) {
      result += "\n  " + flattenDiagnosticMessage(next);
    }
  }
  return result;
}

function getCategoryString(
  category: ts.DiagnosticCategory
): Diagnostic["category"] {
  switch (category) {
    case ts.DiagnosticCategory.Error:
      return "error";
    case ts.DiagnosticCategory.Warning:
      return "warning";
    case ts.DiagnosticCategory.Suggestion:
      return "suggestion";
    case ts.DiagnosticCategory.Message:
      return "message";
    default:
      return "error";
  }
}

/**
 * Formats diagnostics into a human-readable string, similar to TypeScript CLI output.
 */
export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  return diagnostics
    .map((d) => {
      const location = d.line !== undefined ? `:${d.line}:${d.column}` : "";
      const prefix =
        d.category === "error"
          ? "error"
          : d.category === "warning"
            ? "warning"
            : d.category;
      return `${prefix} TS${d.code}${location}: ${d.message}`;
    })
    .join("\n");
}
