# MCP 服务（面向 Copilot Chat / AI CLI）

本仓库提供一个最小可用的 MCP server（stdio），让 Copilot Chat 以“工具调用”的方式与仓库交互，例如：

- 生成内置插件骨架并自动挂到导出
- 进行基础校验（导出/文件是否齐全）
- 触发 allowlist 内的仓库脚本（如 typecheck、docs 构建）

## 前置条件

- Node.js（建议使用仓库约定版本）
- pnpm
- VS Code + GitHub Copilot Chat

## 启动方式

这是一个 **stdio MCP server**，一般由 VS Code / Copilot Chat 托管启动。

### 方案 A：本地开发（推荐）

适用于你就在本仓库里使用/调试 MCP（不依赖 npm 发布）。

1. 在仓库根目录安装依赖：

```bash
pnpm install
```

1. 通过工作区脚本启动：

```bash
pnpm mcp
```

等价命令：

```bash
pnpm -C packages/mcp-service start
```

### 方案 B：npx（适用于已发布版本）

本 MCP server 已发布到 npm（`timeline-canvas-mcp@1.0.0`），可以直接用 `npx` 启动（建议加 `-y` 避免交互确认）。

## VS Code / Copilot Chat 配置（stdio）

仓库提供了可直接参考的配置文件：`.vscode/mcp.json`。

核心要点：

- 使用 stdio 启动 server（不是 HTTP）
- 确保 server 能定位仓库根目录（`cwd` 或 `MCP_WORKSPACE_ROOT`）

下面是通用结构示例（不同 VS Code 版本的配置入口/键名可能略有差异）：

### 使用 pnpm（本地推荐）

