// Must be first - sets up globals before TypeScript compiler loads
import "./shims";

import { compileCode, formatDiagnostics, type Diagnostic } from "./compiler";
import { stubStub } from "./stub-stub";
import type { worker } from "../alchemy.run";

// Re-export Greeter for Cloudflare to find the Durable Object class
export { Greeter } from "./greeter";

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
    const url = new URL(request.url);

    // Handle /stub-stub demo route
    if (url.pathname === "/stub-stub") {
      return handleStubStubDemo(url, env);
    }

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

async function handleStubStubDemo(url: URL, env: typeof worker.Env): Promise<Response> {
  const name = url.searchParams.get("name") || "default";
  const rawStub = env.GREETER.getByName(name);
  const wrappedStub = stubStub(rawStub, { demoName: name });

  // Call with invalid language on both stubs and capture errors
  const [vanillaError, wrappedError] = await Promise.all([
    rawStub.getGreeting({ language: "de" as never }).catch((e: Error) => e),
    wrappedStub.getGreeting({ language: "de" as never }).catch((e: Error) => e),
  ]);

  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const vanillaStack = vanillaError.stack || vanillaError.message;
  const wrappedStack = wrappedError.stack || wrappedError.message;

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>stubStub Demo</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1500px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    h2 { color: #666; margin-top: 30px; }
    .error-box { background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 10px 0; }
    .error-message { color: #c00; font-weight: bold; margin-bottom: 10px; }
    .stack { font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; color: #333; line-height: 1.5; }
    .highlight { background: #ffe066; padding: 2px 4px; }
    .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 800px) { .comparison { grid-template-columns: 1fr; } }
    .benefit { background: #e6ffe6; border: 2px solid #090; border-radius: 8px; padding: 16px; margin-top: 30px; }
    code { background: #eee; padding: 2px 6px; border-radius: 4px; }
    .code-snippet { background: #2d2d2d; color: #f8f8f2; padding: 12px; border-radius: 6px; font-size: 13px; overflow-x: auto; margin: 10px 0; }
  </style>
</head>
<body>
  <h1>stubStub Demo</h1>
  <p>Durable Object name: <code>${escapeHtml(name)}</code></p>
  <p>Both calls invoke <code>stub.getGreeting({ language: "de" })</code> which throws an error.</p>
  
  <div class="comparison">
    <div>
      <h2>Vanilla Cloudflare Stub</h2>
      <pre class="code-snippet">const stub = env.GREETER.getByName("${escapeHtml(name)}");
await stub.getGreeting({ language: "de" });</pre>
      <div class="error-box">
        <div class="error-message">${escapeHtml(vanillaError.message)}</div>
        <div class="stack">${escapeHtml(vanillaStack)}</div>
      </div>
    </div>
    
    <div>
      <h2>stubStub Wrapped</h2>
      <pre class="code-snippet">const stub = stubStub(env.GREETER.getByName("${escapeHtml(name)}"), { requestId: "abc123" });
await stub.getGreeting({ language: "de" });</pre>
      <div class="error-box">
        <div class="error-message">${escapeHtml(wrappedError.message)}</div>
        <div class="stack">${escapeHtml(wrappedStack)}</div>
      </div>
    </div>
  </div>
  
  <div class="benefit">
    <h2>The Benefit</h2>
    <p>When using vanilla Cloudflare stubs, errors thrown inside Durable Objects lose the caller's stack trace. 
       You only see where the error was thrown <em>inside</em> the DO, not where the call originated.</p>
    <p><strong>stubStub</strong> captures the caller's stack before the RPC call and appends it to any errors, 
       giving you a complete picture of the call chain across the DO boundary.</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
