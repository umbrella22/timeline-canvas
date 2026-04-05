# Timeline Canvas 代码审查报告

**审查日期**: 2026-02-22
**审查范围**: `packages/timeline/`
**版本**: 1.3.1

---

## 📊 整体评价

这是一个**架构设计良好、代码质量较高**的 Canvas 时间轴组件。项目展现出了成熟的工程实践，特别是在渲染优化、插件系统和状态管理方面。

**评分**: ⭐⭐⭐⭐ (4/5)

---

## ✅ 架构亮点

### 1. 分层渲染架构
- 文件: `src/core/managers/RenderManager.ts`
- 使用 `OffscreenCanvas` 实现多层缓冲（background → main → interaction → overlay）
- 脏层检测避免不必要的重绘，性能优化到位
- DPI 缩放处理正确

### 2. 状态机交互模式
- 文件: `src/handlers/MouseHandler.ts`
- 使用状态模式（Idle/Dragging/Resizing/Scrolling/TimeIndicatorDrag）替代复杂的 if-else 嵌套
- RAF 节流优化 mousemove 事件
- 状态转换清晰可追踪

### 3. 插件系统设计
- 文件: `src/core/managers/PluginManager.ts`
- 支持多种插件类型（RENDER/EVENT_HANDLER/THEME/TOOL 等）
- `CoreLayerHook` 中间件模式允许插件拦截和修改核心渲染
- 插件资源自动清理机制

### 4. 变更调度器
- 文件: `src/core/managers/ChangeScheduler.ts`
- 集中管理状态变更与渲染层的依赖关系
- 支持批量操作 (`beginBatch`/`endBatch`)
- 派生状态计算与回调触发分离

### 5. 性能优化细节
- `EventIndexManager` 使用排序数组 + 二分搜索加速事件命中检测，支持批量操作延迟排序
- `EventMediaPlugin` 使用 `ImageBitmap` 和 `Path2D` 缓存
- 波形渲染支持 OffscreenCanvas 预渲染
- `MediaLRUCache` 基于内存大小的 LRU 缓存，正确管理 `ImageBitmap.close()` 释放 GPU 资源

---

## ⚠️ 需要关注的问题

### 1. Timeline 类过于庞大
- 文件: `packages/timeline/src/core/Timeline.ts` (1585 行)
- 问题: `Timeline` 类承担了太多职责

**当前职责**:
- 配置管理
- 事件 CRUD (~195 行)
- 轨道管理 (~55 行)
- 缩放/滚动 (~80 行)
- 辅助线计算与吸附 (~150 行)
- 命中检测 (`getInteractionTarget`/`getEventAtPosition`/`getResizeHandle`) (~230 行)
- 时间指示器与边界滚动 (~150 行)
- 主题切换 (~25 行)

**建议拆分为**:
```typescript
// 建议的新模块结构
src/core/
├── Timeline.ts          // 主入口，协调各模块
├── managers/
│   ├── TrackManager.ts  // 轨道 CRUD
│   ├── ZoomController.ts // 缩放/滚动控制
│   ├── HitTestService.ts // 命中检测（当前三个方法核心逻辑高度重复）
│   └── GuideLineService.ts // 辅助线计算
```

> **补充**: `getInteractionTarget`、`getEventAtPosition`、`getResizeHandle` 三个方法的轨道索引计算和坐标转换逻辑几乎相同，应优先提取到 `HitTestService` 中消除重复。

### 2. 类型定义使用 `any`
- 文件: `packages/timeline/src/plugins/types.ts:36`
- 涉及范围: `RenderLayer.render`、`CoreLayerHook.handler`、`PluginContext.config/state`、`PluginManager` 内部多处

```typescript
// 当前
render: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, config: any, state: any) => void;

// 建议
render: (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  config: TimelineConfig,
  state: TimelineState
) => void;
```

**公开 API 也存在同样问题**:
- 文件: `packages/timeline/src/core/Timeline.ts`

```typescript
// 当前 — 面向消费者的 API 使用 any，破坏类型推导
public usePlugin(plugin: any): Promise<boolean>
public getLoadedPlugins(): any[]

// 建议
public usePlugin(plugin: TimelinePlugin): Promise<boolean>
public getLoadedPlugins(): TimelinePlugin[]
```

### 3. 错误处理不一致
- 文件: `packages/timeline/src/core/Timeline.ts:34`, `packages/timeline/src/core/managers/PluginManager.ts:183-184`

```typescript
// 当前 - 静默失败
} catch {
  return false;
}

// 建议 - debug 模式下记录日志
} catch (error) {
  if (this.config.debug) {
    this.logger.error("Operation failed:", error);
  }
  return false;
}
```

### 4. 缺少单元测试
- 文件: `packages/timeline/package.json:14`

```json
"test": "echo \"Error: no test specified\" && exit 1"
```

**建议测试覆盖**:
- `EventIndexManager` - 二分搜索与批量排序正确性
- `ChangeScheduler` - 批量操作、脏层标记、派生状态计算
- `StateManager` - 状态初始化
- `formatTime`/`snapToInterval` 等工具函数
- 状态机转换 - `IdleState` → `DraggingState`/`ResizingState` 等转换逻辑

### 5. 部分魔法数字
- 文件: `packages/timeline/src/core/Timeline.ts:766-768`

```typescript
// 当前
private static readonly EDGE_SCROLL_THROTTLE = 80;
private static readonly EDGE_SCROLL_MARGIN = 30;

// 建议 - 提取为可配置项
interface TimelineOptions {
  edgeScrollThrottle?: number;  // default: 80
  edgeScrollMargin?: number;    // default: 30
}
```

### 6. builtin-plugin 目录命名易混淆

