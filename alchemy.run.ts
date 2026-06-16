import alchemy from "alchemy";
import { Vite, WorkerLoader, DurableObjectNamespace } from "alchemy/cloudflare";
import type { Greeter } from "./src/greeter";

const app = await alchemy("workert");

export const worker = await Vite("compiler", {
  entrypoint: "./src/worker.ts",
  url: true,
  bindings: {
    LOADER: WorkerLoader(),
    GREETER: DurableObjectNamespace<Greeter>("greeter", {className: "Greeter"}),
  },
  compatibilityDate: "2025-06-01",
  compatibilityFlags: ["nodejs_compat"],
});

console.log(`Worker deployed at: ${worker.url}`);

await app.finalize();
