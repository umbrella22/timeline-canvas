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

## markDirty

`markDirty(layerIds?: string[])`

标记画布图层为脏，触发重绘。如果不指定图层，将重绘所有图层。

```javascript
// 重绘所有图层
timeline.markDirty();

// 仅重绘特定图层
timeline.markDirty(["tracks", "indicator"]);
```
