## 缩放与时间指示器

### setZoomLevel(zoomLevel: number): boolean

设置绝对缩放级别，合法范围是 `1.0 ~ 1000.0`。

```ts
timeline.setZoomLevel(2);
```

### zoom(factor: number): void

按比例缩放，内部会尽量保持视口中心对应的时间位置不跳变。

```ts
timeline.zoom(1.2);
timeline.zoom(0.8);
```

### getZoomLevel(): number

```ts
const zoom = timeline.getZoomLevel();
```

### setTimeIndicator(seconds: number, applySnap = false): boolean

设置时间指示器位置，并在需要时自动滚动到可见区域。

```ts
timeline.setTimeIndicator(1800);
timeline.setTimeIndicator(1813, true);
```

说明：

* 位置会被钳制在 `startTime ~ endTime`
* `applySnap = true` 时，会按照当前缩放和刻度配置执行吸附
* 该方法会触发 `onTimeIndicatorMove`

### setTimeIndicatorDuringDrag(seconds: number): void

用于拖拽过程中的轻量更新版本。

```ts
timeline.setTimeIndicatorDuringDrag(1813);
```

说明：

* 会触发 `timeIndicator:drag`
* 不会触发 `onTimeIndicatorMove`
* 不会触发 `onTimeIndicatorHighlight`
* 使用了节流的边缘滚动逻辑

### setEnableTimeIndicator(enabled: boolean): void

```ts
timeline.setEnableTimeIndicator(false);
```

## 画布尺寸与渲染

### setCanvasSize(width: number, height: number): void

显式设置画布逻辑尺寸。

```ts
timeline.setCanvasSize(800, 600);
```

### adjustCanvasSize(): void

重新计算滚动范围并触发 `canvas:resize` 对应的重绘链路。

```ts
timeline.adjustCanvasSize();
```

> 如果容器本身尺寸变了，先调用 `setCanvasSize()` 更新画布宽高，再调用 `adjustCanvasSize()` 或直接依赖 `setCanvasSize()` 触发的重绘。

### draw(): void

立即执行一次绘制。

```ts
timeline.draw();
```

### getCanvas(): HTMLCanvasElement

```ts
const canvas = timeline.getCanvas();
```

### getCanvasLogicalHeight(): number

```ts
const height = timeline.getCanvasLogicalHeight();
```

### getCachedLogicalHeight(): number

返回渲染管理器缓存的逻辑高度。

```ts
const cachedHeight = timeline.getCachedLogicalHeight();
```

### getContentWidthForZoom(zoomLevel: number): number

```ts
const width = timeline.getContentWidthForZoom(1.0);
```

### hasHorizontalScrollbar(): boolean

```ts
const visible = timeline.hasHorizontalScrollbar();
```

### getAvailableHeight(): number

```ts
const availableHeight = timeline.getAvailableHeight();
```

### getLastLayerTimes(): Record\<string, number>

返回最近一次渲染中各逻辑层耗时。

```ts
const times = timeline.getLastLayerTimes();
```

### markDirty(layers): void

手动标记脏层。当前公开签名要求显式传入图层数组。

```ts
timeline.markDirty(["tracks", "indicator", "overlay"]);
```

可用图层：

* `background`
* `tracks`
* `timeline`
* `guideLines`
* `indicator`
* `scrollbar`
* `overlay`
* `interaction`

### notifyChange(change: ChangeType): void

推荐在你直接改动内部状态后使用，由调度器自动完成派生状态刷新、脏层标记和必要回调。

```ts
timeline.config.readOnly = true;
timeline.notifyChange("config:readOnly");
```

常见 `ChangeType`：

* `events:add` / `events:update` / `events:delete` / `events:move` / `events:split`
* `zoom:change`
* `timeIndicator:move` / `timeIndicator:drag`
* `canvas:resize`
* `data:load`
* `theme:change`
* `interaction:hover` / `interaction:contextMenu` / `interaction:splitLine`
* `config:debug` / `config:timeIndicator` / `config:endTime` / `config:readOnly`

### beginChangeBatch(): void

### endChangeBatch(): void

把多次状态变更合并到一次重绘中。

```ts
timeline.beginChangeBatch();
timeline.setReadOnly(true);
timeline.setTimeIndicator(600);
timeline.endChangeBatch();
```

## 命中检测与辅助线

### getInteractionTarget(canvasX, canvasY): InteractionTarget

一次查询同时返回轨道、事件和 resize handle 命中信息。

```ts
const target = timeline.getInteractionTarget(120, 48);
```

### getEventAtPosition(x, y)

```ts
const hit = timeline.getEventAtPosition(120, 48);
```

### getResizeHandle(x, y)

```ts
const handle = timeline.getResizeHandle(120, 48);
```

### calculateGuideLines(...)

根据拖拽目标计算可用辅助线。

```ts
const guideLines = timeline.calculateGuideLines(0, 1, 0, 120, 30);
```

### snapToGuideLines(newStartTime, duration): number | null

```ts
const snapped = timeline.snapToGuideLines(120, 30);
```

### snapEdgeToGuideLines(edgeTime): number | null

用于 resize 场景的单边吸附。

```ts
const snappedEdge = timeline.snapEdgeToGuideLines(150);
```

### canMoveEvent(...): boolean

检查事件能否移动到目标位置。当前实现会同时检查：

* 时间范围是否合法
* 目标轨道上是否和其他事件重叠
* 插件验证钩子 `validate:event:move`

```ts
const ok = timeline.canMoveEvent(0, 1, 0, 240, 60);
```

### showSplitLine(trackIndex, eventIndex, splitTime): void

### hideSplitLine(): void

### splitEvent(trackIndex, eventIndex, splitTime): boolean

用于显示分割预览并执行真正的事件分割。

```ts
timeline.showSplitLine(0, 1, 300);
timeline.splitEvent(0, 1, 300);
timeline.hideSplitLine();
```

说明：

* 分割点不能让任一侧事件短于 `minEventDuration`
* 成功分割后会通过 `onEventUpdate` 回传 `type: "split"`

## 状态、高亮与调试

### setReadOnly(readOnly: boolean): void

```ts
timeline.setReadOnly(true);
```

进入只读后，当前实现会清空选中态、拖拽态、辅助线和右键菜单态。

### isReadOnly(): boolean

```ts
const readonly = timeline.isReadOnly();
```

### highlightEvent(trackIndex, eventIndex): boolean

程序化高亮某个事件。

```ts
timeline.highlightEvent(0, 1);
```

### clearHighlight(): void

```ts
timeline.clearHighlight();
```

### getHighlightedEvent(): { trackIndex: number; eventIndex: number } | null

```ts
const highlighted = timeline.getHighlightedEvent();
```

> `highlightEvent()` / `clearHighlight()` 当前只更新内部状态和渲染，不会触发 `onEventHighlight`。`onEventHighlight` 主要来自交互态里的用户选择流程。

### setDebug(enabled: boolean): void

```ts
timeline.setDebug(true);
```

### setStatus(text: string): void

### getStatus(): string

```ts
timeline.setStatus("Ready");
console.log(timeline.getStatus());
```
