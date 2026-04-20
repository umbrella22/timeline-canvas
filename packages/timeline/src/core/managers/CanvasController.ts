import type { TimelineConfig, TimelineState } from "../../types";
import type { RenderManager } from "./RenderManager";

export interface CanvasEventListeners {
  mousedown: (event: MouseEvent) => void;
  mousemove: (event: MouseEvent) => void;
  mouseup: (event: MouseEvent) => void;
  mouseleave: () => void;
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
    this.canvas.addEventListener("contextmenu", listeners.contextmenu);
    this.canvas.addEventListener("wheel", listeners.wheel, {
      passive: false,
    });

    this.syncInitialCanvasSize();
  }

  public setCanvasSize(width: number, height: number): void {
    this.renderManager.setCanvasSize(width, height);
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
    if (!this.eventListeners) {
      return;
    }

    this.canvas.removeEventListener("mousedown", this.eventListeners.mousedown);
    this.canvas.removeEventListener("mousemove", this.eventListeners.mousemove);
    this.canvas.removeEventListener("mouseup", this.eventListeners.mouseup);
    this.canvas.removeEventListener("mouseleave", this.eventListeners.mouseleave);
    this.canvas.removeEventListener(
      "contextmenu",
      this.eventListeners.contextmenu
    );
    this.canvas.removeEventListener("wheel", this.eventListeners.wheel);
    this.eventListeners = null;
  }

  private syncInitialCanvasSize(): void {
    const container = this.canvas.parentElement;
    if (!container) {
      this.setCanvasSize(
        this.renderManager.getCanvasLogicalWidth(),
        this.config.canvasHeight || 500
      );
      return;
    }

    const rect = container.getBoundingClientRect();
    this.setCanvasSize(
      rect.width,
      rect.height || this.config.canvasHeight || 500
    );
  }
}
