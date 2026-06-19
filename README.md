# workert

Native TypeScript compilation running inside a Cloudflare Worker.

This is a proof of concept for putting the new native TypeScript compiler,
`typescript-go` (`tsgo`), directly inside the Worker runtime. A request sends an
inline TypeScript string, the Worker type-checks and emits JavaScript with tsgo
wasm, then runs the emitted module in a sandboxed dynamic Worker and returns both
the runtime result and compiler output.

The trick is deliberately narrowing the compiler surface: no project graph, no
disk-backed filesystem, no npm package resolution. Just one in-memory
`/input.ts`, modern ECMAScript lib declarations, and a native compiler compiled
to Go wasm.

**Demo:** https://workert-compiler-mmkal.iterate-dev-preview.workers.dev

## Usage

```bash
curl -X POST https://workert-compiler-mmkal.iterate-dev-preview.workers.dev \
  -H 'content-type: application/json' \
  -d '{"code": "async function codemode(): Promise<number> { return 1 + 1 }"}'
```

The response includes the result plus compiler metadata and emitted JavaScript:

```json
{
  "success": true,
  "result": 2,
  "compiler": {
    "name": "typescript-go (tsgo)",
    "runtime": "Go wasm",
    "mode": "single in-memory /input.ts",
    "lib": "bundled TypeScript lib.es2024.d.ts",
    "js": "\"use strict\";\nasync function codemode() { return 1 + 1; }\n"
  }
}
```

Or visit the URL in a browser for a simple UI.

## Why this is interesting

Most "compile TypeScript in JS" demos use the JavaScript TypeScript compiler.
This one runs the native `typescript-go` compiler inside a Cloudflare Worker
isolate. The compiler itself is the wasm payload.

That proves a useful shape: edge runtimes can host native TypeScript tooling when
the workload is constrained enough to avoid a full filesystem and package graph.

## Deploy your own

```bash
bun install
bun run deploy
```

Requires Bun, Wrangler/Cloudflare credentials, and access to a Cloudflare
Workers plan that accepts the current compressed upload size. This POC fits the
paid Worker script-size limit, but not the free 3 MiB compressed limit.

## Development

```bash
bun install
bun test        # run tests
bun dev         # start local dev server
```

## How it works

- Uses the published `tswasm` package, which packages `typescript-go` as wasm
- Lazily initializes the tsgo wasm compiler inside the Cloudflare Worker isolate
- Compiles one in-memory `/input.ts` string with strict ES2024/ESNext options
- Uses the real TypeScript `lib.es2024.d.ts` dependency chain bundled by
  `tswasm`, so basics like
  `Promise`, `Iterable`, `Map`, `Set`, `Array.from`, `Array.prototype.at`, and
  `toSorted` type-check without a fake minimal lib
- Returns emitted JavaScript in `compiler.js`
- Executes the emitted JavaScript in a sandboxed dynamic worker with no network
  access

The compiler path does not use Durable Objects. This repo also includes a
separate `/stub-stub` Durable Object demo inherited from the base branch.

## What this proves

- A native TypeScript compiler can run in Cloudflare Workers via Go wasm.
- A useful restricted subset can avoid filesystem/package resolution by treating
  user code as a single in-memory file.
- Real ECMAScript lib declarations are small enough to bundle, so the subset is
  not limited to a hand-written fake `lib.d.ts`.
- The emitted JavaScript can be returned to the caller and executed immediately
  in a network-isolated dynamic worker.
- The main tradeoff is bundle size and memory headroom: the wasm build is large
  enough to require paid Worker limits, and pathological type programs can still
  hit the 128 MiB isolate memory ceiling.

## License

Apache 2.0
