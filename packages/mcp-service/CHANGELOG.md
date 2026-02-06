# timeline-canvas-mcp

## 2.1.0

### New Features

- **新增**：`timeline_rename_symbol` — 基于 TypeScript LanguageService 的跨文件语义重命名，支持 dry-run 预览、scope 过滤（all/value-only/type-only），自动处理定义、调用、import、re-export、类型引用
- **新增**：`timeline_impact_analysis` — 符号级影响分析，支持 5 种变更类型（parameter-semantics / parameter-type / return-type / signature-shape / removal），展示调用点实参、参数语义一致性检测

### Enhancements

- **增强**：`timeline_perf_annotate` 新增跨模块重复调用检测（cross-module redundant calls），识别同一事件链路中 expensive 方法被多处调用的情况，新增交互状态文件扫描目标
- **增强**：`timeline_validate_plugin` 新增行为模式检查：未经 RAF 节流的高频事件监听、activate 中未缓存的 expensive API 调用、deactivate 中未清理的资源（removeEventListener / cancelAnimationFrame / clearInterval）

### Internal

- `TsService` 新增 LanguageService 实例及 `findRenameLocations()`、`findCallSites()`、`getFunctionSignature()` 方法
- 新增类型定义：`RenameSymbolInput`、`ImpactAnalysisInput`、`CallSite`、`ArgumentInfo`

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
