import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Shared package ships CJS for Nest; Vite needs the TS source as ESM.
    alias: {
      "@plansimple/shared": path.resolve(rootDir, "../../packages/shared/src/index.ts"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.WEB_PORT || 5173),
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET || "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
