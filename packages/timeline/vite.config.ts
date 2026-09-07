import { defineConfig } from "vite-plus";
import { cpSync, readdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));
const pluginDirectory = "src/builtin-plugin";
const pluginEntries = readdirSync(resolve(packageDir, pluginDirectory), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
  .map((entry) => `${pluginDirectory}/${entry.name}`)
  .sort();

export default defineConfig({
  pack: {
    entry: ["src/index.ts", ...pluginEntries],
    outDir: "dist",
    format: ["esm"],
    target: "node20",
    clean: true,
    dts: true,
    minify: true,
    keepNames: true,
    plugins: [
      {
        name: "copy-to-docs",
        writeBundle() {
          const docsDist = resolve(packageDir, "../../docs/public/dist");
          rmSync(docsDist, { recursive: true, force: true });
          cpSync(resolve(packageDir, "dist"), docsDist, {
            recursive: true,
            force: true,
          });
        },
      },
    ],
  },
  test: {
    name: "timeline",
    root: packageDir,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/**/index.ts", "src/builtin-plugin/**/*.ts"],
      thresholds: { statements: 25, branches: 20, functions: 35, lines: 25 },
    },
  },
});
