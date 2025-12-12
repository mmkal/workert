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

    let code = "";

    if (request.method === "GET") {
      const {searchParams} = new URL(request.url);
      code = searchParams.get("code") || "";
    } else if (request.method === "POST") {
      const text = await request.text();
      if (text.startsWith("{")) {
        code = JSON.parse(text).code;
      } else {
        code = text;
      }
    } else {
      return jsonResponse({success: false, error: "Method not allowed"}, 405);
    }

    code = code.trim();

    if (!code && request.method === 'GET') {
      const initialCode = [
        "interface User {",
        "  name: string;",
        "  age: number;",
        "}",
        "",
        "function greet(user: User): string {",
        "  return `Hello ${user.name}, you are ${user.age} years old.`;",
        "}",
        "",
        "async function codemode() {",
        "  return greet({name: 'John', age: 40});",
        "}",
      ].join('\n')
      const html = `
        <main style="display: flex; flex-direction: column; max-width: 600px; margin: 12px;">
          <h2>write some typescript code below</h2>
          <p>the code will be executed in a dynamic worker. you must define a function called <code>codemode</code>.</p>
          <textarea
            id="tscode"
            rows="20"
            cols="80"
          >${initialCode}</textarea>
          <button
            id="run"
            style="display: block; font-size: xx-large;"
            onclick="document.getElementById('result').src = '/?code=' + encodeURIComponent(document.getElementById('tscode').value);"
          >run</button>
          <iframe id="result" style="width: 100%; height: 500px; border: 1px solid #ccc;"></iframe>
        </main>
      `
      return new Response(html, {
        status: 200,
        headers: {"Content-Type": "text/html", "Access-Control-Allow-Origin": "*"},
      });
    }

    if (!code.trim()) {
      return jsonResponse({success: false, error: "Request body is empty. Please provide TypeScript code."}, 400);
    }

    const compileResult = compileCode(code);

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
