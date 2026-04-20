import { describe, expect, it, vi } from "vitest";

import { StateManager } from "../src/core/managers/StateManager";
import {
  ViewportController,
  type ViewportControllerOptions,
} from "../src/core/managers/ViewportController";
import type { TimelineConfig, TimelineEvent } from "../src/types";
import {
  DEFAULT_COLORS,
  DEFAULT_CONFIG,
  DEFAULT_CONTEXT_MENU_ITEMS,
  DEFAULT_CONTEXT_MENU_STYLE,
  DEFAULT_EVENT_BLOCK_STYLE,
  DEFAULT_EVENT_TEXT_STYLE,
} from "../src/utils";

function createConfig(
  overrides: Partial<TimelineConfig> = {}
): TimelineConfig {
  return {
    ...DEFAULT_CONFIG,
    colors: DEFAULT_COLORS,
    eventTextStyle: DEFAULT_EVENT_TEXT_STYLE,
    eventBlockStyle: DEFAULT_EVENT_BLOCK_STYLE,
    contextMenuItems: DEFAULT_CONTEXT_MENU_ITEMS,
    contextMenuStyle: DEFAULT_CONTEXT_MENU_STYLE,
    ...overrides,
  };
}

function createEvent(id: number, endTime: number): TimelineEvent {
  return {
    id,
    startTime: 0,
    endTime,
    duration: endTime,
    title: `事件 ${id}`,
    description: "",
    color: "#fff",
  };
}

function createController(
  overrides: {
    config?: Partial<TimelineConfig>;
    cachedLogicalWidth?: number;
    canvasLogicalWidth?: number;
    zoomLevel?: number;
    scrollX?: number;
  } = {}
) {
  const config = createConfig(overrides.config);
  const state = new StateManager(config).state;
  state.zoomLevel = overrides.zoomLevel ?? state.zoomLevel;
  state.scrollX = overrides.scrollX ?? state.scrollX;

  const cachedLogicalWidth = overrides.cachedLogicalWidth ?? 200;
  const canvasLogicalWidth = overrides.canvasLogicalWidth ?? cachedLogicalWidth;

  const renderManager: ViewportControllerOptions["renderManager"] = {
    getCanvasLogicalWidth: vi.fn(() => canvasLogicalWidth),
    getCachedLogicalWidth: vi.fn(() => cachedLogicalWidth),
    getContentWidth: vi.fn((zoomLevel: number) => {
      const timeRangeSeconds =
        config.endTime + config.endPaddingTime - config.startTime;
      return (
        config.startPaddingTime + timeRangeSeconds * config.secondWidth * zoomLevel
      );
    }),
    computeMaxScrollX: vi.fn((zoomLevel: number) => {
      const timeRangeSeconds =
        config.endTime + config.endPaddingTime - config.startTime;
      const contentWidth =
        config.startPaddingTime + timeRangeSeconds * config.secondWidth * zoomLevel;
      return Math.max(0, contentWidth - cachedLogicalWidth);
    }),
    invalidateLayoutCache: vi.fn(),
    markDirty: vi.fn(),
  };

  return {
    config,
    state,
    renderManager,
    controller: new ViewportController({
      config,
      state,
      renderManager,
    }),
  };
}

describe("ViewportController", () => {
  it("缩放时保持画布中心对应时间不变", () => {
    const { controller, state } = createController({
      scrollX: 100,
      zoomLevel: 1,
    });

    const result = controller.zoomByFactor(2);

    expect(result).toEqual({
      changed: true,
      zoomLevel: 2,
      percentage: 200,
    });
    expect(state.scrollX).toBe(300);
  });

  it("设置结束时间时会裁剪时间指示器与水平滚动，并报告溢出事件", () => {
    const { controller, state, renderManager } = createController({
      config: {
        startTime: 0,
        endTime: 100,
        startPaddingTime: 0,
        secondWidth: 10,
      },
      scrollX: 900,
      zoomLevel: 1,
    });

    state.timeIndicatorPosition = 90;
    state.tracks = [
      {
        id: 0,
        events: [createEvent(0, 80)],
      },
    ];

    const result = controller.setEndTime(50);

    expect(result).toEqual({
      oldEndTime: 100,
      endTime: 50,
      hasOverflowEvents: true,
    });
    expect(state.timeIndicatorPosition).toBe(50);
    expect(state.scrollX).toBe(300);
    expect(renderManager.invalidateLayoutCache).toHaveBeenCalledTimes(1);
  });

  it("auto-fit 成功命中可视宽度时更新 zoom", () => {
    const { controller, state } = createController({
      config: {
        startTime: 0,
        endTime: 10,
        startPaddingTime: 0,
        secondWidth: 10,
        minAutoFitZoom: 1,
        maxAutoFitZoom: 3,
      },
    });

    expect(controller.autoFitToCanvas()).toEqual({
      type: "fit",
      percentage: 200,
    });
    expect(state.zoomLevel).toBe(2);
  });

  it("auto-fit 在补充 endPaddingTime 时失效布局缓存", () => {
    const { controller, config, state, renderManager } = createController({
      config: {
        startTime: 0,
        endTime: 10,
        startPaddingTime: 0,
        secondWidth: 10,
        minAutoFitZoom: 1,
        maxAutoFitZoom: 1.5,
        endPaddingTime: 0,
      },
    });

    expect(controller.autoFitToCanvas()).toEqual({
      type: "cappedWithPadding",
      percentage: 150,
      seconds: 4,
    });
    expect(state.zoomLevel).toBe(1.5);
    expect(config.endPaddingTime).toBe(4);
    expect(renderManager.invalidateLayoutCache).toHaveBeenCalledTimes(1);
  });

  it("auto-fit 无法继续补白时保持 cappedContentShort 并标记脏层", () => {
    const { controller, state, renderManager } = createController({
      config: {
        startTime: 0,
        endTime: 10,
        startPaddingTime: 0,
        secondWidth: 10,
        minAutoFitZoom: 1,
        maxAutoFitZoom: 1.5,
        endPaddingTime: 1,
      },
    });

    expect(controller.autoFitToCanvas()).toEqual({
      type: "cappedContentShort",
      percentage: 150,
    });
    expect(state.zoomLevel).toBe(1.5);
    expect(renderManager.markDirty).toHaveBeenCalledTimes(1);
  });
});
