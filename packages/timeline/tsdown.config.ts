import { defineConfig, type UserConfig } from "tsdown";
import { cpSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));

const commonOptions: UserConfig = {
  format: ["esm"],
  outDir: "dist",
  clean: true,
  target: "node20",
};

const BUILTIN_PLUGIN_DIR = "src/builtin-plugin";

const getBuiltinPluginEntries = (): string[] => {
  const pluginDir = resolve(packageDir, BUILTIN_PLUGIN_DIR);
  if (!existsSync(pluginDir)) {
    console.warn(`[tsdown] Builtin plugin directory not found: ${pluginDir}`);
    return [];
  }

  return readdirSync(pluginDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => `${BUILTIN_PLUGIN_DIR}/${entry.name}`)
    .sort();
};

export default defineConfig(({ watch }) => {
  const isWatch = !!watch;
  return [
    {
      ...commonOptions,
      entry: ["src/index.ts", ...getBuiltinPluginEntries()],
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
            const workspaceRoot = resolve(packageDir, "../..");
            const src = resolve(packageDir, "dist");
            const dest = resolve(workspaceRoot, "docs/public/dist");
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
