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
type EventMedia = NonNullable<TimelineEvent["media"]>;

// 等价于：
// {
//   images?: Array<{ src: string; fit?: "cover" | "contain" | "stretch"; opacity?: number }>;
//   waveform?: {
//     data: Float32Array | number[];
//     color?: string;
//     backgroundColor?: string;
//     opacity?: number;
//   };
// }
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

* 同一插件实例在本次激活期间按 `src` 复用进行中的请求和已解码位图，跨事件、upsert 和整批重载均可复用。`fit` 与 `opacity` 在绘制时应用。图片内容更新时可在 `src` 中加入版本。
* 图片缓存最多保留 256 个来源、64 MiB 估算 RGBA 数据，优先淘汰最久未绘制的图片。单图超过字节预算时按比例缩小。卸载会取消请求，关闭缓存以及迟到的位图。
* 网络、HTTP 或解码失败后，插件最多在 1 秒和 2 秒后各触发一次重绘，只重试当时仍需绘制的来源。之后的绘制可在指数退避期结束后重试，最长等待 30 秒。
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
