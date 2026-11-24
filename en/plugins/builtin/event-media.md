Renders images and waveforms inside event blocks.

## Basic usage

```ts
import { EventMediaPlugin } from "timeline-canvas";

await timeline.usePlugin(EventMediaPlugin());
```

## Data shape

```ts
timeline.loadData({
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 900,
          title: "Media event",
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

## `media` field

```ts
type EventMedia = NonNullable<TimelineEvent["media"]>;

// equivalent to:
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

## Mixed-media example

```ts
timeline.loadData({
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 100,
          title: "Audio / video event",
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

## Implementation details

* Within one plugin activation, the same `src` shares one in-flight fetch and one decoded bitmap across events, upserts and reloads. `fit` and `opacity` apply at draw time. Use a versioned `src` when the image bytes change.
* The decoded image cache retains up to 256 sources and 64 MiB of estimated RGBA data. It evicts the least recently drawn source first. Oversized images are scaled proportionally to fit the byte budget. Unloading aborts pending requests and closes retained or late-arriving bitmaps.
* A failed fetch, HTTP response or decode schedules up to two redraws, after 1 and 2 seconds. Each retries the source only if it is still drawn. Later draws may retry after an exponential cooldown capped at 30 seconds.
* Waveform data is cached as `Float32Array`
* When available, the plugin pre-renders waveforms with `OffscreenCanvas`
* Images and waveforms are clipped to the event block bounds
* Images render first, then waveforms

## Plugin event hook

Internally, the plugin registers this event handler:

```ts
"render:event:media"
```

If you build a similar plugin, this is the hook to look at.

## Plugin ID

```ts
"event-media@1.0.0"
```
