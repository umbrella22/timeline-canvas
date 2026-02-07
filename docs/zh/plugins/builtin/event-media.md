---
title: EventMediaPlugin
---

事件媒体插件，在事件块内部渲染图片或波形。

## 基本用法

```ts
import { EventMediaPlugin } from "timeline-canvas/plugins";

await timeline.usePlugin(EventMediaPlugin());
```

## 数据格式

```ts
timeline.loadData({
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 900,
          title: "媒体事件",
          media: {
            images: [
              { src: "path/to/image.jpg", fit: "cover", opacity: 0.8 },
            ],
            waveform: {
              data: [0.1, 0.5, -0.2],
              color: "#1890ff",
              opacity: 0.6,
            },
          },
        },
      ],
    },
  ],
});
```

## 媒体类型配置

```typescript
interface EventMedia {
  images?: Array<{
    src: string;
    fit?: "cover" | "contain" | "stretch";
    opacity?: number;
  }>;
  waveform?: {
    data: Float32Array | number[];
    color?: string;
    backgroundColor?: string;
    opacity?: number;
  };
}
```

## 高级用法

```ts
// 混合媒体类型
timeline.loadData({
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 100,
          title: "音视频事件",
          media: {
            images: [
              {
                src: "thumbnail.jpg",
                fit: "cover",
                opacity: 0.3,
              },
            ],
            waveform: {
              data: audioSamples, // Float32Array 或 number[]
              color: "#ff6b6b",
              opacity: 0.8,
            },
          },
        },
      ],
    },
  ],
});
```
