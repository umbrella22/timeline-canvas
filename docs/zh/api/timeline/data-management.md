---
title: 数据管理 API
---

## loadData(data: LoadDataFormat): boolean

加载整份时间轴数据。当前实现会先清空已有轨道和选中态，再把 `LoadDataFormat` 转成运行时 `TimelineEvent`。

```ts
timeline.loadData({
  timeIndicatorPosition: 300,
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 900,
          title: "早班",
          description: "上午工作时段",
        },
        {
          startTime: 1200,
          duration: 600,
          title: "复盘",
        },
      ],
    },
  ],
});
```

说明：

- `events` 既支持 `startTime + endTime`，也支持 `startTime + duration`
- 如果载入后没有任何轨道，`Timeline` 会补一条空轨道
- 如果提供了 `timeIndicatorPosition`，内部会继续调用 `setTimeIndicator()`

## addEvent(...)

```ts
timeline.addEvent(
  0,
  1200,
  1800,
  "自动生成的事件",
  "示例描述",
  { note: "示例" },
  false
);
```

签名：

```ts
addEvent(
  trackIndex: number,
  startTime: number,
  endTime: number,
  title: string,
  description?: string,
  customData?: Record<string, unknown>,
  readonly?: boolean
): void
```

说明：

- `trackIndex` 必须是现有轨道索引
- 公开签名的第三个参数语义是 `endTime`
- 当前实现兼容某些“传时长”的场景，但为了避免歧义，文档建议始终传真实结束时间

## updateEvent(trackIndex, eventIndex, updates): boolean

用 `Partial<TimelineEvent>` 直接更新运行时事件对象。

```ts
timeline.updateEvent(0, 1, {
  title: "更新后的标题",
  color: "#1890ff",
  customData: { owner: "alice" },
});
```

## updateEventData(trackIndex, eventIndex, eventData): boolean

面向表单场景的轻量更新接口，适合只改标题、开始时间、时长和描述。

```ts
timeline.updateEventData(0, 1, {
  title: "剪辑完成",
  startTime: 2400,
  duration: 300,
  description: "导出第一版",
});
```

## deleteEvent(trackIndex, eventIndex): boolean

删除指定事件。

```ts
timeline.deleteEvent(0, 1);
```

说明：

- 删除成功后会触发 `events:delete`
- 若启用了 `autoRemoveEmptyLastTrack`，最后一条空轨道可能被自动移除

## addTrack(): void

添加一条新的空轨道。

```ts
timeline.addTrack();
```

## removeTrack(): void

移除最后一条轨道。

```ts
timeline.removeTrack();
```

说明：

- 至少会保留一条轨道
- 轨道数量不足时不会抛异常，而是更新状态文本

## autoRemoveEmptyLastTrack(): void

如果最后一条轨道为空，并且启用了 `autoRemoveEmptyLastTrack`，则自动递归移除它。

```ts
timeline.autoRemoveEmptyLastTrack();
```

## setEndTime(endTime: number): boolean

更新时间轴结束时间。

```ts
timeline.setEndTime(86400);
```

说明：

- `endTime` 必须大于 `startTime`
- 如果已有事件超出新结束时间，当前实现会给出警告，但不会主动裁剪事件
- 超出范围的时间指示器位置会被钳制到新的 `endTime`

## getEndTime(): number

返回当前结束时间。

```ts
const endTime = timeline.getEndTime();
```

## 索引批处理

当你直接修改 `timeline.state.tracks` 或进行大量外部写入时，索引相关 API 可以减少重建开销。

### beginIndexBatch(): void

```ts
timeline.beginIndexBatch();
```

### endIndexBatch(): void

```ts
timeline.endIndexBatch();
```

### invalidateIndexTrack(trackIndex: number): void

```ts
timeline.invalidateIndexTrack(0);
```

### invalidateIndexAll(): void

```ts
timeline.invalidateIndexAll();
```

> 如果你只是通过 `addEvent`、`updateEvent`、`deleteEvent`、`loadData` 等公开方法操作数据，索引一般会自动失效并刷新。
