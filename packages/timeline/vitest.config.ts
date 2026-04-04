import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      thresholds: {
        statements: 25,
        branches: 20,
        functions: 35,
        lines: 25,
      },
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/builtin-plugin/**/*.ts",
        "tests/**/*.ts",
      ],
    },
  },
});
