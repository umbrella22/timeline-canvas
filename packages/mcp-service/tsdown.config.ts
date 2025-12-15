import { defineConfig, type UserConfig } from "tsdown";

const commonOptions: UserConfig = {
  entry: ["src/server.ts"],
  outDir: "dist",
  format: ["esm"],
  target: "node20",
  clean: true,
};

export default defineConfig(({ watch }) => {
  const isWatch = !!watch;
  return [
    {
      ...commonOptions,
      sourcemap: isWatch,
      treeshake: !isWatch,
      minify: !isWatch,
      minifyWhitespace: !isWatch,
      keepNames: !isWatch,
      dts: false,
    },
  ];
});
