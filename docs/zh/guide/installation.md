---
title: 安装与构建
---

本页介绍本仓库的开发流程。在应用中使用发布后的库，请安装 `timeline-canvas`。

## 开发环境要求

- Node.js `^22.22.2 || ^24.15.0 || >=26.0.0`；CI 使用 24.20.0。测试环境 jsdom 30 要求这些最低版本。
- pnpm 10.34.5，与 `package.json` 中声明的版本一致。

## 安装与开发

```bash
pnpm install
pnpm dev       # 监听并重新构建时间轴库
pnpm docs:dev  # 启动文档和演练场服务器
```

安装过程会构建时间轴库、维护者 MCP 和使用者 MCP。需要同时开发库与演练场时，在不同终端运行两个开发命令。

## 构建与检查

```bash
pnpm build          # 构建时间轴库和两个 MCP 服务
pnpm docs:build     # 将文档构建到 doc_build/
pnpm lint
pnpm typecheck
pnpm test:run       # 运行库、演练场和 MCP 回归测试
pnpm test:watch
pnpm test:coverage
pnpm -C packages/mcp-service test:package
pnpm -C packages/user-mcp-service test:package
```

覆盖率插件 `@vitest/coverage-v8` 必须与 Vite+ 内置的 Vitest 版本一致，目前均为 4.1.11。MCP 语义分析依赖 TypeScript 5/6 的 Compiler API，开发依赖保留在 6.0.3；TypeScript 7 的原生编译器与旧 API 不兼容。

## Vite+ 配置

每个包使用 `vite.config.ts`，从 `vite-plus` 导入 `defineConfig`。`pack` 配置库构建，`test` 配置测试；根配置汇总工作区中的测试项目。

```typescript
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    outDir: "dist",
    format: ["esm"],
    target: "node20",
    dts: true,
    clean: true,
    minify: true,
  },
  test: {
    include: ["tests/**/*.spec.ts"],
  },
});
```

构建、测试和检查分别使用 `vp pack`、`vp test`、`vp lint`，测试 API 从 `vite-plus/test` 导入。Vite+ 已提供构建、测试、检查和格式化工具，因此不再独立依赖 tsdown、Vitest、Oxlint。直接声明的 `vite` 是对应版本 Vite+ 核心包的别名。V8 覆盖率插件仍需单独安装，并与内置 Vitest 保持版本一致。

## 包输出

时间轴包在 `packages/timeline/dist/` 中输出 ESM 和类型声明：

```text
dist/
  index.mjs
  index.d.mts
  builtin-plugin/
    LightThemePlugin.mjs
    LightThemePlugin.d.mts
    ...
```

插件入口从 `src/builtin-plugin/*.ts` 自动发现，通过 `timeline-canvas/builtin-plugin/LightThemePlugin` 等路径导入。公共代码块也位于 `dist/`。库构建会将产物复制到 `docs/public/dist/`，供文档示例使用。

两个 MCP 包分别输出自己的 `dist/server.mjs`。维护者 MCP 携带运行时需要的 `templates/` 目录；使用者 MCP 将指南和模板内置在程序中。各包的 `test:package` 命令在源码目录之外解包 npm tarball，验证对应工具。
