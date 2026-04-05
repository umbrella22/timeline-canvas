import { describe, expect, it, vi } from "vitest";

import { StateManager } from "../src/core/managers/StateManager";
import { EventsRenderer } from "../src/renderers/layers/EventsRenderer";
import { InteractionRenderer } from "../src/renderers/layers/InteractionRenderer";
import type { TimelineConfig } from "../src/types";
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

describe("EventsRenderer", () => {
  it("默认使用可配置的时长前缀", () => {
    const renderer = new EventsRenderer();
    const config = createConfig({
      eventDurationPrefix: "时长",
      startPaddingTime: 0,
      secondWidth: 10,
      trackHeight: 40,
      timelineHeight: 20,
      firstTrackTopMargin: 0,
      showEventDurationLabel: true,
    });
    const state = new StateManager(config).state;
    const canvas = createMockCanvas("renderer-canvas", 300, 120);
    const ctx = createMockCanvasContext();
    const fillText = ctx.fillText as unknown as ReturnType<typeof vi.fn>;

    state.tracks = [
      {
        id: 0,
        events: [
          {
            id: 1,
            startTime: 10,
            endTime: 20,
            duration: 10,
            title: "事件",
            description: "",
            color: "#fff",
          },
        ],
      },
    ];
    state.selectedEvent = { trackIndex: 0, eventIndex: 0 };

    renderer.renderEvents(ctx, config, state, 0, 20, canvas, undefined, 300);

    const drawnTexts = fillText.mock.calls.map((call) => call[0]);
    expect(drawnTexts).toContain("时长 00:00:10");
  });

  it("优先使用 formatEventDuration 自定义格式化", () => {
    const renderer = new EventsRenderer();
    const config = createConfig({
      eventDurationPrefix: "时长",
      formatEventDuration: (duration: number) => `长度 ${duration} 秒`,
      startPaddingTime: 0,
      secondWidth: 10,
      trackHeight: 40,
      timelineHeight: 20,
      firstTrackTopMargin: 0,
      showEventDurationLabel: true,
    });
    const state = new StateManager(config).state;
    const canvas = createMockCanvas("renderer-canvas-2", 300, 120);
    const ctx = createMockCanvasContext();
    const fillText = ctx.fillText as unknown as ReturnType<typeof vi.fn>;

    state.tracks = [
      {
        id: 0,
        events: [
          {
            id: 1,
            startTime: 10,
            endTime: 20,
            duration: 10,
            title: "事件",
            description: "",
            color: "#fff",
          },
        ],
      },
    ];
    state.selectedEvent = { trackIndex: 0, eventIndex: 0 };

    renderer.renderEvents(ctx, config, state, 0, 20, canvas, undefined, 300);

    const drawnTexts = fillText.mock.calls.map((call) => call[0]);
    expect(drawnTexts).toContain("长度 10 秒");
  });

  it("在媒体绘制后保留描边高亮且不再铺整块白色遮罩", () => {
    const renderer = new EventsRenderer();
    const config = createConfig({
      startPaddingTime: 0,
      secondWidth: 10,
      trackHeight: 40,
      timelineHeight: 20,
      firstTrackTopMargin: 0,
      eventBlockStyle: {
        ...DEFAULT_EVENT_BLOCK_STYLE,
        borderRadius: 0,
      },
      colors: {
        ...DEFAULT_COLORS,
        eventBorderSelected: "#123456",
        eventOverlay: "rgba(255, 255, 255, 0.2)",
      },
    });
    const state = new StateManager(config).state;
    const canvas = createMockCanvas("renderer-canvas-3", 300, 120);
    const ctx = createMockCanvasContext();
    const operations: string[] = [];

    const originalStrokeRect = ctx.strokeRect;
    const originalFillRect = ctx.fillRect;
    ctx.strokeRect = vi.fn((...args: Parameters<CanvasRenderingContext2D["strokeRect"]>) => {
      operations.push(`stroke:${ctx.strokeStyle}`);
      return originalStrokeRect(...args);
    }) as CanvasRenderingContext2D["strokeRect"];
    ctx.fillRect = vi.fn((...args: Parameters<CanvasRenderingContext2D["fillRect"]>) => {
      operations.push(`fill:${ctx.fillStyle}`);
      return originalFillRect(...args);
    }) as CanvasRenderingContext2D["fillRect"];

    state.tracks = [
      {
        id: 0,
        events: [
          {
            id: 1,
            startTime: 10,
            endTime: 20,
            duration: 10,
            title: "事件",
            description: "",
            color: "#ff0000",
          },
        ],
      },
    ];
    state.selectedEvent = { trackIndex: 0, eventIndex: 0 };

    const pluginManager = {
      emitEvent: vi.fn(() => {
        operations.push("media");
      }),
    };

    renderer.renderEvents(
      ctx,
      config,
      state,
      0,
      20,
      canvas,
      pluginManager as never,
      300
    );

    const mediaIndex = operations.indexOf("media");
    const strokeIndex = operations.findIndex((item) =>
      item.startsWith("stroke:#123456")
    );
    expect(mediaIndex).toBeGreaterThan(-1);
    expect(strokeIndex).toBeGreaterThan(mediaIndex);
    expect(
      operations.some((item) => item.includes("rgba(255, 255, 255, 0.2)"))
    ).toBe(false);
  });

  it("拖拽中的事件仅保留描边高亮而不再填充白色遮罩", () => {
    const renderer = new InteractionRenderer();
    const config = createConfig({
      startPaddingTime: 0,
      secondWidth: 10,
      trackHeight: 40,
      timelineHeight: 20,
      firstTrackTopMargin: 0,
      eventBlockStyle: {
        ...DEFAULT_EVENT_BLOCK_STYLE,
        borderRadius: 0,
      },
      colors: {
        ...DEFAULT_COLORS,
        eventBorderSelected: "#123456",
        eventOverlay: "rgba(255, 255, 255, 0.2)",
      },
    });
    const state = new StateManager(config).state;
    const ctx = createMockCanvasContext();
    const operations: string[] = [];

    const originalStrokeRect = ctx.strokeRect;
    const originalFillRect = ctx.fillRect;
    ctx.strokeRect = vi.fn(
      (...args: Parameters<CanvasRenderingContext2D["strokeRect"]>) => {
        operations.push(`stroke:${ctx.strokeStyle}`);
        return originalStrokeRect(...args);
      }
    ) as CanvasRenderingContext2D["strokeRect"];
    ctx.fillRect = vi.fn(
      (...args: Parameters<CanvasRenderingContext2D["fillRect"]>) => {
        operations.push(`fill:${ctx.fillStyle}`);
        return originalFillRect(...args);
      }
    ) as CanvasRenderingContext2D["fillRect"];

    state.tracks = [
      {
        id: 0,
        events: [
          {
            id: 1,
            startTime: 10,
            endTime: 20,
            duration: 10,
            title: "拖拽事件",
            description: "",
            color: "#ff0000",
          },
        ],
      },
    ];
    state.draggingEvent = {
      trackIndex: 0,
      eventIndex: 0,
      eventX: 100,
      eventY: 20,
      originalTrackIndex: 0,
      originalEventIndex: 0,
      originalStartTime: 10,
      startX: 110,
      startY: 40,
      currentMouseX: 120,
      currentMouseY: 40,
      isDragging: true,
      canMove: true,
    };

    renderer.render({
      ctx,
      canvas: createMockCanvas("interaction-canvas", 300, 120),
      config,
      state,
      layerTimes: {},
    });

    expect(operations.some((item) => item.startsWith("stroke:#123456"))).toBe(
      true
    );
    expect(
      operations.some((item) => item.includes("rgba(255, 255, 255, 0.2)"))
    ).toBe(false);
  });
});
