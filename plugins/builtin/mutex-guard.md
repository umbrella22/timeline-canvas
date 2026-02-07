事件互斥插件，防止同一互斥组的事件在时间上重叠。

## 基本用法

```ts
import { MutexGuardPlugin } from "timeline-canvas/plugins";

await timeline.usePlugin(MutexGuardPlugin());
```

## 配置互斥组

在事件的 `customData` 中设置 `mutex` 属性，指定该事件所属的互斥组。

```ts
timeline.loadData({
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 100,
          title: "任务A",
          customData: { mutex: ["group1"] }, // 属于 group1
        },
        {
          startTime: 50,
          endTime: 150,
          title: "任务B",
          customData: { mutex: ["group1"] }, // 也属于 group1，将无法放置在与任务A重叠的位置
        },
      ],
    },
  ],
});
```

## 工作原理

当用户尝试移动或调整事件大小时，插件会检查目标位置是否与同一互斥组的其他事件重叠。如果重叠，操作将被阻止或回滚。
