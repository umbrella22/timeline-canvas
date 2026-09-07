import type { TimelineConfig, TimelineState } from "../../types";
import type { RenderManager } from "./RenderManager";

export interface CanvasEventListeners {
  mousedown: (event: MouseEvent) => void;
  mousemove: (event: MouseEvent) => void;
  mouseup: (event: MouseEvent) => void;
  mouseleave: (event: MouseEvent) => void;
  pointerdown: (event: PointerEvent) => void;
  pointermove: (event: PointerEvent) => void;
  pointerup: (event: PointerEvent) => void;
  pointercancel: (event: PointerEvent) => void;
  lostpointercapture: (event: PointerEvent) => void;
  contextmenu: (event: MouseEvent) => void;
  wheel: (event: WheelEvent) => void;
}

type CanvasRenderManager = Pick<
  RenderManager,
  | "setCanvasSize"
  | "getCanvasLogicalWidth"
  | "getCanvasLogicalHeight"
  | "getCachedLogicalHeight"
  | "computeMaxScrollY"
>;

export interface CanvasControllerOptions {
  canvas: HTMLCanvasElement;
  config: Pick<TimelineConfig, "canvasHeight">;
  state: Pick<TimelineState, "scrollY">;
  renderManager: CanvasRenderManager;
  onCanvasResize: () => void;
}

export class CanvasController {
  private readonly canvas: HTMLCanvasElement;
  private readonly config: Pick<TimelineConfig, "canvasHeight">;
  private readonly state: Pick<TimelineState, "scrollY">;
  private readonly renderManager: CanvasRenderManager;
  private readonly onCanvasResize: () => void;
  private eventListeners: CanvasEventListeners | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private activePointerId: number | null = null;
  private previousTouchAction: string | null = null;
  private pixelRatio = window.devicePixelRatio || 1;
  private resolutionQuery: MediaQueryList | null = null;

  constructor(options: CanvasControllerOptions) {
    this.canvas = options.canvas;
    this.config = options.config;
    this.state = options.state;
    this.renderManager = options.renderManager;
    this.onCanvasResize = options.onCanvasResize;
  }

  public setupEventListeners(listeners: CanvasEventListeners): void {
    if (this.eventListeners) {
      this.destroy();
    }

    this.eventListeners = listeners;
    this.canvas.addEventListener("mousedown", listeners.mousedown);
    this.canvas.addEventListener("mousemove", listeners.mousemove);
    this.canvas.addEventListener("mouseup", listeners.mouseup);
    this.canvas.addEventListener("mouseleave", listeners.mouseleave);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointercancel", this.handlePointerCancel);
    this.canvas.addEventListener(
      "lostpointercapture",
      this.handleLostPointerCapture
    );
    this.canvas.addEventListener("contextmenu", listeners.contextmenu);
    this.canvas.addEventListener("wheel", listeners.wheel, {
      passive: false,
    });

    this.previousTouchAction = this.canvas.style.touchAction;
    // Timeline gestures own touch movement while interactions are bound.
    this.canvas.style.touchAction = "none";
    this.syncCanvasSize(false);
    this.observeContainerResize();
    this.observePixelRatio();
    window.addEventListener("resize", this.handleWindowResize);
  }

  public setCanvasSize(width: number, height: number): void {
    this.renderManager.setCanvasSize(width, height);
    this.pixelRatio = window.devicePixelRatio || 1;
  }

  public getCanvasLogicalHeight(): number {
    return this.renderManager.getCanvasLogicalHeight();
  }

  public getCachedLogicalHeight(): number {
    return this.renderManager.getCachedLogicalHeight();
  }

  public adjustCanvasSize(): void {
    const maxScrollY = this.renderManager.computeMaxScrollY();
    this.state.scrollY = Math.max(0, Math.min(maxScrollY, this.state.scrollY));
    this.onCanvasResize();
  }

  public destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.resolutionQuery?.removeEventListener("change", this.handleResolutionChange);
    this.resolutionQuery = null;
    window.removeEventListener("resize", this.handleWindowResize);

    if (!this.eventListeners) {
      return;
    }

    this.canvas.removeEventListener("mousedown", this.eventListeners.mousedown);
    this.canvas.removeEventListener("mousemove", this.eventListeners.mousemove);
    this.canvas.removeEventListener("mouseup", this.eventListeners.mouseup);
    this.canvas.removeEventListener("mouseleave", this.eventListeners.mouseleave);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerCancel);
    this.canvas.removeEventListener(
      "lostpointercapture",
      this.handleLostPointerCapture
    );
    const activePointerId = this.activePointerId;
    this.activePointerId = null;
    if (
      activePointerId !== null &&
      this.canvas.hasPointerCapture(activePointerId)
    ) {
      this.canvas.releasePointerCapture(activePointerId);
    }
    this.canvas.removeEventListener(
      "contextmenu",
      this.eventListeners.contextmenu
    );
    this.canvas.removeEventListener("wheel", this.eventListeners.wheel);
    if (this.previousTouchAction !== null) {
      this.canvas.style.touchAction = this.previousTouchAction;
      this.previousTouchAction = null;
    }
    this.eventListeners = null;
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (
      event.pointerType === "mouse" ||
      this.activePointerId !== null ||
      !event.isPrimary
    ) {
      return;
    }

    event.preventDefault();
    this.activePointerId = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
    this.eventListeners?.pointerdown(event);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    event.preventDefault();
    this.eventListeners?.pointermove(event);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    event.preventDefault();
    this.eventListeners?.pointerup(event);
    this.activePointerId = null;
    this.canvas.releasePointerCapture(event.pointerId);
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    event.preventDefault();
    this.activePointerId = null;
    this.eventListeners?.pointercancel(event);
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
  };

  private readonly handleLostPointerCapture = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    this.activePointerId = null;
    this.eventListeners?.lostpointercapture(event);
  };

  private observeContainerResize(): void {
    const container = this.canvas.parentElement;
    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.syncCanvasSize(true);
    });
    this.resizeObserver.observe(container);
  }

  private readonly handleWindowResize = (): void => {
    this.syncCanvasSize(true);
  };

  private readonly handleResolutionChange = (): void => {
    this.syncCanvasSize(true);
    this.observePixelRatio();
  };

  private observePixelRatio(): void {
    this.resolutionQuery?.removeEventListener("change", this.handleResolutionChange);
    // Resolution changes can leave CSS dimensions unchanged, so ResizeObserver alone is insufficient.
    this.resolutionQuery = window.matchMedia(`(resolution: ${this.pixelRatio}dppx)`);
    this.resolutionQuery.addEventListener("change", this.handleResolutionChange);
  }

  private syncCanvasSize(notify: boolean): void {
    const container = this.canvas.parentElement;
    if (!container) {
      const width = this.renderManager.getCanvasLogicalWidth();
      const height = this.config.canvasHeight || 500;
      this.setCanvasSizeIfChanged(width, height, notify);
      return;
    }

    const rect = container.getBoundingClientRect();
    this.setCanvasSizeIfChanged(
      rect.width,
      rect.height || this.config.canvasHeight || 500,
      notify
    );
  }

  private setCanvasSizeIfChanged(
    width: number,
    height: number,
    notify: boolean
  ): void {
    if (
      width === this.renderManager.getCanvasLogicalWidth() &&
      height === this.renderManager.getCanvasLogicalHeight() &&
      this.pixelRatio === (window.devicePixelRatio || 1)
    ) {
      return;
    }

    this.setCanvasSize(width, height);
    if (notify) {
      this.adjustCanvasSize();
    }
  }
}
