# timeline-canvas MCP Server（面向 Copilot Chat）

这个 MCP server 通过 stdio 暴露一组面向本仓库的语义分析与重构辅助工具，适合配合 Copilot Chat 或 AI CLI 在 `timeline-canvas` 仓库内使用。

## 工具

### P0 — 脚手架、校验与重构

- `timeline_scaffold_plugin`
  - 基于模板生成内置插件骨架
  - 支持 `features` 选择与可选测试文件生成

- `timeline_validate_plugin`
  - 深度校验插件完整性
  - 覆盖 metadata、生命周期清理、TODO 扫描与行为模式警告

- `timeline_list_builtin_plugins`
  - 列出所有内置插件

- `timeline_rename_symbol`
  - 基于 TypeScript LanguageService 做跨文件语义重命名
  - 支持 `scope` 过滤与 `dryRun`

### P1 — 语义分析与影响评估

- `timeline_dependency_graph`
  - 查询符号依赖图，支持 `dependents` / `dependencies` / `both`

- `timeline_type_query`
  - 查看类型完整定义，并追踪成员读写位置

- `timeline_consistency_check`
  - 执行项目结构一致性检查
  - 包括插件导出、render layers、change types、dirty mapping、buffer compose、interaction API 边界等规则

- `timeline_impact_analysis`
  - 分析函数/方法签名变更的影响范围

### P2 — 性能与迁移

- `timeline_perf_annotate`
  - 静态分析渲染和交互热路径
  - 已覆盖新的 `InteractionManager`、`TimelineInteractionAPI` 与 idle 子模块拆分

- `timeline_migration_helper`
  - 对比导出与文档同步情况
  - 支持 `api` / `types` / `plugins` / `mcp`
  - `mcp` scope 会检查 mcp-service 自身的版本号、工具清单和文档漂移

## 快速开始

- 在仓库根目录安装依赖：`pnpm install`
- 启动 MCP server：`pnpm mcp`

等价命令：`pnpm -C packages/mcp-service start`

## VS Code / Copilot Chat 配置

仓库已提供示例配置：`.vscode/mcp.json`

### 方案 A：本地开发

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

### 方案 B：npm / npx

```json
{
  "mcpServers": {
    "timeline-canvas": {
      "command": "npx",
      "args": ["-y", "timeline-canvas-mcp@latest"],
      "env": {
        "MCP_WORKSPACE_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

## 最小验证

建议至少调用一次：

- `timeline_list_builtin_plugins`
- `timeline_validate_plugin`
- `timeline_consistency_check`
- `timeline_migration_helper`：`{ "scope": "mcp" }`

完整说明见 [README.md](README.md) 和 [docs/zh/guide/mcp.md](../../docs/zh/guide/mcp.md)。
