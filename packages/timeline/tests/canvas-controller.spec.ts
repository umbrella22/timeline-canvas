import { describe, expect, it, vi } from "vitest";

import {
  CanvasController,
  type CanvasControllerOptions,
  type CanvasEventListeners,
} from "../src/core/managers/CanvasController";
import { StateManager } from "../src/core/managers/StateManager";
import type { TimelineConfig } from "../src/types";
import {
  DEFAULT_COLORS,
  DEFAULT_CONFIG,
  DEFAULT_CONTEXT_MENU_ITEMS,
  DEFAULT_CONTEXT_MENU_STYLE,
  DEFAULT_EVENT_BLOCK_STYLE,
  DEFAULT_EVENT_TEXT_STYLE,
} from "../src/utils";
import { createMockCanvas } from "./helpers";

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
  options: {
    canvas?: HTMLCanvasElement;
    config?: Partial<TimelineConfig>;
    maxScrollY?: number;
  } = {}
) {
  const config = createConfig(options.config);
  const state = new StateManager(config).state;
  const canvas =
    options.canvas ?? createMockCanvas("timelineCanvas", 240, 160);

  const renderManager: CanvasControllerOptions["renderManager"] = {
    setCanvasSize: vi.fn(),
    getCanvasLogicalWidth: vi.fn(() => 320),
    getCanvasLogicalHeight: vi.fn(() => 180),
    getCachedLogicalHeight: vi.fn(() => 170),
    computeMaxScrollY: vi.fn(() => options.maxScrollY ?? 120),
  };
  const onCanvasResize = vi.fn();

  return {
    config,
    state,
    canvas,
    renderManager,
    onCanvasResize,
    controller: new CanvasController({
      canvas,
      config,
      state,
      renderManager,
      onCanvasResize,
    }),
  };
}

function createListeners(): CanvasEventListeners {
  return {
    mousedown: vi.fn(),
    mousemove: vi.fn(),
    mouseup: vi.fn(),
    mouseleave: vi.fn(),
    contextmenu: vi.fn(),
    wheel: vi.fn(),
  };
}

describe("CanvasController", () => {
  it("注册 DOM 监听并按父容器尺寸初始化 canvas", () => {
    const { controller, canvas, renderManager } = createController();
    const listeners = createListeners();

    controller.setupEventListeners(listeners);

    canvas.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    canvas.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    canvas.dispatchEvent(new Event("mouseleave", { bubbles: true }));
    canvas.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));

    expect(listeners.mousedown).toHaveBeenCalledTimes(1);
    expect(listeners.mousemove).toHaveBeenCalledTimes(1);
    expect(listeners.mouseup).toHaveBeenCalledTimes(1);
    expect(listeners.mouseleave).toHaveBeenCalledTimes(1);
    expect(listeners.contextmenu).toHaveBeenCalledTimes(1);
    expect(listeners.wheel).toHaveBeenCalledTimes(1);
    expect(renderManager.setCanvasSize).toHaveBeenCalledWith(240, 160);
  });

  it("无父容器时回退到逻辑宽度与配置高度", () => {
    const canvas = document.createElement("canvas");
    const { controller, renderManager } = createController({
      canvas,
      config: { canvasHeight: 456 },
    });

    controller.setupEventListeners(createListeners());

    expect(renderManager.setCanvasSize).toHaveBeenCalledWith(320, 456);
  });

  it("destroy 后注销 canvas 监听", () => {
    const { controller, canvas } = createController();
    const listeners = createListeners();

    controller.setupEventListeners(listeners);
    controller.destroy();

    canvas.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    canvas.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    canvas.dispatchEvent(new Event("mouseleave", { bubbles: true }));
    canvas.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));

    expect(listeners.mousedown).not.toHaveBeenCalled();
    expect(listeners.mousemove).not.toHaveBeenCalled();
    expect(listeners.mouseup).not.toHaveBeenCalled();
    expect(listeners.mouseleave).not.toHaveBeenCalled();
    expect(listeners.contextmenu).not.toHaveBeenCalled();
    expect(listeners.wheel).not.toHaveBeenCalled();
  });

  it("adjustCanvasSize 会裁剪 scrollY 并触发 resize 回调", () => {
    const { controller, state, onCanvasResize } = createController({
      maxScrollY: 80,
    });
    state.scrollY = 300;

    controller.adjustCanvasSize();

    expect(state.scrollY).toBe(80);
    expect(onCanvasResize).toHaveBeenCalledTimes(1);
  });
});
