import { defineConfig, type UserConfig } from "tsdown";
import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const commonOptions: UserConfig = {
  format: ["esm"],
  outDir: "dist",
  clean: true,
  target: "node20",
};

export default defineConfig(({ watch }) => {
  const isWatch = !!watch;
  return [
    {
      ...commonOptions,
      entry: [
        "src/index.ts",
        "src/builtin-plugin/DarkThemePlugin.ts",
        "src/builtin-plugin/LightThemePlugin.ts",
        "src/builtin-plugin/ContextMenuPlugin.ts",
        "src/builtin-plugin/PerformanceOverlayPlugin.ts",
        "src/builtin-plugin/EventMediaPlugin.ts",
        "src/builtin-plugin/MutexGuardPlugin.ts",
      ],
      outDir: "dist",
      sourcemap: isWatch,
      treeshake: !isWatch,
      minify: !isWatch,
      minifyWhitespace: !isWatch,
      keepNames: !isWatch,
      dts: true,
      plugins: [
        {
          name: "copy-to-docs",
          writeBundle() {
            const src = resolve(__dirname, "dist");
            const dest = resolve(__dirname, "docs/public/dist");
            if (existsSync(src)) {
              cpSync(src, dest, { recursive: true, force: true });
              console.log(`[copy-to-docs] Copied dist to ${dest}`);
            }
          },
        },
      ],
    },
  ];
});
