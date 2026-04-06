事件媒体插件，在事件块内部渲染图片和波形。

## 基本用法

```ts
import { EventMediaPlugin } from "timeline-canvas";

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
              { src: "/cover.jpg", fit: "cover", opacity: 0.35 },
            ],
            waveform: {
              data: [0.1, 0.5, -0.2],
              color: "#1890ff",
              backgroundColor: "rgba(24, 144, 255, 0.08)",
              opacity: 0.6,
            },
          },
        },
      ],
    },
  ],
});
```

## media 字段结构

```ts
interface TimelineEvent["media"] {
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

## 混合渲染示例

```ts
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
                src: "/thumbnail.jpg",
                fit: "contain",
                opacity: 0.25,
              },
            ],
            waveform: {
              data: audioSamples,
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

## 当前实现细节

* 图片会通过 `fetch()` 异步加载并缓存为 `ImageBitmap`
* 波形数据会缓存为 `Float32Array`
* 在支持 `OffscreenCanvas` 的环境下，波形会尽量预渲染为位图
* 图片和波形都会被裁剪在事件块内部
* 渲染顺序是“先图片，后波形”

## 插件事件钩子

该插件内部注册的是：

```ts
"render:event:media"
```

如果你自己实现类似插件，可以复用同一类事件钩子。

## 插件 ID

```ts
"event-media@1.0.0"
```
