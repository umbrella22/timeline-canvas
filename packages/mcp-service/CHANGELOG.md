# timeline-canvas-mcp

## 2.0.0

### Major Changes

- **删除工具**：`timeline_repo_map`、`timeline_search`、`timeline_read_excerpt`、`timeline_trace_entrypoints`、`timeline_run_repo_script`、`timeline_run_mcp_script`
- **脚手架升级**：`timeline_scaffold_plugin` 改为模板驱动，支持 features 选择和测试文件生成
- **校验升级**：`timeline_validate_plugin` 新增 metadata 字段检查、activate/deactivate 配对、TODO 扫描、全量校验模式
- **新增**：`timeline_dependency_graph` — 基于 TypeScript Compiler API 的符号依赖图查询
- **新增**：`timeline_type_query` — 类型定义查看 + 成员引用追踪
- **新增**：`timeline_consistency_check` — 5 类项目一致性规则
- **新增**：`timeline_perf_annotate` — 渲染热路径静态分析
- **新增**：`timeline_migration_helper` — API 导出与文档同步检查
- **架构调整**：新增 services 层（templateEngine / tsService / projectModel），tools 层拆分为独立模块

## 1.0.0

### Major Changes

- 新建 mcp 服务
