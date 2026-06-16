# workert vendor notes

Source: https://github.com/microsoft/typescript-go

Vendored commit: `462a1a4f4944a35d19797f9674f97ace28d17fc4`

This tree was copied without `.git`, tests, testdata, generated coverage, node_modules, and development-only helper folders. Upstream `LICENSE` and `NOTICE.txt` are retained.

Local additions:

- `cmd/workert-wasm`: a restricted wasm command that compiles one in-memory `/input.ts` string and returns JSON `{ js, diagnostics, success }` through `globalThis.__workertTsgoCompile`.
- The wasm command uses a tiny built-in `/lib.d.ts` instead of upstream bundled libs, so the supported TypeScript surface is intentionally much smaller than full `tsc`.
