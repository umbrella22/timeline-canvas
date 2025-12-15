# timeline-canvas MCP Server（面向 Copilot Chat）

这个 MCP server 通过 **stdio** 暴露一组面向本仓库的工具，让 AI 能直接“生成内置插件骨架 + 自动挂到导出 + 做基础校验 + 触发仓库脚本”。

## 快速开始（在本仓库内使用）

前置条件：

- Node.js 已安装（建议使用仓库约定的版本，例如 Node 22）
- 已启用 pnpm（仓库根目录的 package.json 已声明 packageManager）

在仓库根目录执行：

- 安装依赖：`pnpm install`
- 启动 MCP server（stdio）：`pnpm mcp`

等价命令：在 `packages/mcp-service` 目录执行 `pnpm start`。

> 说明：这是一个 **stdio MCP server**，通常应由 VS Code / Copilot Chat 启动与托管，不建议你在独立终端里长期手动跑它。

## 工具（Tools）

### 快速定位（减少反复读源码）

- `timeline_repo_map`
  - 输出“关键文件地图”（core/managers/renderers/plugins/docs），用于快速判断应该去哪个文件看

- `timeline_search`
  - 在 `src/`、`docs/` 范围内搜索，返回：文件路径 + 行列号 + 少量上下文片段
  - 支持 `literal` / `regex`，并有 `maxResults`、`contextLines` 限流，避免大段输出

- `timeline_read_excerpt`
  - 按行号读取小范围 excerpt（默认最多 200 行），用于精确查看某段实现/注释

- `timeline_trace_entrypoints`
  - 输出“入口链路导航”（Timeline → managers → handlers → render pipeline → plugin types/docs）并给出行号提示
  - 适合在你只知道“哪里出问题”但不知道“从哪个文件开始看”时先用它

- `timeline_scaffold_builtin_plugin`
  - 在 `src/plugins/builtin/` 生成插件实现文件
  - 在 `src/builtin-plugin/` 生成 re-export 文件（用于 package export map）
  - 在 `src/index.ts` 自动添加导出

- `timeline_validate_builtin_plugin`
  - 校验：文件是否存在、导出符号是否存在、`src/index.ts` 是否已导出

- `timeline_list_builtin_plugins`
  - 列出 `src/plugins/builtin` 下的插件名

- `timeline_run_repo_script`
  - 允许执行的脚本：`lint` / `build` / `typecheck` / `docs:*`
  - 只做 allowlist，避免 AI 任意执行命令

- `timeline_run_mcp_script`
  - 允许执行的脚本：`start` / `dev` / `typecheck`
  - 在 `packages/mcp-service` 目录内执行（MCP 自身的自检/启动）

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

本 MCP server 已发布到 npm（`timeline-canvas-mcp@1.0.0`），推荐使用 `npx` 直接启动：

- Command：`npx`
- Args：`-y timeline-canvas-mcp@1.0.0`

### 可复制的配置示例

不同版本的 VS Code / Copilot Chat 对 MCP server 的配置入口与设置键名可能不完全一致。
下面给的是一个“stdio server 条目”的**通用结构**：你可以在 UI 里新增 MCP server 时逐项填入，或在能编辑的配置 JSON 中按字段映射。

```json
{
  "mcpServers": {
    "timeline-canvas": {
      "command": "npx",
      "args": [
        "-y",
        "timeline-canvas-mcp@1.0.0"
      ],
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

- 让 Copilot Chat 运行 `timeline_repo_map`：应能返回仓库关键文件地图
- 让 Copilot Chat 运行 `timeline_list_builtin_plugins`：应能列出 `src/plugins/builtin` 下的插件

如果工具列表看不到上述工具，通常是 VS Code 还没加载到该 MCP server（见下方排查）。

## 常见问题（排查）

- 工具不出现 / 调用失败：尝试重载窗口（VS Code Command Palette：Reload Window），并确认 MCP server 已启用
- `npx` 卡住或提示确认：为 `npx` 增加 `-y`（仓库 .vscode/mcp.json 已包含）
- 报错 `Path escapes workspace`：说明 `cwd` 或 `MCP_WORKSPACE_ROOT` 指错了，确保它是仓库根目录
- Windows 下找不到 `pnpm`：确认你的 VS Code 环境 PATH 可用（必要时重启 VS Code），或改用能找到的完整命令路径
