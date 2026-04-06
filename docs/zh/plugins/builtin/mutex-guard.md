---
title: MutexGuardPlugin
---

事件互斥插件，用于阻止带有相同互斥标签的事件在时间上重叠。

## 基本用法

```ts
import { MutexGuardPlugin } from "timeline-canvas";

await timeline.usePlugin(MutexGuardPlugin());
```

## 配置互斥组

在事件的 `customData.mutex` 中放置字符串数组：

```ts
timeline.loadData({
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 100,
          title: "任务A",
          customData: { mutex: ["group1"] },
        },
        {
          startTime: 120,
          endTime: 180,
          title: "任务B",
          customData: { mutex: ["group1"] },
        },
      ],
    },
  ],
});
```

## 当前实现是如何生效的

插件会注册验证钩子：

```ts
"validate:event:move"
```

也就是说它影响的是会走 `canMoveEvent()` 的交互路径，包括：

- 拖拽移动事件
- 调整事件左右边界

当目标时间区间与任意“同 mutex 标签”的其他事件重叠时，验证会返回 `false`，本次操作被阻止。

## 注意点

- `mutex` 必须是字符串数组
- 检查范围是全轨道，而不是只看当前轨道
- 当前插件元数据里的名称是 `MutexGuardPlugin`

## 插件 ID

```ts
"MutexGuardPlugin@1.0.0"
```

