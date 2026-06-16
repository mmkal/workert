import { defineConfig } from "vite";
import alchemy from "alchemy/cloudflare/vite";

export default defineConfig({
  plugins: [alchemy()],
});
