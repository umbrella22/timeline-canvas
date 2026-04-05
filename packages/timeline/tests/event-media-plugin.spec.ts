import { describe, expect, it, vi } from "vitest";

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
      timeline: {} as Timeline,
      config,
      state,
      api,
    },
    store,
  };
}

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
    const ctx = createMockCanvasContext();
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
    const ctx = createMockCanvasContext();
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