```json
{
  "mcpServers": {
    "timeline-canvas": {
      "command": "pnpm",
      "args": ["-C", "packages/mcp-service", "start"],
      "env": {
        "MCP_WORKSPACE_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

### 使用 npx（已发布版本）

```json
{
  "mcpServers": {
    "timeline-canvas": {
      "command": "npx",
      "args": ["-y", "timeline-canvas-mcp@1.0.0"],
      "env": {
        "MCP_WORKSPACE_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

## 面向主流 AI CLI 的通用配置（stdio，最小路线）

只要你的 AI CLI **支持 MCP 并能以 stdio 方式启动 server**（即：通过一个进程的 stdin/stdout 与 server 通讯），通常都可以复用同一套启动参数：

- `command`: `npx`（或 `pnpm`）
- `args`: `-y timeline-canvas-mcp@1.0.0`（或 `-C packages/mcp-service start`）
- `env.MCP_WORKSPACE_ROOT`: 指向仓库根目录（非常关键）

> 提示：如果你后续升级了 npm 包版本，请同步更新这里的 `timeline-canvas-mcp@x.y.z` 以及仓库内的示例配置（例如 `.vscode/mcp.json`）。

### 结构 A：配置键名是 `mcpServers`

不少客户端使用类似下面的结构（你只需要把 `${workspaceFolder}` 替换成它们支持的工作区变量，或直接填绝对路径）：

```json
{
  "mcpServers": {
    "timeline-canvas": {
      "command": "npx",
      "args": ["-y", "timeline-canvas-mcp@1.0.0"],
      "env": {
        "MCP_WORKSPACE_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

### 结构 B：配置键名是 `servers`（与本仓库示例一致）

一些客户端会用 `servers` + `type: "stdio"` 的结构：

```jsonc
{
  "servers": {
    "timeline-canvas": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "timeline-canvas-mcp@1.0.0"],
      "cwd": "${workspaceFolder}",
      "env": {
        "MCP_WORKSPACE_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

### 本地仓库（不依赖 npm 发布）的通用启动方式

当你的 AI CLI 允许直接运行本机命令时，可以用 pnpm 启动（更适合在仓库内开发/调试）：

```json
{
  "command": "pnpm",
  "args": ["-C", "packages/mcp-service", "start"],
  "env": {
    "MCP_WORKSPACE_ROOT": "${workspaceFolder}"
  }
}
```

## 验证是否生效

配置完成后，在 Copilot Chat 里做一次最小验证：

- 调用 `timeline_repo_map`：应返回仓库关键文件地图
- 调用 `timeline_list_builtin_plugins`：应列出 `packages/timeline/src/plugins/builtin` 下的插件

## 推荐工作流（最短路径）

下面给出几条在 Copilot Chat 里最常用、最省 token 的工作流。原则是：**先定位（map/search），再精读（excerpt），最后再执行（脚本/生成）。**

### 1) 快速定位一个功能/符号在哪里实现

1. 先跑仓库地图，快速知道应该看哪些目录：

```json
{ "roots": ["packages/timeline/src", "docs"], "maxEntries": 600 }
```

1. 在 `packages/timeline/src` 和 `docs` 里搜索你关心的关键字（例如 `usePlugin`、类名或报错信息）：

```json
{ "query": "usePlugin", "mode": "literal", "maxResults": 20, "contextLines": 2 }
```

1. 对某个命中文件用 excerpt 精读小段（避免一次读太多）：

```json
{
  "file": "packages/timeline/src/core/Timeline.ts",
  "startLine": 1,
  "endLine": 160
}
```

### 2) 不知道从哪里开始看：走入口链路

当你只知道“哪里不对”，但不知道入口文件：

```json
{ "includeDocs": true }
```

拿到输出的关键文件 + 行号后，再用 `timeline_read_excerpt` 精读。

### 3) 生成一个内置插件骨架并做校验

1. 生成插件骨架（示例：渲染类插件）：

```json
{
  "exportName": "MyBuiltinPlugin",
  "pluginType": "render",
  "description": "My first builtin plugin"
}
```

1. 立即校验“接线”是否完整：

```json
{ "exportName": "MyBuiltinPlugin" }
```

1. 如需检查当前已有的内置插件名：

```json
{}
```

### 4) 只在 allowlist 内执行脚本（用于验证/构建）

- 跑类型检查：

```json
{ "script": "typecheck" }
```

- 构建文档：

```json
{ "script": "docs:build" }
```

> 建议优先用 `timeline_run_repo_script`/`timeline_run_mcp_script`，不要让 AI 直接拼接任意命令。

## 常见问题排查

- 工具不出现 / 调用失败：尝试 Reload Window，并确认 MCP server 已启用
- `npx` 卡确认：确保加了 `-y`
- `Path escapes workspace`：检查 `cwd` / `MCP_WORKSPACE_ROOT` 是否指向仓库根目录

## 工具列表

下面列出本仓库 MCP server 当前暴露的全部工具（tools）。它们均通过 **stdio** 提供给 Copilot Chat 使用，返回值统一为文本（text）。

### `timeline_repo_map`

用途：输出仓库关键文件“地图”，帮助快速定位应该去哪个目录/文件看（避免反复全文搜索）。

输入参数：

- `roots?: string[]`（默认：`["packages/timeline/src", "docs"]`）：扫描的根目录（相对仓库根）
- `maxEntries?: number`（默认：`800`，范围 50~2000）：最多输出条目数

输出：一段面向导航的文本列表。

示例：

```json
{ "roots": ["packages/timeline/src"], "maxEntries": 400 }
```

### `timeline_search`

用途：在仓库指定目录范围内按关键字搜索，返回文件路径 + 行列号 + 少量上下文片段。

说明：当运行环境可用 `rg`（ripgrep）时会优先使用 `rg --vimgrep` 加速；否则自动降级为纯 Node.js 扫描。

输入参数：

- `query: string`：搜索内容
- `mode?: "literal" | "regex"`（默认：`"literal"`）：字面量/正则
- `caseSensitive?: boolean`（默认：`false`）：是否大小写敏感
- `roots?: string[]`（默认：`["packages/timeline/src", "docs", "packages/mcp-service/src"]`）：搜索根目录
- `extensions?: string[]`（默认：`["ts","tsx","md","mdx"]`）：文件扩展名白名单
- `maxResults?: number`（默认：`30`，范围 1~200）：最多返回命中条数
- `contextLines?: number`（默认：`2`，范围 0~10）：命中行前后上下文行数

输出：按条目分隔的命中文本（包含 `file:line:col` + snippet）。

示例：

```json
{ "query": "usePlugin", "mode": "literal", "maxResults": 20, "contextLines": 2 }
```

### `timeline_read_excerpt`

用途：按行号读取文件的一小段（有上限），用于精确查看实现细节。

输入参数：

- `file: string`：相对仓库根的文件路径（例如 `packages/timeline/src/core/Timeline.ts`）
- `startLine: number`：起始行（从 1 开始）
- `endLine: number`：结束行（从 1 开始）
- `maxLines?: number`（默认：`200`，范围 1~500）：允许读取的最大行数

输出：带行号的文本片段。

示例：

```json
{
  "file": "packages/timeline/src/core/Timeline.ts",
  "startLine": 1,
  "endLine": 120
}
```

### `timeline_trace_entrypoints`

用途：输出“入口链路导航”（Timeline → managers → handlers → render pipeline → plugin types/docs），并给出行号提示。

输入参数：

- `includeDocs?: boolean`（默认：`true`）：是否包含 docs 入口提示

输出：一段可直接照着点开的导航文本。

示例：

```json
{ "includeDocs": true }
```

### `timeline_scaffold_builtin_plugin`

用途：生成新的内置插件骨架，并自动把导出挂好。

会做什么：

- 在 `packages/timeline/src/plugins/builtin/` 生成插件实现文件
- 在 `packages/timeline/src/builtin-plugin/` 生成 re-export（用于 package export map）
- 在 `packages/timeline/src/index.ts` 自动添加导出

输入参数：

- `exportName: string`：导出名（必须是合法标识符，例如 `FooPlugin`）
- `pluginType: "render" | "event_handler" | "data_source" | "theme" | "tool" | "extension"`
- `metadataName?: string`：可选，metadata 名
- `description?: string`：可选，插件描述
- `version?: string`（默认：`"1.0.0"`）：插件版本文本
- `withReexport?: boolean`（默认：`true`）：是否生成 re-export 文件
- `withIndexExport?: boolean`（默认：`true`）：是否自动在 `packages/timeline/src/index.ts` 添加导出

输出：执行结果文本（包含创建/修改的文件信息或报错）。

示例：

```json
{
  "exportName": "MyBuiltinPlugin",
  "pluginType": "render",
  "description": "My first builtin plugin"
}
```

### `timeline_validate_builtin_plugin`

用途：校验内置插件的“接线”是否完整：文件是否存在、导出符号是否存在、`packages/timeline/src/index.ts` 是否已导出。

输入参数：

- `exportName: string`：导出名（例如 `ContextMenuPlugin`）

输出：校验报告文本。

示例：

```json
{ "exportName": "ContextMenuPlugin" }
```

### `timeline_list_builtin_plugins`

用途：列出 `packages/timeline/src/plugins/builtin` 下的插件名。

输入参数：无。

输出：插件列表文本。

### `timeline_run_repo_script`

用途：在**仓库根目录**执行 allowlist 内的 pnpm 脚本（避免 AI 任意执行命令）。

输入参数：

- `script: "lint" | "build" | "dev" | "docs:dev" | "docs:build" | "typecheck"`

输出：包含执行命令、exitCode 与输出内容的文本（有截断保护）。

示例：

```json
{ "script": "typecheck" }
```

### `timeline_run_mcp_script`

用途：在 `packages/mcp-service` 目录执行 allowlist 内脚本，用于 MCP 自身的启动/自检。

输入参数：

- `script: "start" | "dev" | "typecheck"`

输出：包含执行命令、exitCode 与输出内容的文本（有截断保护）。

示例：

```json
{ "script": "typecheck" }
```
