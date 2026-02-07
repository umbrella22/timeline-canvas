本页介绍本仓库的开发/构建命令（与 NPM 包 `timeline-canvas` 的安装是两回事）。

## 开发环境要求

* Node.js >= 20.17.0
* npm >= 9.0.0 或 pnpm >= 10.0.0

## 安装依赖

```bash
# 使用 npm
npm install

# 使用 pnpm
pnpm install
```

## 开发模式

```bash
# 启动开发服务器
npm run dev

# 使用 pnpm
pnpm dev
```

## 构建项目

### 核心库构建

```bash
# 构建核心库
npm run build

# 构建结果输出到 dist/ 目录
# - timeline-core.js - 核心库（包含插件系统）
# - timeline-core.min.js - 压缩版本
```

### 文档构建

```bash
# 构建文档
npm run docs:build

# 文档输出到 doc_build/ 目录
```

## 构建配置

### tsdown.config.ts

项目使用 tsdown 进行构建，支持以下配置：

```typescript
export default defineConfig({
  entry: [
    "src/index.ts", // 主入口
    "src/plugins/builtin/*.ts", // 插件入口
  ],
  format: ["esm", "cjs", "umd"],
  dts: true,
  clean: true,
  minify: true,
  external: ["three"], // 外部依赖
});
```

### 独立插件入口

每个插件都有独立的构建入口，支持按需加载：

```typescript
// 插件独立构建配置
export const pluginEntries = {
  ContextMenuPlugin: "src/plugins/builtin/ContextMenuPlugin.ts",
  PerformanceOverlayPlugin: "src/plugins/builtin/PerformanceOverlayPlugin.ts",
  LightThemePlugin: "src/plugins/builtin/LightThemePlugin.ts",
  DarkThemePlugin: "src/plugins/builtin/DarkThemePlugin.ts",
  EventMediaPlugin: "src/plugins/builtin/EventMediaPlugin.ts",
  MutexGuardPlugin: "src/plugins/builtin/MutexGuardPlugin.ts",
};
```

## NPM 包结构

```
timeline-canvas/
├── dist/
│   ├── timeline-core.js
│   ├── timeline-core.min.js
│   ├── timeline-core.d.ts
│   └── plugins/
│       ├── ContextMenuPlugin.js
│       ├── PerformanceOverlayPlugin.js
│       ├── LightThemePlugin.js
│       ├── DarkThemePlugin.js
│       ├── EventMediaPlugin.js
│       ├── MutexGuardPlugin.js
│       └── *.d.ts
├── package.json
└── README.md
```
