import { defineConfig } from "vite-plus";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export default defineConfig({
  pack: {
    entry: ["src/server.ts"],
    outDir: "dist",
    format: ["esm"],
    target: "node22",
    clean: true,
    minify: true,
    keepNames: true,
    dts: false,
  },
  test: {
    name: "user-mcp",
    root: dirname(fileURLToPath(import.meta.url)),
    environment: "node",
    include: ["tests/**/*.spec.ts"],
  },
});
