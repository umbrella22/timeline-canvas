# timeline-canvas

## 1.2.0

### New Features

- **新增**：引入分层缓冲机制 (`LayerBufferManager`)，利用 `OffscreenCanvas` 实现分层渲染，大幅减少复杂场景下的重绘开销
- **新增**：引入媒体工作线程 (`media.worker`) 与 `MediaWorkerBridge`，将波形图生成和位图处理异步化，提升界面响应能力
- **新增**：引入 `MediaLRUCache` 管理 `ImageBitmap` 缓存，支持基于事件 ID 的缓存失效和内存自动淘汰机制
- **新增**：支持主题插件加载后自动同步缓冲层颜色，确保 UI 一致性

### Enhancements

- **增强**：优化交互命中性能，通过 `InteractionTarget` 统一事件体与调整手柄的扫描逻辑，减少重复计算
- **增强**：优化时间指示器拖拽体验，采用轻量化更新路径，避免触发昂贵的高亮计算和状态回调
- **增强**：优化高亮检测性能，利用 `EventIndexManager` 实现局部索引查询，避免全量扫描事件列表
- **增强**：优化 `ChangeScheduler` 的脏标记算法，支持更精确的图层依赖管理
- **增强**：`EventTooltipPlugin` 鼠标移动监听引入 `requestAnimationFrame` 节流处理，降低高频交互下的 CPU 负载

### Bug Fixes

- **修复**：修复事件拖拽过程中选中状态索引未正确更新的问题
- **修复**：修复 `EventIndexManager` 在特定边界条件下（过早 break）可能遗漏长事件的查询 Bug
- **修复**：修复渲染管线中可能存在的空事件引用导致的崩溃风险
- **修复**：修复 `TracksRenderer` 实例复用逻辑，降低频繁操作时的 GC 压力

### Internal

- 新增 `LayerBufferManager`、`MediaWorkerBridge`、`MediaLRUCache` 等核心性能管理类
- 重构 `RenderPipeline` 与 `RenderManager`，完全转向基于脏层标记的渲染流
- 统一交互状态机中的命中接口

## 1.0.0

### Major Changes

- **重构**：项目正式迁移至 Monorepo 架构，核心包命名为 `timeline-canvas`
- **重构**：核心渲染引擎与插件化系统基础架构搭建完成
- **新增**：支持基础事件渲染、交互（拖拽、缩放）、内置主题与工具提示插件
