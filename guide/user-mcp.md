`timeline-canvas-user-mcp` 是面向应用团队的只读 stdio MCP server，供 agent 辅助接入 `timeline-canvas` 或开发外部插件。它针对已安装正式 `timeline-canvas` 依赖的普通用户项目工作，不要求用户项目包含 `timeline-canvas` 源码，也不暴露仓库维护工具。

## 选择 Server

| 任务 | npm 包 | `MCP_WORKSPACE_ROOT` 指向 | 能力 |
|---|---|---|---|
| 接入时间轴或开发外部插件 | `timeline-canvas-user-mcp` | 用户应用仓库 | 框架指南、返回给 agent 的插件模板、基于公开 API 的校验 |
| 维护或重构本仓库 | `timeline-canvas-mcp` | `timeline-canvas` 源码仓库 | 10 个内置插件脚手架、语义分析、一致性检查、重构、性能标注和迁移工具 |

默认只为当前工作区启用需要的一个 server。两个 server 不会自动注册或启动彼此。仓库开发请使用[维护者 MCP 指南](/timeline-canvas/guide/mcp.md)。

## 包状态与环境要求

用户 MCP 当前版本为 `timeline-canvas-user-mcp@0.1.0`。通过 npm 启动：

```bash
MCP_WORKSPACE_ROOT=/absolute/path/to/user-project npx -y timeline-canvas-user-mcp@latest
```

开发 MCP 包时仍可使用本地源码构建或 `pnpm pack` tarball。

运行环境与仓库保持一致：

* Node.js `^22.22.2 || ^24.15.0 || >=26.0.0`
* CI 使用 Node.js 24.20.0
* 用户应用已安装 `timeline-canvas`

模板只使用公开 API，已经过 `timeline-canvas@1.4.1` 和当前版本 `timeline-canvas@1.5.0` 验证。每个成功工具响应都包含 `project` 对象：

| 字段 | 含义 |
|---|---|
| `root` | 解析后的用户项目根目录 |
| `installedVersion` | 从用户项目已安装的 `timeline-canvas` 解析出的版本，未安装时为 `null` |
| `testedVersion` | 当前模板测试目标，`1.5.0` |
| `compatibility` | 已安装 `1.4.1` 或 `1.5.0` 时为 `tested-version`；其他已安装版本为 `unverified-version`；无法解析依赖时为 `not-installed` |

每个生成或调整后的插件都需要使用 `timeline_user_validate_plugin`，根据用户项目实际安装的公开声明进行校验。`tested-version` 记录已知模板验证情况，不代表应用插件源码已经通过校验。

## 只读模型

server 恰好暴露三个工具，所有工具都不会写入应用文件。

```text
guide 或 generate 请求
        |
        v
files: [{ path, content }] + notes
（generate 还会返回 usage）
        |
        v
调用 agent 审核并应用文件

validator 请求
        |
        v
读取插件和已安装的公开声明
        |
        v
TypeScript 诊断和静态提示
```

调用 agent 决定用户仓库中的每一项变更。返回的 `path` 是建议目标位置，`content` 是建议文件内容。

## 从本仓库启动

在 `timeline-canvas` 仓库根目录安装并构建：

```bash
pnpm install
pnpm -C packages/user-mcp-service build
```

根目录开发启动命令为：

```bash
MCP_WORKSPACE_ROOT=/absolute/path/to/user-project pnpm mcp:user
```

MCP 客户端连接另一个项目时，应使用绝对路径启动构建后的 bin 文件：

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

VS Code stdio server 的 `MCP_WORKSPACE_ROOT` 使用目标项目的绝对路径。validator 以该目录为解析基准，从该项目安装的依赖中加载公开类型。

## 安装本地 Tarball

构建并生成 npm 包归档：

```bash
pnpm -C /path/to/timeline-canvas/packages/user-mcp-service build
pnpm -C /path/to/timeline-canvas/packages/user-mcp-service pack
```

包目录中会生成 `timeline-canvas-user-mcp-0.1.0.tgz`。将它安装到用户项目：

```bash
pnpm --dir /absolute/path/to/user-project add -D \
  /path/to/timeline-canvas/packages/user-mcp-service/timeline-canvas-user-mcp-0.1.0.tgz
```

将 MCP 客户端指向安装后的可执行文件：

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

npm 包客户端可以使用：

```json
{
  "servers": {
    "timeline-canvas-user": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "timeline-canvas-user-mcp@latest"],
      "env": {
        "MCP_WORKSPACE_ROOT": "/absolute/path/to/user-project"
      }
    }
  }
}
```

## `timeline_user_get_guide`

返回一个受支持应用框架的精简接入指南。

输入：

```ts
{
  framework: "vanilla" | "react" | "vue";
}
```

示例：

```json
{ "framework": "react" }
```

响应包含 `files: [{ path, content }]` 和 notes。文件只返回给调用 agent，不由 MCP server 创建。

## `timeline_user_generate_plugin`

使用三个模板之一返回外部插件源码。

输入：

```ts
{
  template: "basic" | "render" | "event-handler";
  exportName?: string; // 默认为 "createCustomPlugin"
  name?: string;
  description?: string;
}
```

模板：

| 模板 | 用途 |
|---|---|
| `basic` | 最小 `TimelinePlugin` 工厂 |
| `render` | 包含自定义渲染行为的插件 |
| `event-handler` | 处理时间轴事件的插件 |

示例：

```json
{
  "template": "render",
  "exportName": "createCustomPlugin",
  "name": "release-markers",
  "description": "Render release markers above timeline events"
}
```

响应包含 `files: [{ path, content }]`、usage、notes、已安装库版本、模板 `testedVersion` 和兼容状态。模板只使用公开 API，已经过 `timeline-canvas@1.4.1` 和 `timeline-canvas@1.5.0` 验证；当前 `testedVersion` 为 `1.5.0`。agent 审核后应用返回源码。

## `timeline_user_validate_plugin`

根据用户应用中安装的公开声明检查一个外部插件。

输入：

```ts
{
  filePath: string;
  exportName: string;
}
```

示例：

```json
{
  "filePath": "src/timeline-plugin.ts",
  "exportName": "createCustomPlugin"
}
```

validator 在 `MCP_WORKSPACE_ROOT` 下解析 `filePath`。没有设置环境变量时，使用 server 进程的 cwd。公开类型声明来自用户项目安装的 `timeline-canvas` 包。

TypeScript 6 检查文件，并确认指定导出属于以下任一种形式：

* 可赋值给 `TimelinePlugin` 的对象；
* 返回值可赋值给 `TimelinePlugin` 的工厂函数。

报告可能包含少量生命周期模式的静态提示。这些提示用于补充类型检查，不会执行插件。`checks.runtime` 始终为 `not-run`。

validator 不会：

* 导入或运行插件代码；
* 检查真实 Canvas 输出；
* 测量渲染或交互性能；
* 证明浏览器或运行时行为正确。

## 推荐工作流

1. 根据应用框架调用 `timeline_user_get_guide`，由 agent 审核并应用返回文件。
2. 使用满足需求的最小模板调用 `timeline_user_generate_plugin`，由 agent 应用返回源码。
3. 安装应用的正常依赖，包括 `timeline-canvas`。
4. 对生成插件和指定导出调用 `timeline_user_validate_plugin`。
5. 根据项目需要运行应用自身的类型检查、测试、视觉检查或性能检查。

用户 MCP 不要求存在 `timeline-canvas` 源码目录，也不会暴露或调用维护者 MCP 工具。
