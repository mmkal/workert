import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Miniflare } from "miniflare";

let productionBuildReady = false;

test("worker compiles and runs TypeScript inside a dynamic workerd worker", async () => {
  await using fixture = await createWorkerFixture();

  const response = await fixture.worker.fetch("http://fixture/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code: `
        type Result = { sum: number; label: string };

        async function codemode(): Promise<Result> {
          const values: number[] = [2, 3, 5];
          return {
            sum: values.reduce((total, value) => total + value, 0),
            label: "workerd",
          };
        }
      `,
    }),
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    success: true,
    result: { sum: 10, label: "workerd" },
    compiler: {
      name: "typescript-go (tsgo)",
      runtime: "Go wasm",
      js: expect.stringContaining("async function codemode"),
    },
  });
});

test("worker stub-stub route calls a real Durable Object binding", async () => {
  await using fixture = await createWorkerFixture();

  const response = await fixture.worker.fetch("http://fixture/stub-stub?name=miniflare");

  expect(response.status).toBe(200);
  const html = await response.text();
  expect(html).toContain("Durable Object name: <code>miniflare</code>");
  expect(html).toContain("Vanilla Cloudflare Stub");
  expect(html).toContain("stubStub Wrapped");
  expect(html).toContain("Invalid language: de");
});

async function createWorkerFixture() {
  const sourceDir = path.dirname(import.meta.filename);
  const repoRoot = path.dirname(sourceDir);
  ensureProductionBuild(repoRoot);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "workert-miniflare-fixture-"));
  const buildDir = path.join(repoRoot, "dist", "workert_compiler_mmkal");

  let miniflare: Miniflare | undefined;
  try {
    miniflare = new Miniflare({
      rootPath: buildDir,
      modulesRoot: buildDir,
      scriptPath: "index.js",
      modules: true,
      modulesRules: [
        { type: "ESModule", include: ["**/*.js"] },
        { type: "CompiledWasm", include: ["**/*.wasm"] },
      ],
      compatibilityDate: "2025-06-01",
      compatibilityFlags: ["nodejs_compat"],
      workerLoaders: { LOADER: {} },
      durableObjects: {
        GREETER: { className: "Greeter" },
      },
      durableObjectsPersist: path.join(tempDir, "durable-objects"),
    });

    await miniflare.ready;
    const worker = (await miniflare.getWorker()) as WorkerFetcherLike;

    return {
      worker,
      async [Symbol.asyncDispose]() {
        await miniflare.dispose();
        await fs.rm(tempDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await miniflare?.dispose();
    await fs.rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

function ensureProductionBuild(repoRoot: string) {
  if (productionBuildReady) {
    return;
  }

  execFileSync("pnpm", ["run", "build"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  productionBuildReady = true;
}

interface WorkerFetcherLike {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}
