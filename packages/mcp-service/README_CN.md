# timeline-canvas MCP Server（面向 Copilot Chat）

这个 MCP server 通过 **stdio** 暴露一组面向本仓库的工具，让 AI 能进行**项目级语义分析**——包括插件脚手架、深度校验、符号依赖图、类型查询、一致性检查、性能标注和迁移辅助。

> 搜索、读取文件、执行脚本等通用操作请直接使用 VS Code 内置工具（`grep_search`、`read_file`、`run_in_terminal` 等）。

## 快速开始（在本仓库内使用）

前置条件：

- Node.js 已安装（建议使用仓库约定的版本，例如 Node 22）
- 已启用 pnpm（仓库根目录的 package.json 已声明 packageManager）
- TypeScript >= 5.0（语义分析工具的可选 peerDependency，已随仓库安装）

在仓库根目录执行：

- 安装依赖：`pnpm install`
- 启动 MCP server（stdio）：`pnpm mcp`

等价命令：在 `packages/mcp-service` 目录执行 `pnpm start`。

> 说明：这是一个 **stdio MCP server**，通常应由 VS Code / Copilot Chat 启动与托管，不建议你在独立终端里长期手动跑它。

## 工具（Tools）

### P0 — 脚手架 & 校验

- **`timeline_scaffold_plugin`**
  - 基于模板文件生成内置插件骨架（非字符串拼接）
  - 支持 `features` 选择（renderLayer / eventHandler / config / lifecycle / init）
  - 可选生成测试文件骨架（`withTest: true`）
  - 自动在 `src/plugins/builtin/` 生成实现文件、`src/builtin-plugin/` 生成 re-export、`src/index.ts` 添加导出

- **`timeline_validate_plugin`**
  - 深度校验插件完整性：文件存在、导出符号、metadata 字段（name/version/type）、activate/deactivate 配对、re-export 路径一致性、TODO 标记扫描
  - 不传参数时校验全部内置插件

- **`timeline_list_builtin_plugins`**
  - 列出 `src/plugins/builtin` 下的所有插件名

### P1 — 语义分析

- **`timeline_dependency_graph`**
  - 基于 TypeScript Compiler API 查询符号依赖图
  - 支持 `dependents` / `dependencies` / `both` 方向，区分 value/type 导入
  - 可配置递归深度（1~5 层）

- **`timeline_type_query`**
  - 查看 interface / type / class / enum 的完整定义
  - 可选追踪指定 member 的读/写位置

- **`timeline_consistency_check`**
  - 5 类项目特定一致性规则：`plugin-exports`、`render-layers`、`state-fields`、`change-types`、`boundary-conditions`
  - 可选传入 `checks` 数组只跑部分检查

### P2 — 性能 & 迁移

- **`timeline_perf_annotate`**
  - 静态分析渲染热路径（循环内 O(N) 操作、GC 压力、缺失可见性裁剪、Canvas save/restore 不配对等）
  - 支持 `render` / `highlight` / `interaction` / `all` 子系统选择

- **`timeline_migration_helper`**
  - 对比代码导出与文档内容，检测 API 同步问题
  - 支持 `api` / `types` / `plugins` 三种 scope

## 启动（本地）

在 `packages/mcp-service` 目录：

- 安装依赖：`pnpm install`
- 启动 server：`pnpm start`

> 建议通过 VS Code / Copilot Chat 配置 MCP server 来启动，而不是手动启动。

## VS Code 配置要点（stdio）

仓库已提供一个可参考的配置文件：.vscode/mcp.json

你可以直接复用该配置（或把其中的 server 条目复制到你的 MCP 配置入口里），关键点只有两个：

- **command/args**：以 stdio 方式启动本服务
- **workspace root**：确保服务能定位到仓库根目录（通过 `cwd` 或 `MCP_WORKSPACE_ROOT`）

### 方案 A：本地开发（未发布到 npm 时推荐）

如果你是在这个仓库里开发/调试 MCP（不依赖 npm 发布），最稳妥的是用 pnpm 在工作区内启动：

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

### 方案 B：通过 npx 启动（适用于已发布到 npm 的版本）

本 MCP server 已发布到 npm（`timeline-canvas-mcp@2.0.0`），推荐使用 `npx` 直接启动：

- Command：`npx`
- Args：`-y timeline-canvas-mcp@2.0.0`

### 可复制的配置示例

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

如果你的配置系统支持配置工作目录或环境变量，建议将 `cwd` 指向工作区根目录，或设置 `MCP_WORKSPACE_ROOT=${workspaceFolder}`。

## 验证是否生效

完成 VS Code / Copilot Chat 的 MCP 配置后，建议做一次最小验证：

- 让 Copilot Chat 运行 `timeline_list_builtin_plugins`：应能列出 `src/plugins/builtin` 下的插件
- 让 Copilot Chat 运行 `timeline_validate_plugin`（不传参数）：应返回所有内置插件的校验报告
- 让 Copilot Chat 运行 `timeline_consistency_check`：应返回项目一致性检查结果

如果工具列表看不到上述工具，通常是 VS Code 还没加载到该 MCP server（见下方排查）。

## 常见问题（排查）

- 工具不出现 / 调用失败：尝试重载窗口（VS Code Command Palette：Reload Window），并确认 MCP server 已启用
- `npx` 卡住或提示确认：为 `npx` 增加 `-y`（仓库 .vscode/mcp.json 已包含）
- 报错 `Path escapes workspace`：说明 `cwd` 或 `MCP_WORKSPACE_ROOT` 指错了，确保它是仓库根目录
- Windows 下找不到 `pnpm`：确认你的 VS Code 环境 PATH 可用（必要时重启 VS Code），或改用能找到的完整命令路径
- 语义分析工具报错：确认 TypeScript >= 5.0 已安装（`pnpm install` 后应自动满足）
