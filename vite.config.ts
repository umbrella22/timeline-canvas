import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    projects: [
      "packages/timeline/vite.config.ts",
      "packages/mcp-service/vite.config.ts",
      "packages/user-mcp-service/vite.config.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "packages/timeline/coverage",
      include: ["packages/timeline/src/**/*.ts"],
      exclude: ["**/*.d.ts", "**/index.ts", "**/builtin-plugin/**"],
      thresholds: { statements: 25, branches: 20, functions: 35, lines: 25 },
    },
  },
});
