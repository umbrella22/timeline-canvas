import { afterEach, describe, expect, it, vi } from "vitest";

import { StateManager } from "../src/core/managers/StateManager";
import { TimeIndicatorController } from "../src/core/managers/TimeIndicatorController";
import type { TimelineConfig } from "../src/types";
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

function createController(
  overrides: {
    config?: Partial<TimelineConfig>;
    canvasWidth?: number;
    maxScrollX?: number;
    zoomLevel?: number;
    scrollX?: number;
    snapEnabled?: boolean;
  } = {}
) {
  const config = createConfig(overrides.config);
  const state = new StateManager(config).state;
  state.zoomLevel = overrides.zoomLevel ?? state.zoomLevel;
  state.scrollX = overrides.scrollX ?? state.scrollX;
  state.snapEnabled = overrides.snapEnabled ?? state.snapEnabled;

  const renderManager = {
    getCanvasLogicalWidth: vi.fn(() => overrides.canvasWidth ?? 200),
    computeMaxScrollX: vi.fn(() => overrides.maxScrollX ?? 1000),
    markDirty: vi.fn(),
  };

  return {
    config,
    state,
    renderManager,
    controller: new TimeIndicatorController({
      config,
      state,
      renderManager,
    }),
  };
}

describe("TimeIndicatorController", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("设置位置时支持吸附、夹紧并在越界时滚动到可视区", () => {
    const { controller, state, renderManager } = createController({
      config: {
        startTime: 0,
        endTime: 100,
        startPaddingTime: 0,
        secondWidth: 10,
      },
      zoomLevel: 2,
      snapEnabled: true,
    });

    const result = controller.setPosition(25.2, true);

    expect(result).toEqual({
      changed: true,
      position: 30,
    });
    expect(state.timeIndicatorPosition).toBe(30);
    expect(state.scrollX).toBe(450);
    expect(renderManager.computeMaxScrollX).toHaveBeenCalledWith(2);
    expect(renderManager.markDirty).toHaveBeenCalledTimes(1);
  });

  it("位置未变化时跳过滚动和脏层标记", () => {
    const { controller, renderManager } = createController();

    const result = controller.setPosition(0, false);

    expect(result).toEqual({
      changed: false,
      position: 0,
    });
    expect(renderManager.computeMaxScrollX).not.toHaveBeenCalled();
    expect(renderManager.markDirty).not.toHaveBeenCalled();
  });

  it("拖拽时使用自定义边缘滚动参数并遵守节流", () => {
    const { controller, state, renderManager } = createController({
      config: {
        startTime: 0,
        endTime: 100,
        startPaddingTime: 0,
        secondWidth: 10,
        edgeScrollThrottle: 10,
        edgeScrollTriggerMargin: 20,
        edgeScrollViewportMargin: 60,
      },
    });

    vi.spyOn(performance, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1005);

    controller.setPositionDuringDrag(25);
    controller.setPositionDuringDrag(30);

    expect(state.timeIndicatorPosition).toBe(30);
    expect(state.scrollX).toBe(110);
    expect(renderManager.markDirty).toHaveBeenCalledTimes(1);
  });

  it("异常边缘滚动参数会回退到默认值", () => {
    const { controller, state } = createController({
      config: {
        startTime: 0,
        endTime: 100,
        startPaddingTime: 0,
        secondWidth: 10,
        edgeScrollThrottle: Number.NaN,
        edgeScrollTriggerMargin: Number.NaN,
        edgeScrollViewportMargin: -10,
      },
    });

    vi.spyOn(performance, "now").mockReturnValue(1000);
    controller.setPositionDuringDrag(25);

    expect(state.scrollX).toBe(100);
  });
});
