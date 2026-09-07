import { describe, expect, it, vi } from "vite-plus/test";

import {
  InteractionManager,
  type InteractionManagerOptions,
} from "../src/core/managers/InteractionManager";
import type { TimelineInteractionAPI } from "../src/handlers/TimelineInteractionAPI";
import type { CanvasEventListeners } from "../src/core/managers/CanvasController";

function createManager() {
  let listeners: CanvasEventListeners | null = null;
  const canvasController: InteractionManagerOptions["canvasController"] = {
    setupEventListeners: vi.fn((nextListeners: CanvasEventListeners) => {
      listeners = nextListeners;
    }),
    destroy: vi.fn(),
  };
  const mouseHandler: NonNullable<InteractionManagerOptions["mouseHandler"]> = {
    handleMouseDown: vi.fn(),
    handleMouseMove: vi.fn(),
    handleMouseUp: vi.fn(),
    handleCancel: vi.fn(),
    handleContextMenu: vi.fn(),
    destroy: vi.fn(),
  };
  const wheelHandler: NonNullable<InteractionManagerOptions["wheelHandler"]> = {
    handleWheel: vi.fn(),
  };
  const manager = new InteractionManager({
    timeline: {} as TimelineInteractionAPI,
    canvasController,
    mouseHandler,
    wheelHandler,
  });

  return {
    manager,
    canvasController,
    mouseHandler,
    wheelHandler,
    getListeners: () => listeners,
  };
}

describe("InteractionManager", () => {
  it("绑定后将 DOM 事件统一转发给交互 handlers", () => {
    const { manager, canvasController, mouseHandler, wheelHandler, getListeners } =
      createManager();
    const mousedown = new MouseEvent("mousedown");
    const mousemove = new MouseEvent("mousemove");
    const mouseup = new MouseEvent("mouseup");
    const mouseleave = new MouseEvent("mouseleave");
    const pointerdown = new MouseEvent("pointerdown") as PointerEvent;
    const pointermove = new MouseEvent("pointermove") as PointerEvent;
    const pointerup = new MouseEvent("pointerup") as PointerEvent;
    const pointercancel = new MouseEvent("pointercancel") as PointerEvent;
    const lostpointercapture = new MouseEvent(
      "lostpointercapture"
    ) as PointerEvent;
    const contextmenu = new MouseEvent("contextmenu");
    const wheel = new WheelEvent("wheel");

    manager.bind();

    const listeners = getListeners();
    expect(canvasController.setupEventListeners).toHaveBeenCalledTimes(1);
    expect(listeners).not.toBeNull();

    listeners?.mousedown(mousedown);
    listeners?.mousemove(mousemove);
    listeners?.mouseup(mouseup);
    listeners?.mouseleave(mouseleave);
    listeners?.pointerdown(pointerdown);
    listeners?.pointermove(pointermove);
    listeners?.pointerup(pointerup);
    listeners?.pointercancel(pointercancel);
    listeners?.lostpointercapture(lostpointercapture);
    listeners?.contextmenu(contextmenu);
    listeners?.wheel(wheel);

    expect(mouseHandler.handleMouseDown).toHaveBeenCalledWith(mousedown);
    expect(mouseHandler.handleMouseMove).toHaveBeenCalledWith(mousemove);
    expect(mouseHandler.handleMouseUp).toHaveBeenNthCalledWith(1, mouseup);
    expect(mouseHandler.handleMouseUp).toHaveBeenNthCalledWith(2, mouseleave);
    expect(mouseHandler.handleMouseDown).toHaveBeenNthCalledWith(2, pointerdown);
    expect(mouseHandler.handleMouseMove).toHaveBeenNthCalledWith(2, pointermove);
    expect(mouseHandler.handleMouseUp).toHaveBeenNthCalledWith(3, pointerup);
    expect(mouseHandler.handleCancel).toHaveBeenNthCalledWith(1, pointercancel);
    expect(mouseHandler.handleCancel).toHaveBeenNthCalledWith(
      2,
      lostpointercapture
    );
    expect(mouseHandler.handleContextMenu).toHaveBeenCalledWith(contextmenu);
    expect(wheelHandler.handleWheel).toHaveBeenCalledWith(wheel);
  });

  it("销毁时统一释放 canvas 监听和鼠标 handler 资源", () => {
    const { manager, canvasController, mouseHandler } = createManager();

    manager.destroy();

    expect(canvasController.destroy).toHaveBeenCalledTimes(1);
    expect(mouseHandler.destroy).toHaveBeenCalledTimes(1);
  });
});
