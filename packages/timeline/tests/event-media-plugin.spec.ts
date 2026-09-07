import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { StateManager } from "../src/core/managers/StateManager";
import type { Timeline } from "../src/core/Timeline";
import { EventMediaPlugin } from "../src/plugins/builtin/EventMediaPlugin";
import type {
  PluginAPI,
  PluginContext,
  PluginEventHandler,
} from "../src/plugins/types";
import type { TimelineConfig, TimelineEvent } from "../src/types";
import {
  DEFAULT_COLORS,
  DEFAULT_CONFIG,
  DEFAULT_CONTEXT_MENU_ITEMS,
  DEFAULT_CONTEXT_MENU_STYLE,
  DEFAULT_EVENT_BLOCK_STYLE,
  DEFAULT_EVENT_TEXT_STYLE,
} from "../src/utils";
import { createMockCanvas, createMockCanvasContext } from "./helpers";

function createConfig(
  overrides: Partial<TimelineConfig> = {}
): TimelineConfig {
  return {
    ...DEFAULT_CONFIG,
    autoFitOnInit: false,
    colors: DEFAULT_COLORS,
    eventTextStyle: DEFAULT_EVENT_TEXT_STYLE,
    eventBlockStyle: DEFAULT_EVENT_BLOCK_STYLE,
    contextMenuItems: DEFAULT_CONTEXT_MENU_ITEMS,
    contextMenuStyle: DEFAULT_CONTEXT_MENU_STYLE,
    ...overrides,
  };
}

function createContext(config: TimelineConfig): {
  context: PluginContext;
  store: Map<string, unknown>;
} {
  const store = new Map<string, unknown>();
  const state = new StateManager(config).state;
  const timeline = {
    markDirty: vi.fn(),
    draw: vi.fn(),
  } as unknown as Timeline;
  const api: PluginAPI = {
    registerRenderLayer: vi.fn(),
    unregisterRenderLayer: vi.fn(),
    registerCoreLayerHook: vi.fn(),
    unregisterCoreLayerHook: vi.fn(),
    registerEventHandler: (event: string, handler: PluginEventHandler) => {
      store.set(event, handler);
    },
    unregisterEventHandler: vi.fn(),
    showNotification: vi.fn(),
    getData: (key: string) => store.get(key),
    setData: (key: string, value: unknown) => {
      store.set(key, value);
    },
    setPerformanceProvider: vi.fn(),
    getPerformanceStats: () => new Map(),
    getFPS: () => 0,
  };

  return {
    context: {
      timeline,
      config,
      state,
      api,
    },
    store,
  };
}

type MockImageBitmap = ImageBitmap & {
  close: ReturnType<typeof vi.fn>;
};

function createMockImageBitmap(width = 64, height = 32): MockImageBitmap {
  return {
    width,
    height,
    close: vi.fn(),
  } as unknown as MockImageBitmap;
}

function createScaleTransform(scaleX: number, scaleY = scaleX): DOMMatrix {
  return { a: scaleX, b: 0, c: 0, d: scaleY } as DOMMatrix;
}

function createWaveformCanvasContext(scale = 1): CanvasRenderingContext2D {
  const ctx = createMockCanvasContext();
  ctx.getTransform = vi.fn(() => createScaleTransform(scale));
  return ctx;
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function installWaveformMocks(): {
  bitmaps: MockImageBitmap[];
  contexts: OffscreenCanvasRenderingContext2D[];
} {
  const bitmaps: MockImageBitmap[] = [];
  const contexts: OffscreenCanvasRenderingContext2D[] = [];

  class Path2DMock {
    moveTo(): void {}
    lineTo(): void {}
  }

  class OffscreenCanvasMock {
    readonly width: number;
    readonly height: number;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }

    getContext(): OffscreenCanvasRenderingContext2D {
      const context = {
        fillRect: vi.fn(),
        scale: vi.fn(),
        stroke: vi.fn(),
      } as unknown as OffscreenCanvasRenderingContext2D;
      contexts.push(context);
      return context;
    }

    transferToImageBitmap(): ImageBitmap {
      const bitmap = createMockImageBitmap(this.width, this.height);
      bitmaps.push(bitmap);
      return bitmap;
    }
  }

  vi.stubGlobal("Path2D", Path2DMock);
  vi.stubGlobal("OffscreenCanvas", OffscreenCanvasMock);
  return { bitmaps, contexts };
}