存在两套看似重复的插件目录：
- `packages/timeline/src/builtin-plugin/` — **re-export 入口层**（每个文件仅 1-2 行）
- `packages/timeline/src/plugins/builtin/` — **真正的插件实现**

`src/builtin-plugin/` 并非重复代码，而是有意设计的 tree-shaking 入口：
- `package.json` 中声明了 `"./builtin-plugin/*"` 子路径导出
- `tsdown.config.ts` 将其作为独立构建入口
- 消费者可通过 `timeline-canvas/builtin-plugin/DarkThemePlugin` 按需引入单个插件

**⚠️ 不可删除此目录，否则会破坏 npm 包的子路径导出功能。**

**建议**: 将目录重命名为 `src/exports/` 或 `src/entries/`，这样能更准确地表达它的工程用途，或在目录中添加 README 说明其用途，以减少混淆。

### 7. 国际化 (i18n) 支持不足
- 文件: `packages/timeline/src/utils/time.ts:67`
- 问题: `formatDuration` 函数硬编码了中文 `"持续"`。作为一个通用的 UI 组件库，这会阻碍国际化。
- **建议**: 在 `TimelineConfig` 中增加 `locale` 或 `formatter` 配置项，允许外部传入自定义的格式化函数。

### 8. 深拷贝陷阱
- 文件: `packages/timeline/src/utils/object.ts:13`
- 问题: `cloneEvent` 对 `customData` 只做了浅拷贝（`{ ...event.customData }`）。如果用户的 `customData` 包含嵌套对象，修改克隆后的事件依然会污染原数据。
- **建议**: 使用 `structuredClone`（如果环境支持）或提供明确的文档警告。

---

## 🔍 细节改进建议

| 文件 | 行号 | 问题 | 建议 |
|------|------|------|------|
| `Timeline.ts` | 493-522 | `validateEventTime` 有两种解析模式，语义不清晰 | 拆分为两个明确的方法 |
| `EventsRenderer.ts` | 265 | `event: any` 和 `textStyle: any` 类型 | 使用 `TimelineEvent` 和 `EventTextStyle` 类型 |
| `RenderPipeline.ts` | 199-211 | 注释提到 `prevContext` 但已移除 | 清理过时注释 |
| `ChangeScheduler.ts` | 485 | `(this as any)._highlightChanged` | 使用私有字段 `#highlightChanged` |
| `IdleState.ts` | - | 文件达 595 行，`handleMouseMove` 承担过多职责 | 提取悬停检测、光标切换等逻辑 |
| `utils/object.ts` | - | `cloneEvent` 对 `customData` 仅做一层展开 | 嵌套对象会引用共享，建议使用 `structuredClone` 或提供文档警告 |
| `utils/time.ts` | - | `formatDuration` 硬编码中文前缀 "持续" | 提取为可配置的 locale 参数或允许外部传入 formatter |

---

## 📈 改进建议优先级

### 高优先级
1. **添加单元测试覆盖核心逻辑**
   - 使用 Vitest 或 Jest
   - 目标覆盖率: 70%+

2. **修复公开 API 的 `any` 类型**
   - `usePlugin(plugin: any)` → `usePlugin(plugin: TimelinePlugin)`
   - `getLoadedPlugins(): any[]` → `getLoadedPlugins(): TimelinePlugin[]`
   - 直接影响消费者的 IDE 智能提示和类型安全

### 中优先级
3. **拆分 Timeline 类**
   - 提取 `TrackManager`
   - 提取 `ZoomController`
   - 提取 `HitTestService`（消除命中检测的重复代码，如 `getInteractionTarget`, `getEventAtPosition`, `getResizeHandle`）
   - 提取 `GuideLineService`

4. **改善 builtin-plugin 目录可读性**
   - 重命名 `src/builtin-plugin/` 为 `src/exports/` 或 `src/entries/`，或添加 README 说明
   - ⚠️ 不可删除，此目录是 npm 子路径导出的构建入口

5. **拆分 IdleState 类**
   - 将“光标样式管理”和“悬停目标检测”进一步抽离为独立的辅助类

### 低优先级
6. **完善内部类型定义**
   - 减少 `plugins/types.ts` 中的 `any`（`RenderLayer`、`CoreLayerHook`、`PluginContext`）
   - `EventsRenderer.ts` 中 `event: any` / `textStyle: any` 使用具体类型

7. **提取配置常量与国际化**
   - `EDGE_SCROLL_THROTTLE`
   - `EDGE_SCROLL_MARGIN`
   - `GUIDE_LINES_CACHE_TTL`
   - 增加 `locale` 或 `formatter` 配置项以支持国际化

8. **修复深拷贝陷阱**
   - 使用 `structuredClone` 替换 `cloneEvent` 中的浅拷贝，或提供明确的文档警告

---

## 🎯 总结

### 优点
- 架构清晰，模块职责分明
- 性能优化到位（脏层检测、多层缓冲、索引加速）
- 插件系统设计灵活
- TypeScript 类型覆盖完整

### 待改进
- 缺少测试覆盖（特别是 `EventIndexManager` 和 `ChangeScheduler`）
- Timeline 类过于庞大（1585 行，含命中检测重复代码 ~230 行），需抽离 `HitTestService` 等
- 公开 API 及插件系统中多处使用 `any`，破坏了类型安全
- `builtin-plugin` 目录命名易与 `plugins/builtin` 混淆（但不可删除，是子路径导出入口），建议重命名为 `exports` 或 `entries`
- `IdleState` 同样过于庞大（595 行），需进一步拆分光标样式管理和悬停目标检测
- `cloneEvent` 浅拷贝对嵌套 `customData` 不安全，建议使用 `structuredClone`
- `formatDuration` 硬编码中文，缺乏国际化支持
