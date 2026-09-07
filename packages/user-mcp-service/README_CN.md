# timeline-canvas 用户 MCP Server

`timeline-canvas-user-mcp` 是面向应用接入者和外部插件开发者的只读 stdio MCP server。它向调用 agent 提供框架接入指南、插件源码模板和 TypeScript 校验；用户项目不需要包含 `timeline-canvas` 源码仓库。

它与 `timeline-canvas-mcp` 的定位不同。后者供贡献者在本仓库内执行维护、重构和内置插件相关工作。

| 使用场景 | npm 包 | 工作区 | 能力 |
|---|---|---|---|
| 应用接入或外部插件开发 | `timeline-canvas-user-mcp` | 用户应用仓库 | 接入指南、由 agent 应用的生成源码、基于已安装公开 API 的校验 |
| `timeline-canvas` 仓库维护 | `timeline-canvas-mcp` | `timeline-canvas` 源码仓库 | 10 个内置插件脚手架、语义分析、一致性检查、重构与迁移工具 |

默认只为当前工作区启用需要的一个 server。两个包都不会自动注册或启动另一个 server。仓库维护场景见[维护者 MCP README](../mcp-service/README_CN.md)。

## 从 npm 安装和启动

当前包版本为 `timeline-canvas-user-mcp@0.1.0`。使用 npm 当前版本连接目标应用工作区：

```bash
MCP_WORKSPACE_ROOT=/absolute/path/to/user-project npx -y timeline-canvas-user-mcp@latest
```

下文的源码构建和本地 tarball 方式用于开发 MCP 包本身。

## 工具

server 恰好暴露三个工具：

| 工具 | 输入 | 返回 |
|---|---|---|
| `timeline_user_get_guide` | `{ framework: "vanilla" | "react" | "vue" }` | 对应框架的 `files: [{ path, content }]` 和 notes |
| `timeline_user_generate_plugin` | `{ template: "basic" | "render" | "event-handler", exportName?, name?, description? }` | 外部插件 `files: [{ path, content }]`、usage、notes 和模板兼容信息；`exportName` 默认为 `createCustomPlugin` |
| `timeline_user_validate_plugin` | `{ filePath: string, exportName: string }` | TypeScript 诊断、导出校验和有限的静态生命周期提示；标准示例使用 `src/timeline-plugin.ts` 和 `createCustomPlugin` |

三个工具全部只读。guide 和 generate 返回建议文件，由调用 agent 决定如何应用；server 不会向用户项目写入业务文件。validator 会读取一个插件文件，但不会导入或执行插件。

## 环境要求

- Node.js `^22.22.2 || ^24.15.0 || >=26.0.0`
- CI 使用 Node.js 24.20.0
- 用户项目已安装 `timeline-canvas`

模板只使用公开 API，已经过 `timeline-canvas@1.4.1` 和当前版本 `timeline-canvas@1.5.0` 验证。每个成功响应都包含 `project` 对象，其中有 `installedVersion`、`testedVersion` 和 `compatibility`；`testedVersion` 为 `1.5.0`。已安装版本为 `1.4.1` 或 `1.5.0` 时，兼容状态为 `tested-version`；其他已安装版本为 `unverified-version`；无法解析依赖时为 `not-installed`。

每个生成或调整后的插件仍需使用 `timeline_user_validate_plugin`，根据应用实际安装的公开声明进行校验。`tested-version` 只表示模板已经过对应版本验证，不能替代对应用插件源码的校验。

## 从源码构建和启动

在 `timeline-canvas` 仓库根目录执行：

```bash
pnpm install
pnpm -C packages/user-mcp-service build
MCP_WORKSPACE_ROOT=/absolute/path/to/user-project pnpm mcp:user
```

MCP 客户端可通过绝对路径运行构建后的 launcher。`MCP_WORKSPACE_ROOT` 指定需要接入时间轴或校验插件的目标项目：

```json
{
  "servers": {
    "timeline-canvas-user": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/timeline-canvas/packages/user-mcp-service/bin/timeline-canvas-user-mcp.js"
      ],
      "env": {
        "MCP_WORKSPACE_ROOT": "/absolute/path/to/user-project"
      }
    }
  }
}
```

根脚本 `pnpm mcp:user` 适合在源码仓库中直接启动。客户端工作区是独立用户项目时，更适合使用上面的绝对 `node` launcher。

## 安装本地打包产物

构建并打包 `0.1.0`：

```bash
pnpm -C /path/to/timeline-canvas/packages/user-mcp-service build
pnpm -C /path/to/timeline-canvas/packages/user-mcp-service pack
```

在用户项目中安装生成的 tarball：

```bash
pnpm --dir /absolute/path/to/user-project add -D \
  /path/to/timeline-canvas/packages/user-mcp-service/timeline-canvas-user-mcp-0.1.0.tgz
```

然后配置已安装的可执行文件：

```json
{
  "servers": {
    "timeline-canvas-user": {
      "type": "stdio",
      "command": "/absolute/path/to/user-project/node_modules/.bin/timeline-canvas-user-mcp",
      "args": [],
      "env": {
        "MCP_WORKSPACE_ROOT": "/absolute/path/to/user-project"
      }
    }
  }
}
```

npm 包也可以直接启动：

```bash
npx -y timeline-canvas-user-mcp@latest
```

## 校验边界

`timeline_user_validate_plugin` 在 `MCP_WORKSPACE_ROOT` 下解析 `filePath`；未设置该变量时使用 server 进程的 cwd。它从用户项目安装的 `timeline-canvas` 包加载公开声明，并使用 TypeScript 6 检查插件文件。

指定导出可以是 `TimelinePlugin` 对象，也可以是返回值符合 `TimelinePlugin` 的工厂函数。校验还可能给出有限的静态生命周期提示。它不会执行插件代码，不检查真实 Canvas 画面，不测量性能，也不声称验证了运行时正确性；`checks.runtime` 始终为 `not-run`。

完整说明见[用户 MCP 指南](../../docs/zh/guide/user-mcp.md)和[英文 README](README.md)。
