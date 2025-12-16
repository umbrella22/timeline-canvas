# 视图控制 API

## setZoomLevel

`setZoomLevel(zoomLevel: number)`

设置缩放级别。

```javascript
timeline.setZoomLevel(2);
```

## zoom

`zoom(factor: number)`

按因子缩放。

```javascript
timeline.zoom(1.2); // 放大 20%
timeline.zoom(0.8); // 缩小 20%
```

## setTimeIndicator

`setTimeIndicator(seconds: number, applySnap?: boolean)`

设置时间指示器位置（秒）。

```javascript
timeline.setTimeIndicator(18000);
```

## setCanvasSize

`setCanvasSize(width: number, height: number)`

设置画布尺寸。

```javascript
timeline.setCanvasSize(800, 600);
```

## adjustCanvasSize

`adjustCanvasSize()`

根据容器大小自动调整画布尺寸。

```javascript
timeline.adjustCanvasSize();
```

## getCanvas

`getCanvas(): HTMLCanvasElement`

获取画布元素。

```javascript
const canvas = timeline.getCanvas();
```

## markDirty

`markDirty(layerIds?: string[])`

标记画布图层为脏，触发重绘。如果不指定图层，将重绘所有图层。

```javascript
// 重绘所有图层
timeline.markDirty();

// 仅重绘特定图层
timeline.markDirty(["tracks", "indicator"]);
```

## notifyChange

`notifyChange(change: ChangeType)`

通知状态变更，由调度器自动处理脏层标记、派生状态计算和回调触发。

```javascript
timeline.notifyChange("data:load");
```

## beginChangeBatch

`beginChangeBatch()`

开始批量变更操作。在此期间的变更不会立即触发重绘，直到调用 `endChangeBatch`。

```javascript
timeline.beginChangeBatch();
// 执行多次变更...
timeline.endChangeBatch();
```

## endChangeBatch

`endChangeBatch()`

结束批量变更操作。

## getLastLayerTimes

`getLastLayerTimes(): Record<string, number>`

获取各图层最后一次渲染的时间戳。

```javascript
const times = timeline.getLastLayerTimes();
console.log(times);
```

## getContentWidthForZoom

`getContentWidthForZoom(zoomLevel: number): number`

获取指定缩放级别下的内容宽度。

```javascript
const width = timeline.getContentWidthForZoom(1.0);
```

## hasHorizontalScrollbar

`hasHorizontalScrollbar(): boolean`

检查是否显示了水平滚动条。

```javascript
if (timeline.hasHorizontalScrollbar()) {
  // ...
}
```

## getAvailableHeight

`getAvailableHeight(): number`

获取可用高度（减去滚动条等占用的高度）。

```javascript
const height = timeline.getAvailableHeight();
```
