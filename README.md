# workert

TypeScript compiler running in a Cloudflare Worker. Proof of concept.

Compiles TS to JS on the edge, executes in a sandboxed dynamic worker, returns result.

**Demo:** https://workert-compiler-mmkal.iterate.workers.dev

## Usage

```bash
curl -X POST https://workert-compiler-mmkal.iterate.workers.dev \
  -d '{"code": "async function codemode() { return 1 + 1 }"}'
# {"success":true,"result":2}
```

Or visit the URL in browser for a simple UI.

## Deploy your own

```bash
bun install
bun run deploy
```

Requires [Alchemy](https://github.com/sam-goodwin/alchemy) and Cloudflare credentials.

## Development

```bash
bun install
bun test        # run tests
bun dev     # start local dev server
```

## How it works

- Builds a trimmed `typescript-go` wasm compiler from `vendor/typescript-go`
- Compiles a single in-memory `/input.ts` string with a tiny built-in `lib.d.ts`
- Compiled code runs in isolated worker with no network access

## License

Apache 2.0