function setSingleMediaEvent(
  context: PluginContext,
  media: NonNullable<TimelineEvent["media"]>
): void {
  context.state.tracks = [
    {
      id: 0,
      events: [createEvent({ media })],
    },
  ];
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function createEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 0,
    startTime: 0,
    endTime: 10,
    duration: 10,
    title: "事件",
    description: "",
    color: "#ff0000",
    ...overrides,
  };
}

describe("EventMediaPlugin", () => {
  it("isolates waveform bitmaps between plugin instances", async () => {
    const { bitmaps } = installWaveformMocks();
    const config = createConfig();
    const first = createContext(config);
    const second = createContext(config);
    const firstPlugin = EventMediaPlugin();
    const secondPlugin = EventMediaPlugin();
    await firstPlugin.activate?.(first.context);
    await secondPlugin.activate?.(second.context);

    setSingleMediaEvent(first.context, {
      waveform: { data: [0.1, 0.2, 0.3] },
    });
    setSingleMediaEvent(second.context, {
      waveform: { data: [0.9, 0.8, 0.7] },
    });

    const firstHandler = first.store.get(
      "eventMediaHandler"
    ) as PluginEventHandler;
    const secondHandler = second.store.get(
      "eventMediaHandler"
    ) as PluginEventHandler;
    const firstCtx = createWaveformCanvasContext();
    const secondCtx = createWaveformCanvasContext();
    const canvas = createMockCanvas("event-media-instance-canvas", 300, 120);

    firstHandler(
      firstCtx,
      canvas,
      config,
      first.context.state,
      0,
      0,
      0,
      0,
      120,
      4,
      32
    );
    secondHandler(
      secondCtx,
      canvas,
      config,
      second.context.state,
      0,
      0,
      0,
      0,
      120,
      4,
      32
    );

    expect(bitmaps).toHaveLength(2);
    expect(firstCtx.drawImage).toHaveBeenLastCalledWith(
      bitmaps[0],
      0,
      4,
      120,
      32
    );
    expect(secondCtx.drawImage).toHaveBeenLastCalledWith(
      bitmaps[1],
      0,
      4,
      120,
      32
    );

    await firstPlugin.deactivate?.(first.context);
    expect(bitmaps[0].close).toHaveBeenCalledOnce();
    expect(bitmaps[1].close).not.toHaveBeenCalled();

    secondHandler(
      secondCtx,
      canvas,
      config,
      second.context.state,
      0,
      0,
      0,
      0,
      120,
      4,
      32
    );
    expect(bitmaps).toHaveLength(2);
    expect(secondCtx.drawImage).toHaveBeenLastCalledWith(
      bitmaps[1],
      0,
      4,
      120,
      32
    );

    await secondPlugin.deactivate?.(second.context);
    expect(bitmaps[1].close).toHaveBeenCalledOnce();
  });

  it("replaces stale waveform bitmaps when size or data changes", async () => {
    const { bitmaps } = installWaveformMocks();
    const config = createConfig();
    const { context, store } = createContext(config);
    const plugin = EventMediaPlugin();
    await plugin.activate?.(context);
    setSingleMediaEvent(context, {
      waveform: { data: [0.1, 0.2, 0.3] },
    });

    const handler = store.get("eventMediaHandler") as PluginEventHandler;
    const ctx = createWaveformCanvasContext();
    const canvas = createMockCanvas("event-media-stale-canvas", 300, 120);

    handler(ctx, canvas, config, context.state, 0, 0, 0, 0, 120, 4, 32);
    handler(ctx, canvas, config, context.state, 0, 0, 0, 0, 140, 4, 32);
    expect(bitmaps).toHaveLength(2);
    expect(bitmaps[0].close).toHaveBeenCalledOnce();

    context.state.tracks[0].events[0].media!.waveform!.data = [0.8, 0.7, 0.6];
    handler(ctx, canvas, config, context.state, 0, 0, 0, 0, 140, 4, 32);

    expect(bitmaps).toHaveLength(3);
    expect(bitmaps[1].close).toHaveBeenCalledOnce();
    expect(
      (
        store.get("eventMediaWaveformBitmapCache") as {
          getStats(): { size: number };
        }
      ).getStats().size
    ).toBe(1);

    await plugin.deactivate?.(context);
    expect(bitmaps[2].close).toHaveBeenCalledOnce();
  });

  it("rerenders waveform bitmaps at the active resolution without changing logical draw size", async () => {
    const { bitmaps, contexts } = installWaveformMocks();
    const config = createConfig();
    const { context, store } = createContext(config);
    const plugin = EventMediaPlugin();
    await plugin.activate?.(context);
    setSingleMediaEvent(context, {
      waveform: { data: [0.1, 0.2, 0.3] },
    });

    const handler = store.get("eventMediaHandler") as PluginEventHandler;
    const ctx = createWaveformCanvasContext(2);
    const getTransform = ctx.getTransform as ReturnType<typeof vi.fn>;
    const canvas = createMockCanvas("event-media-resolution-canvas", 300, 120);

    handler(ctx, canvas, config, context.state, 0, 0, 8, 10, 120, 4, 32);

    expect(bitmaps[0]).toMatchObject({ width: 240, height: 64 });
    expect(contexts[0].scale).toHaveBeenCalledWith(2, 2);
    expect(contexts[0].lineWidth).toBe(1);
    expect(ctx.drawImage).toHaveBeenLastCalledWith(bitmaps[0], 8, 14, 120, 32);

    getTransform.mockReturnValue(createScaleTransform(1));
    handler(ctx, canvas, config, context.state, 0, 0, 8, 10, 120, 4, 32);

    expect(bitmaps).toHaveLength(2);
    expect(bitmaps[0].close).toHaveBeenCalledOnce();
    expect(bitmaps[1]).toMatchObject({ width: 120, height: 32 });
    expect(contexts[1].scale).toHaveBeenCalledWith(1, 1);
    expect(contexts[1].lineWidth).toBe(1);
    expect(ctx.drawImage).toHaveBeenLastCalledWith(bitmaps[1], 8, 14, 120, 32);

    await plugin.deactivate?.(context);
  });

  it("marks tracks dirty and redraws after an image decode succeeds", async () => {
    const bitmap = createMockImageBitmap();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ({ blob: async () => new Blob(["image"]) }) as Response
      )
    );
    vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap));

    const config = createConfig();
    const { context, store } = createContext(config);
    const plugin = EventMediaPlugin();
    await plugin.activate?.(context);
    setSingleMediaEvent(context, {
      images: [{ src: "/event.png" }],
    });

    const handler = store.get("eventMediaHandler") as PluginEventHandler;
    const ctx = createMockCanvasContext();
    const canvas = createMockCanvas("event-media-image-canvas", 300, 120);
    handler(ctx, canvas, config, context.state, 0, 0, 0, 0, 120, 4, 32);

    const pending = Array.from(
      (
        store.get("eventMediaImageLoading") as Map<
          string,
          Promise<ImageBitmap | undefined>
        >
      ).values()
    )[0];
    await pending;

    expect(context.timeline.markDirty).toHaveBeenCalledWith(["tracks"]);
    expect(context.timeline.draw).toHaveBeenCalledOnce();
    expect(
      (store.get("eventMediaImageCache") as Map<string, ImageBitmap>).size
    ).toBe(1);
  });

  it("aborts and discards an image decode that finishes after deactivation", async () => {
    const bitmap = createMockImageBitmap();
    const decoded = createDeferred<ImageBitmap>();
    let fetchSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        fetchSignal = init?.signal ?? undefined;
        return { blob: async () => new Blob(["image"]) } as Response;
      })
    );
    const createImageBitmapMock = vi.fn(() => decoded.promise);
    vi.stubGlobal("createImageBitmap", createImageBitmapMock);

    const config = createConfig();
    const { context, store } = createContext(config);
    const plugin = EventMediaPlugin();
    await plugin.activate?.(context);
    setSingleMediaEvent(context, {
      images: [{ src: "/slow-event.png" }],
    });

    const handler = store.get("eventMediaHandler") as PluginEventHandler;
    const ctx = createMockCanvasContext();
    const canvas = createMockCanvas("event-media-pending-canvas", 300, 120);
    handler(ctx, canvas, config, context.state, 0, 0, 0, 0, 120, 4, 32);
    await vi.waitFor(() => expect(createImageBitmapMock).toHaveBeenCalledOnce());
    const pending = Array.from(
      (
        store.get("eventMediaImageLoading") as Map<
          string,
          Promise<ImageBitmap | undefined>
        >
      ).values()
    )[0];

    await plugin.deactivate?.(context);
    expect(fetchSignal?.aborted).toBe(true);

    decoded.resolve(bitmap);
    await pending;

    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(
      (store.get("eventMediaImageCache") as Map<string, ImageBitmap>).size
    ).toBe(0);
    expect(context.timeline.markDirty).not.toHaveBeenCalled();
    expect(context.timeline.draw).not.toHaveBeenCalled();
  });

  it("closes decoded image bitmaps on deactivation", async () => {
    const bitmap = createMockImageBitmap();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ({ blob: async () => new Blob(["image"]) }) as Response
      )
    );
    vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap));

    const config = createConfig();
    const { context, store } = createContext(config);
    const plugin = EventMediaPlugin();
    await plugin.activate?.(context);
    setSingleMediaEvent(context, {
      images: [{ src: "/cached-event.png" }],
    });

    const handler = store.get("eventMediaHandler") as PluginEventHandler;
    handler(
      createMockCanvasContext(),
      createMockCanvas("event-media-disposal-canvas", 300, 120),
      config,
      context.state,
      0,
      0,
      0,
      0,
      120,
      4,
      32
    );
    await Array.from(
      (
        store.get("eventMediaImageLoading") as Map<
          string,
          Promise<ImageBitmap | undefined>
        >
      ).values()
    )[0];

    await plugin.deactivate?.(context);

    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(
      (store.get("eventMediaImageCache") as Map<string, ImageBitmap>).size
    ).toBe(0);
  });

  it("为不同事件对象生成独立波形缓存键，避免串用波纹图案", async () => {
    const Path2DMock = class {
      moveTo(): void {}
      lineTo(): void {}
    };
    vi.stubGlobal("Path2D", Path2DMock);

    const config = createConfig();
    const { context, store } = createContext(config);
    const plugin = EventMediaPlugin();
    await plugin.activate?.(context);

    const state = context.state;
    state.tracks = [
      {
        id: 0,
        events: [
          createEvent({
            id: 0,
            media: {
              waveform: {
                data: [0.1, 0.2, 0.3],
              },
            },
          }),
        ],
      },
      {
        id: 1,
        events: [
          createEvent({
            id: 0,
            media: {
              waveform: {
                data: [0.9, 0.8, 0.7],
              },
            },
          }),
        ],
      },
    ];

    const handler = store.get("eventMediaHandler") as PluginEventHandler;
    const waveCache = store.get("eventMediaWaveCache") as Map<
      string,
      Float32Array
    >;
    const ctx = createWaveformCanvasContext();
    const canvas = createMockCanvas("event-media-canvas", 300, 120);

    handler(ctx, canvas, config, state, 0, 0, 0, 0, 120, 4, 32);
    handler(ctx, canvas, config, state, 1, 0, 0, 40, 120, 4, 32);

    expect(waveCache.size).toBe(2);
    expect(Array.from(waveCache.values())).toEqual([
      new Float32Array([0.1, 0.2, 0.3]),
      new Float32Array([0.9, 0.8, 0.7]),
    ]);
  });

  it("在媒体绘制出错时仍然恢复 canvas 状态，避免污染后续事件颜色", async () => {
    const Path2DMock = class {
      moveTo(): void {}
      lineTo(): void {}
    };
    vi.stubGlobal("Path2D", Path2DMock);

    const config = createConfig();
    const { context, store } = createContext(config);
    const plugin = EventMediaPlugin();
    await plugin.activate?.(context);

    context.state.tracks = [
      {
        id: 0,
        events: [
          createEvent({
            media: {
              waveform: {
                data: [0.1, 0.2, 0.3],
              },
            },
          }),
        ],
      },
    ];

    const handler = store.get("eventMediaHandler") as PluginEventHandler;
    const ctx = createWaveformCanvasContext();
    const canvas = createMockCanvas("event-media-error-canvas", 300, 120);
    const restoreSpy = ctx.restore as unknown as ReturnType<typeof vi.fn>;
    ctx.stroke = vi.fn(() => {
      throw new Error("stroke failed");
    }) as unknown as CanvasRenderingContext2D["stroke"];

    expect(() =>
      handler(ctx, canvas, config, context.state, 0, 0, 0, 0, 120, 4, 32)
    ).toThrow("stroke failed");
    expect(restoreSpy).toHaveBeenCalled();
  });
});
