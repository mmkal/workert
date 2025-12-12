// Must be first - sets up globals before TypeScript compiler loads
import "./shims";

import { compileCode, formatDiagnostics, type Diagnostic } from "./compiler";
import type { worker } from "../alchemy.run";

interface SuccessResponse {
  success: true;
  result: unknown;
}

interface ErrorResponse {
  success: false;
  error: string;
  diagnostics?: Diagnostic[];
}

type ApiResponse = SuccessResponse | ErrorResponse;

export default {
  async fetch(
    request: Request,
    env: typeof worker.Env
  ): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return jsonResponse<ErrorResponse>(
        {
          success: false,
          error:
            "POST TypeScript code to compile and run. The code must export a function called 'codemode' with no arguments.",
        },
        405
      );
    }

    const tsCode = await request.text();

    if (!tsCode.trim()) {
      return jsonResponse<ErrorResponse>(
        {
          success: false,
          error: "Request body is empty. Please provide TypeScript code.",
        },
        400
      );
    }

    // Compile the TypeScript code
    const compileResult = compileCode(tsCode);

    if (!compileResult.success) {
      return jsonResponse<ErrorResponse>(
        {
          success: false,
          error: `TypeScript compilation failed:\n${formatDiagnostics(compileResult.diagnostics)}`,
          diagnostics: compileResult.diagnostics,
        },
        400
      );
    }

    // Wrap the compiled JS in a Worker that calls codemode() and returns the result
    const wrappedJs = `
${compileResult.js}

export default {
  async fetch(request) {
    try {
      if (typeof codemode !== 'function') {
        return Response.json({
          success: false,
          error: "No 'codemode' function found. Your code must define: async function codemode() { ... }"
        }, { status: 400 });
      }
      
      const result = await codemode();
      
      return Response.json({
        success: true,
        result: result
      });
    } catch (error) {
      return Response.json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }
  }
};
`;

    // Create a unique ID for this execution
    const workerId = crypto.randomUUID();

    try {
      // Load the compiled code into a sandboxed dynamic worker
      const dynamicWorker = env.LOADER.get(workerId, async () => ({
        compatibilityDate: "2025-06-01",
        mainModule: "code.js",
        modules: {
          "code.js": wrappedJs,
        },
        // No network access for the sandboxed worker
        globalOutbound: null,
        env: {},
      }));

      // Execute the worker
      const entrypoint = dynamicWorker.getEntrypoint();
      const response = await entrypoint.fetch(new Request("http://internal/"));

      // Return the response from the dynamic worker
      const result = await response.json();
      return jsonResponse(result as ApiResponse, response.status);
    } catch (error) {
      return jsonResponse<ErrorResponse>(
        {
          success: false,
          error: `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
        },
        500
      );
    }
  },
};

function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
