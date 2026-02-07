---
title: MCP 服务（面向 Copilot Chat / AI CLI）
---

> 本仓库提供一个 stdio MCP server，让 Copilot Chat / AI CLI 以“工具调用”的方式与仓库交互。

本页给出启动方式、配置示例与推荐工作流。

- **脚手架**：基于模板生成内置插件骨架，支持特性选择和测试文件生成
- **校验**：深度检查插件完整性（metadata 字段、activate/deactivate 配对、TODO 扫描）
- **语义查询**：符号依赖图、类型定义与成员引用追踪（基于 TypeScript Compiler API）
- **一致性检查**：插件导出、渲染层、状态字段、变更类型、边界条件 5 类规则
- **性能分析**：渲染热路径静态标注（循环内 O(N) 操作、GC 压力、缺失可见性裁剪等）
- **迁移辅助**：API 导出与文档同步检查

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

本 MCP server 已发布到 npm（`timeline-canvas-mcp@2.0.0`），可以直接用 `npx` 启动（建议加 `-y` 避免交互确认）。

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
      "args": ["-y", "timeline-canvas-mcp@2.0.0"],
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
- `args`: `-y timeline-canvas-mcp@2.0.0`（或 `-C packages/mcp-service start`）
- `env.MCP_WORKSPACE_ROOT`: 指向仓库根目录（非常关键）

> 提示：如果你后续升级了 npm 包版本，请同步更新这里的 `timeline-canvas-mcp@x.y.z` 以及仓库内的示例配置（例如 `.vscode/mcp.json`）。

### 结构 A：配置键名是 `mcpServers`

不少客户端使用类似下面的结构（你只需要把 `${workspaceFolder}` 替换成它们支持的工作区变量，或直接填绝对路径）：

