# 数据管理 API

## loadData(data: LoadDataFormat)

加载时间轴数据（秒制时间）。

```javascript
timeline.loadData({
  timeIndicatorPosition: 0,
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 900,
          title: "早班",
          description: "上午工作时段",
        },
      ],
    },
  ],
});
```

## addEvent

`addEvent(trackIndex: number, startTime: number, endTime: number, title: string, description?: string, customData?: any, readonly?: boolean)`

在指定轨道添加事件。

```javascript
timeline.addEvent(0, 1200, 1800, "自动生成的事件", "示例描述", {
  note: "示例",
});
```

## updateEvent

`updateEvent(trackIndex: number, eventIndex: number, updates: Partial<TimelineEvent>)`

更新事件。

```javascript
timeline.updateEvent(0, 1, {
  title: "更新后的标题",
});
```

## deleteEvent

`deleteEvent(trackIndex: number, eventIndex: number)`

删除事件。

```javascript
timeline.deleteEvent(0, 1);
```

## addTrack

`addTrack()`

添加一个新的空轨道。

```javascript
timeline.addTrack();
```

## removeTrack

`removeTrack()`

移除最后一个轨道。

```javascript
timeline.removeTrack();
```

## autoRemoveEmptyLastTrack

`autoRemoveEmptyLastTrack()`

自动移除最后一个空轨道（如果存在）。

```javascript
timeline.autoRemoveEmptyLastTrack();
```

## setEndTime

`setEndTime(endTime: number)`

设置时间轴结束时间（秒）。

```javascript
timeline.setEndTime(86400); // 设置结束时间为24小时
```

## getEndTime

`getEndTime(): number`

获取时间轴结束时间（秒）。

```javascript
const endTime = timeline.getEndTime(); // 返回秒数
```

## beginIndexBatch

`beginIndexBatch()`

开始批量索引更新。在批量添加或修改大量事件时使用，可以提高性能。

```javascript
timeline.beginIndexBatch();
// 批量添加事件...
timeline.endIndexBatch();
```

## endIndexBatch

`endIndexBatch()`

结束批量索引更新，并重建索引。

## invalidateIndexTrack

`invalidateIndexTrack(trackIndex: number)`

使指定轨道的索引失效，下次查询时会重新构建。

```javascript
timeline.invalidateIndexTrack(0);
```

## invalidateIndexAll

`invalidateIndexAll()`

使所有轨道的索引失效。

```javascript
timeline.invalidateIndexAll();
```
