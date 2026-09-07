export type GuideFramework = "vanilla" | "react" | "vue";

export interface UsageGuideInput {
  framework: GuideFramework;
}

export interface SourceFile {
  path: string;
  content: string;
}

export interface UsageGuide {
  framework: GuideFramework;
  files: SourceFile[];
  notes: string[];
}

const vanillaFiles: SourceFile[] = [
  {
    path: "index.html",
    content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Timeline example</title>
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <main class="timeline-shell">
      <canvas id="timeline-canvas"></canvas>
    </main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
  },
  {
    path: "src/main.ts",
    content: `import { Timeline } from "timeline-canvas";

const timeline = new Timeline("timeline-canvas", {
  canvasHeight: 320,
  startTime: 0,
  endTime: 120,
  secondWidth: 4,
  autoFitOnInit: false,
});

const resizeObserver = new ResizeObserver(() => timeline.adjustCanvasSize());
resizeObserver.observe(timeline.getCanvas().parentElement!);

timeline.loadData({
  timeIndicatorPosition: 12,
  tracks: [
    {
      events: [
        {
          startTime: 8,
          endTime: 32,
          title: "Planning",
          description: "Define the first milestone",
          color: "#2563eb",
        },
      ],
    },
  ],
});

let disposed = false;

async function loadTheme(): Promise<void> {
  const { LightThemePlugin } = await import("timeline-canvas");
  if (disposed) return;

  await timeline.usePlugin(LightThemePlugin);
  if (disposed) await timeline.destroy();
}

void loadTheme().catch((error: unknown) => {
  if (!disposed) console.error("Failed to load the timeline theme.", error);
});

window.addEventListener(
  "beforeunload",
  () => {
    disposed = true;
    resizeObserver.disconnect();
    void Promise.resolve(timeline.destroy()).catch((error: unknown) => {
      console.error("Failed to destroy the timeline.", error);
    });
  },
  { once: true },
);
`,
  },
  {
    path: "src/styles.css",
    content: `html,
body {
  margin: 0;
}

.timeline-shell {
  width: 100%;
  min-width: 0;
}

#timeline-canvas {
  display: block;
  width: 100%;
}
`,
  },
];

const reactFiles: SourceFile[] = [
  {
    path: "src/TimelineExample.tsx",
    content: `import { useEffect, useId } from "react";
import { Timeline } from "timeline-canvas";
import "./timeline-example.css";

export function TimelineExample() {
  const canvasId = useId();

  useEffect(() => {
    let cancelled = false;
    const timeline = new Timeline(canvasId, {
      canvasHeight: 320,
      startTime: 0,
      endTime: 120,
      secondWidth: 4,
      autoFitOnInit: false,
    });

    const resizeObserver = new ResizeObserver(() => timeline.adjustCanvasSize());
    resizeObserver.observe(timeline.getCanvas().parentElement!);

    timeline.loadData({
      timeIndicatorPosition: 12,
      tracks: [
        {
          events: [
            {
              startTime: 8,
              endTime: 32,
              title: "Planning",
              description: "Define the first milestone",
              color: "#2563eb",
            },
          ],
        },
      ],
    });

    async function loadTheme(): Promise<void> {
      const { LightThemePlugin } = await import("timeline-canvas");
      if (cancelled) return;

      await timeline.usePlugin(LightThemePlugin);
      if (cancelled) await timeline.destroy();
    }

    void loadTheme().catch((error: unknown) => {
      if (!cancelled) console.error("Failed to load the timeline theme.", error);
    });

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      void Promise.resolve(timeline.destroy()).catch((error: unknown) => {
        console.error("Failed to destroy the timeline.", error);
      });
    };
  }, [canvasId]);

  return (
    <div className="timeline-shell">
      <canvas id={canvasId} className="timeline-canvas" />
    </div>
  );
}
`,
  },
  {
    path: "src/timeline-example.css",
    content: `.timeline-shell {
  width: 100%;
  min-width: 0;
}

.timeline-canvas {
  display: block;
  width: 100%;
}
`,
  },
];

const vueFiles: SourceFile[] = [
  {
    path: "src/TimelineExample.vue",
    content: `<script setup lang="ts">
import { onBeforeUnmount, onMounted, useId } from "vue";
import { Timeline } from "timeline-canvas";

const canvasId = useId();
let timeline: Timeline | undefined;
let resizeObserver: ResizeObserver | undefined;
let cancelled = false;

async function loadTheme(instance: Timeline): Promise<void> {
  const { LightThemePlugin } = await import("timeline-canvas");
  if (cancelled || timeline !== instance) return;

  await instance.usePlugin(LightThemePlugin);
  if (cancelled || timeline !== instance) await instance.destroy();
}

onMounted(() => {
  const instance = new Timeline(canvasId, {
    canvasHeight: 320,
    startTime: 0,
    endTime: 120,
    secondWidth: 4,
    autoFitOnInit: false,
  });
  timeline = instance;
  resizeObserver = new ResizeObserver(() => instance.adjustCanvasSize());
  resizeObserver.observe(instance.getCanvas().parentElement!);

  instance.loadData({
    timeIndicatorPosition: 12,
    tracks: [
      {
        events: [
          {
            startTime: 8,
            endTime: 32,
            title: "Planning",
            description: "Define the first milestone",
            color: "#2563eb",
          },
        ],
      },
    ],
  });

  void loadTheme(instance).catch((error: unknown) => {
    if (!cancelled) console.error("Failed to load the timeline theme.", error);
  });
});

onBeforeUnmount(() => {
  cancelled = true;
  resizeObserver?.disconnect();
  resizeObserver = undefined;
  const instance = timeline;
  timeline = undefined;
  if (instance) {
    void Promise.resolve(instance.destroy()).catch((error: unknown) => {
      console.error("Failed to destroy the timeline.", error);
    });
  }
});
</script>

<template>
  <div class="timeline-shell">
    <canvas :id="canvasId" class="timeline-canvas" />
  </div>
</template>

<style scoped>
.timeline-shell {
  width: 100%;
  min-width: 0;
}

.timeline-canvas {
  display: block;
  width: 100%;
}
</style>
`,
  },
];

const filesByFramework: Record<GuideFramework, SourceFile[]> = {
  vanilla: vanillaFiles,
  react: reactFiles,
  vue: vueFiles,
};

export function getUsageGuide(input: UsageGuideInput): UsageGuide {
  const files = filesByFramework[input.framework];
  if (!files) {
    throw new Error(`Unsupported framework: ${String(input.framework)}`);
  }

  return {
    framework: input.framework,
    files: files.map((file) => ({ ...file })),
    notes: [
      "Examples use public timeline-canvas APIs and are tested against 1.4.1 and 1.5.0.",
      "Install timeline-canvas in the application. React examples require React 18 or later; Vue examples require Vue 3.5 or later for useId().",
      "The example ResizeObserver calls the public adjustCanvasSize() method and is disconnected on teardown. It supports the published 1.4.1 release, which does not observe container-only size changes itself.",
      "Cleanup accepts both synchronous and asynchronous destroy() implementations.",
      "Await destroy() when the surrounding runtime supports asynchronous teardown.",
    ],
  };
}