```json
{
  "mcpServers": {
    "timeline-canvas": {
      "command": "npx",
      "args": ["-y", "timeline-canvas-mcp@2.0.0"],
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
      "args": ["-y", "timeline-canvas-mcp@2.0.0"],
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

- 调用 `timeline_list_builtin_plugins`：应列出 `packages/timeline/src/plugins/builtin` 下的插件
- 调用 `timeline_validate_plugin`（不传参数）：应返回所有内置插件的校验报告
- 调用 `timeline_consistency_check`：应返回项目一致性检查结果

## 推荐工作流

下面给出几条在 Copilot Chat 里最常用的工作流。

> **说明**：搜索、读取文件、执行脚本等通用操作请直接使用 VS Code 内置工具（`grep_search`、`read_file`、`run_in_terminal` 等），MCP 工具专注于内置工具**做不到**的项目级语义分析。

### 1) 理解一个类/接口的依赖关系（重构前必做）

1. 查看谁依赖 `ChangeScheduler`：

```json
{ "symbol": "ChangeScheduler", "direction": "dependents" }
```

2. 查看 `ChangeScheduler` 依赖了什么：

```json
{ "symbol": "ChangeScheduler", "direction": "dependencies" }
```

3. 双向查看：

```json
{ "symbol": "ChangeScheduler", "direction": "both" }
```

### 2) 查看类型定义和成员使用情况

1. 查看 `TimelineState` 的完整定义和所有字段：

```json
{ "type": "TimelineState" }
```

2. 查看 `scrollX` 字段在哪被读取/修改：

```json
{ "type": "TimelineState", "member": "scrollX" }
```

### 3) 生成一个内置插件骨架并做校验

1. 生成带渲染层和事件处理的插件骨架：

```json
{
  "exportName": "MyPlugin",
  "pluginType": "render",
  "features": ["renderLayer", "lifecycle"],
  "description": "My custom render plugin",
  "withTest": true
}
```

2. 立即校验插件完整性：

```json
{ "name": "MyPlugin" }
```

3. 校验所有内置插件（不传参数）：

```json
{}
```

### 4) 项目健康检查

1. 运行全部一致性检查：

```json
{}
```

2. 只检查特定项目：

```json
{ "checks": ["plugin-exports", "state-fields"] }
```

### 5) 性能优化辅助

1. 分析渲染热路径：

```json
{ "target": "render" }
```

2. 分析全部子系统：

```json
{ "target": "all" }
```

### 6) API 与文档同步检查

```json
{ "scope": "api" }
```

## 常见问题排查

- 工具不出现 / 调用失败：尝试 Reload Window，并确认 MCP server 已启用
- `npx` 卡确认：确保加了 `-y`
- `Path escapes workspace`：检查 `cwd` / `MCP_WORKSPACE_ROOT` 是否指向仓库根目录

## 工具列表

下面列出本仓库 MCP server v2.0 暴露的全部工具（8 个）。返回值统一为文本（text）。

> **与 v1.0 的区别**：删除了 6 个与 VS Code 内置工具重叠的工具（`timeline_search`、`timeline_read_excerpt`、`timeline_repo_map`、`timeline_trace_entrypoints`、`timeline_run_repo_script`、`timeline_run_mcp_script`），新增 5 个语义分析工具。

---

### `timeline_scaffold_plugin`

**优先级：P0 | 类别：脚手架**

用途：基于模板文件生成新的内置插件骨架，并自动挂载导出。支持特性选择和测试文件生成。

会做什么：

- 在 `packages/timeline/src/plugins/builtin/` 生成插件实现文件（基于模板，非字符串拼接）
- 在 `packages/timeline/src/builtin-plugin/` 生成 re-export
- 在 `packages/timeline/src/index.ts` 自动添加导出
- 可选生成测试文件骨架

输入参数：

- `exportName: string`：导出名（必须是合法标识符，例如 `FooPlugin`）
- `pluginType: "render" | "event_handler" | "data_source" | "theme" | "tool" | "extension"`
- `features?: ("renderLayer" | "eventHandler" | "config" | "lifecycle" | "init")[]`：可选特性，影响生成的骨架代码
- `metadataName?: string`：可选，metadata 名（默认使用 kebab-case 的 exportName）
- `description?: string`：可选，插件描述
- `version?: string`（默认：`"1.0.0"`）：插件版本
- `withReexport?: boolean`（默认：`true`）：是否生成 re-export 文件
- `withIndexExport?: boolean`（默认：`true`）：是否更新 index.ts
- `withTest?: boolean`（默认：`false`）：是否生成测试文件骨架

输出：创建的文件列表 + 下一步建议。

示例：

```json
{
  "exportName": "MyPlugin",
  "pluginType": "render",
  "features": ["renderLayer", "lifecycle"],
  "description": "My custom render plugin",
  "withTest": true
}
```

---

### `timeline_validate_plugin`

**优先级：P0 | 类别：校验**

用途：深度校验内置插件的完整性。传入插件名校验单个插件，不传则校验全部。

检查项：

- 实现文件和 re-export 文件是否存在
- 导出符号是否正确
- `src/index.ts` 是否已导出
- `PluginMetadata` 是否包含必要字段（name, version, type）
- `activate` / `deactivate` 是否成对出现
- re-export 路径是否与 `plugins/builtin` 一致
- 是否有遗留的 TODO 标记

输入参数：

- `name?: string`：指定插件名。不传则检查全部内置插件。

输出：逐项校验报告。

示例：

```json
{ "name": "ContextMenuPlugin" }
```

不传参数校验全部：

```json
{}
```

---

### `timeline_list_builtin_plugins`

**优先级：P0 | 类别：查询**

用途：列出 `packages/timeline/src/plugins/builtin` 下的所有插件名。

输入参数：无。

输出：插件名列表文本。

---

### `timeline_dependency_graph`

**优先级：P1 | 类别：语义查询**

用途：查询符号的依赖关系图。基于 TypeScript Compiler API 解析 import 关系，区分值导入和类型导入。适用于重构前评估影响范围。

输入参数：

- `symbol: string`：类名、函数名、接口名等
- `direction: "dependents" | "dependencies" | "both"`：查询方向
  - `"dependents"`：谁依赖它
  - `"dependencies"`：它依赖谁
  - `"both"`：双向
- `depth?: number`（默认：`1`，范围 1~5）：递归深度

输出：按文件分组的依赖关系列表，标注 `[value]` / `[type]` 导入类型。

示例：

```json
{ "symbol": "ChangeScheduler", "direction": "dependents" }
```

---

### `timeline_type_query`

**优先级：P1 | 类别：语义查询**

用途：查看 interface / type / class / enum 的完整定义，以及指定成员在哪些文件中被读取/修改。

输入参数：

- `type: string`：类型名（例如 `TimelineState`、`PluginType`）
- `member?: string`：可选成员名，传入后额外输出该成员的读/写位置

输出：类型定义（文件、行号、成员列表）+ 可选的成员使用列表。

示例：

```json
{ "type": "TimelineState", "member": "scrollX" }
```

---

### `timeline_consistency_check`

**优先级：P1 | 类别：一致性校验**

用途：运行项目特定的一致性检查规则，检测结构性问题（grep 无法发现的）。

检查项（5 类）：

| 检查项 | 描述 |
|---|---|
| `plugin-exports` | builtin 插件 ↔ re-export ↔ index.ts 导出一致性 |
| `render-layers` | LayerType 定义与实际渲染管线是否匹配 |
| `state-fields` | TimelineState 字段是否全部在 StateManager 中初始化 |
| `change-types` | ChangeType 枚举值是否都有对应的处理逻辑 |
| `boundary-conditions` | 事件区间判断的 `>=` vs `>` 模式是否一致 |

输入参数：

- `checks?: string[]`：指定要运行的检查项。不传则全部执行。

输出：每个检查项的通过/失败状态和详情。

示例：

```json
{ "checks": ["plugin-exports", "state-fields"] }
```

---

### `timeline_perf_annotate`

**优先级：P2 | 类别：性能分析**

用途：静态分析渲染热路径，标注潜在性能问题。

检测规则：

- 循环内的 O(N) 操作（`.some`、`.find`、`.filter`、`.indexOf` → 可能 O(N²)）
- 循环内的对象/数组分配（GC 压力）
- 循环内的字符串拼接
- 迭代全部事件但缺少可见性裁剪
- 每帧创建 Date 对象
- Canvas save/restore 不配对风险

输入参数：

- `target: "render" | "highlight" | "interaction" | "all"`：分析哪个子系统

输出：按严重程度排序的热点列表（HIGH / MEDIUM / LOW），每项包含文件、行号、描述、建议。

示例：

```json
{ "target": "render" }
```

---

### `timeline_migration_helper`

**优先级：P2 | 类别：迁移辅助**

用途：对比当前代码导出与文档内容，检测同步问题。

检测内容：

- 新增的导出但未在文档中提及
- 文档中引用但已删除/重命名的 API
- PluginType 枚举值与 scaffold 模板是否同步

输入参数：

- `scope: "api" | "types" | "plugins"`
  - `"api"`：检查所有导出
  - `"types"`：只检查类型导出
  - `"plugins"`：检查插件导出 + PluginType 一致性

输出：差异列表 + 自动生成的更新建议。

示例：

```json
{ "scope": "api" }
```
