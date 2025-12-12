import alchemy from "alchemy";
import { Worker, WorkerLoader } from "alchemy/cloudflare";

const app = await alchemy("misha-ts");

export const worker = await Worker("compiler", {
  entrypoint: "./src/worker.ts",
  url: true,
  bindings: {
    LOADER: WorkerLoader(),
  },
  compatibilityDate: "2025-06-01",
  compatibilityFlags: ["nodejs_compat"],
});

console.log(`Worker deployed at: ${worker.url}`);

await app.finalize();
