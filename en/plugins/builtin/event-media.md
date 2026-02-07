Event media plugin. Renders images or waveforms inside event blocks.

## Basic Usage

```ts
import { EventMediaPlugin } from "timeline-canvas/plugins";

await timeline.usePlugin(EventMediaPlugin());
```

## Data Format

```ts
timeline.loadData({
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 900,
          title: "Media Event",
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

## Media Type Definition

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

## Advanced Usage

```ts
// Mixed media types
timeline.loadData({
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 100,
          title: "Audio/Video Event",
          media: {
            images: [
              {
                src: "thumbnail.jpg",
                fit: "cover",
                opacity: 0.3,
              },
            ],
            waveform: {
              data: audioSamples, // Float32Array or number[]
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
