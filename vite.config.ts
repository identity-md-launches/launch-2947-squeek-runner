import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Optional external dependency location for restricted build workers.
const modules = process.env.SQUEEK_MODULES;
const packages = [
  "react",
  "react-dom",
  "phaser",
  "wagmi",
  "viem",
  "zod",
  "@tanstack/react-query",
];
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: modules
    ? {
        alias: packages.map((name) => ({
          find: new RegExp(
            `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=/|$)`,
          ),
          replacement: resolve(modules, name),
        })),
      }
    : undefined,
  build: { target: "es2022", chunkSizeWarningLimit: 1600 },
  server: { proxy: { "/api": "http://localhost:3001" } },
});
