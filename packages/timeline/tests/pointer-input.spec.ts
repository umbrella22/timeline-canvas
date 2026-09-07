import { describe, expect, it, vi } from "vite-plus/test";

import {
  CanvasController,
  type CanvasEventListeners,
} from "../src/core/managers/CanvasController";
import { createMockCanvas } from "./helpers";

function createPointerEvent(
  type: string,
  pointerId: number,
  pointerType: string,
  isPrimary = true
): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: 40,
    clientY: 30,
  });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
    isPrimary: { value: isPrimary },
  });
  return event as PointerEvent;
}

function createListeners(): CanvasEventListeners {
  return {
    mousedown: vi.fn(),
    mousemove: vi.fn(),
    mouseup: vi.fn(),
    mouseleave: vi.fn(),
    pointerdown: vi.fn(),
    pointermove: vi.fn(),
    pointerup: vi.fn(),
    pointercancel: vi.fn(),
    lostpointercapture: vi.fn(),
    contextmenu: vi.fn(),
    wheel: vi.fn(),
  };
}

function createController() {
  const canvas = createMockCanvas("pointer-input", 240, 160);
  let capturedPointerId: number | null = null;
  const setPointerCapture = vi.fn((pointerId: number) => {
    capturedPointerId = pointerId;
  });
  const releasePointerCapture = vi.fn((pointerId: number) => {
    if (capturedPointerId === pointerId) {
      capturedPointerId = null;
    }
  });
  const hasPointerCapture = vi.fn(
    (pointerId: number) => capturedPointerId === pointerId
  );
  Object.defineProperties(canvas, {
    setPointerCapture: { configurable: true, value: setPointerCapture },
    releasePointerCapture: {
      configurable: true,
      value: releasePointerCapture,
    },
    hasPointerCapture: { configurable: true, value: hasPointerCapture },
  });

  const controller = new CanvasController({
    canvas,
    config: { canvasHeight: 160 },
    state: { scrollY: 0 },
    renderManager: {
      setCanvasSize: vi.fn(),
      getCanvasLogicalWidth: () => 240,
      getCanvasLogicalHeight: () => 160,
      getCachedLogicalHeight: () => 160,
      computeMaxScrollY: () => 0,
    },
    onCanvasResize: vi.fn(),
  });

  return {
    canvas,
    controller,
    setPointerCapture,
    releasePointerCapture,
  };
}

describe("touch pointer input", () => {
  it("捕获主触摸指针并在抬起后释放", () => {
    const { canvas, controller, setPointerCapture, releasePointerCapture } =
      createController();
    const listeners = createListeners();
    canvas.style.touchAction = "pan-y";
    controller.setupEventListeners(listeners);

    const pointerdown = createPointerEvent("pointerdown", 7, "touch");
    const pointermove = createPointerEvent("pointermove", 7, "touch");
    const pointerup = createPointerEvent("pointerup", 7, "touch");
    canvas.dispatchEvent(pointerdown);
    canvas.dispatchEvent(pointermove);
    canvas.dispatchEvent(pointerup);

    expect(pointerdown.defaultPrevented).toBe(true);
    expect(canvas.style.touchAction).toBe("none");
    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(listeners.pointerdown).toHaveBeenCalledWith(pointerdown);
    expect(listeners.pointermove).toHaveBeenCalledWith(pointermove);
    expect(listeners.pointerup).toHaveBeenCalledWith(pointerup);
    expect(releasePointerCapture).toHaveBeenCalledWith(7);

    controller.destroy();
    expect(canvas.style.touchAction).toBe("pan-y");
  });

  it("忽略次要触摸与 mouse pointer，桌面 MouseEvent 只处理一次", () => {
    const { canvas, controller, setPointerCapture } = createController();
    const listeners = createListeners();
    controller.setupEventListeners(listeners);

    canvas.dispatchEvent(createPointerEvent("pointerdown", 1, "touch", false));
    canvas.dispatchEvent(createPointerEvent("pointerdown", 2, "mouse"));
    const mousedown = new MouseEvent("mousedown", { bubbles: true });
    canvas.dispatchEvent(mousedown);

    expect(listeners.pointerdown).not.toHaveBeenCalled();
    expect(setPointerCapture).not.toHaveBeenCalled();
    expect(listeners.mousedown).toHaveBeenCalledTimes(1);
    expect(listeners.mousedown).toHaveBeenCalledWith(mousedown);
  });

  it("pointercancel 与意外丢失 capture 各自只清理一次", () => {
    const { canvas, controller } = createController();
    const listeners = createListeners();
    controller.setupEventListeners(listeners);

    canvas.dispatchEvent(createPointerEvent("pointerdown", 3, "touch"));
    const pointercancel = createPointerEvent("pointercancel", 3, "touch");
    canvas.dispatchEvent(pointercancel);
    canvas.dispatchEvent(createPointerEvent("lostpointercapture", 3, "touch"));

    expect(listeners.pointercancel).toHaveBeenCalledTimes(1);
    expect(listeners.lostpointercapture).not.toHaveBeenCalled();

    canvas.dispatchEvent(createPointerEvent("pointerdown", 4, "touch"));
    const lostCapture = createPointerEvent(
      "lostpointercapture",
      4,
      "touch"
    );
    canvas.dispatchEvent(lostCapture);
    canvas.dispatchEvent(createPointerEvent("pointermove", 4, "touch"));

    expect(listeners.lostpointercapture).toHaveBeenCalledTimes(1);
    expect(listeners.lostpointercapture).toHaveBeenCalledWith(lostCapture);
    expect(listeners.pointermove).not.toHaveBeenCalled();
  });
});
