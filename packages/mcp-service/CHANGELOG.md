# timeline-canvas-mcp

## 2.2.0

### Bug Fixes

- **修复**：`timeline_perf_annotate` 扫描路径大面积失效 — 13 个 `SCAN_TARGETS` 硬编码路径与实际源码目录不匹配（如 `core/renderers/EventRenderer.ts` → `renderers/layers/EventsRenderer.ts`），导致工具输出严重不完整
- **修复**：`timeline_consistency_check` 的 `change-types` 检查失效 — 正则只能匹配 enum 风格定义，无法匹配 `ChangeScheduler.ts` 中的字符串字面量联合类型 `type ChangeType = "events:add" | ...`
- **修复**：`timeline_consistency_check` 的 `render-layers` 查找路径错误（`core/renderers/RenderPipeline.ts` → `renderers/core/RenderPipeline.ts`）
- **修复**：`timeline_consistency_check` 的 `state-fields` 查找路径错误（`types.ts` → `types/index.ts`）
- **修复**：`timeline_consistency_check` 的 `boundary-conditions` 包含多个不存在的文件路径

### New Features

- **新增**：`timeline_consistency_check` 新增 `dirty-mapping` 检查 — 验证 ChangeScheduler 中使用的 LayerType 是否在 LAYER_TO_BUFFER 映射中有对应条目
- **新增**：`timeline_consistency_check` 新增 `buffer-compose` 检查 — 验证所有 BufferLayerId 都包含在 RenderManager 的合成步骤中
- **新增**：`timeline_scaffold_plugin` 新增 `media` feature 支持，选择后使用媒体插件模板（Worker 异步位图生成 + deactivate 资源清理）
- **新增**：媒体插件模板 `plugin-media.template`，包含位图缓存管理、Worker 异步渲染钩子、ImageBitmap 清理逻辑

### Enhancements

- **增强**：`timeline_perf_annotate` 新增 OffscreenCanvas 相关扫描目标（`LayerBufferManager`、`media.worker`、`MediaWorkerBridge`、`MediaLRUCache`）
- **增强**：`timeline_perf_annotate` 新增 4 条检测规则：`offscreen-canvas-resize-without-clear`、`drawimage-in-loop`、`transferable-not-used`、`worker-sync-in-render`
- **增强**：`timeline_perf_annotate` 新增 `worker` target 分类，EXPENSIVE_METHODS 补充 `markDirtyFromLayers`、`transferToImageBitmap`、`createImageBitmap`
- **增强**：`timeline_validate_plugin` 新增 Worker / OffscreenCanvas / MediaLRUCache 资源清理检测，以及 RENDER 插件直接访问主 canvas ctx 的警告
- **增强**：`plugin-render.template` 更新注释说明 ctx 来自 OffscreenCanvas buffer

### Internal

- `ConsistencyCheckName` 扩展 `dirty-mapping` | `buffer-compose`
- `PerfTarget` 扩展 `worker`
- `PluginFeature` 扩展 `media`
- `server.ts` 同步更新 `consistency_check`、`perf_annotate`、`scaffold_plugin` 的 inputSchema 枚举

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
