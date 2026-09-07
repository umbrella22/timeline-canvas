import { defineConfig } from "vite-plus";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export default defineConfig({
  pack: {
    entry: ["src/server.ts"],
    outDir: "dist",
    format: ["esm"],
    target: "node20",
    clean: true,
    minify: true,
    keepNames: true,
    dts: false,
    copy: [{ from: "src/templates/*.template", to: "templates" }],
  },
  test: {
    name: "mcp",
    root: dirname(fileURLToPath(import.meta.url)),
    environment: "node",
    include: ["tests/**/*.spec.ts"],
  },
});
