import type { TimelineConfig, TimelineState } from "../../types";
import type { RenderManager } from "./RenderManager";

const VIEWPORT_DIRTY_LAYERS = [
  "background",
  "tracks",
  "timeline",
  "guideLines",
  "indicator",
  "scrollbar",
  "interaction",
  "overlay",
] as const;

type ViewportDirtyLayer = (typeof VIEWPORT_DIRTY_LAYERS)[number];

type ViewportRenderManager = Pick<
  RenderManager,
  | "getCanvasLogicalWidth"
  | "getCachedLogicalWidth"
  | "getContentWidth"
  | "computeMaxScrollX"
  | "invalidateLayoutCache"
  | "markDirty"
>;

export interface ViewportControllerOptions {
  config: TimelineConfig;
  state: TimelineState;
  renderManager: ViewportRenderManager;
}

export interface ZoomUpdateResult {
  changed: boolean;
  zoomLevel: number;
  percentage: number;
}

export interface EndTimeUpdateResult {
  oldEndTime: number;
  endTime: number;
  hasOverflowEvents: boolean;
}

export type AutoFitResult =
  | { type: "unchanged" }
  | { type: "fit"; percentage: number }
  | { type: "cappedWithPadding"; percentage: number; seconds: number }
  | { type: "cappedContentShort"; percentage: number };

export class ViewportController {
  private readonly config: TimelineConfig;
  private readonly state: TimelineState;
  private readonly renderManager: ViewportRenderManager;

  constructor(options: ViewportControllerOptions) {
    this.config = options.config;
    this.state = options.state;
    this.renderManager = options.renderManager;
  }

  public autoFitToCanvas(): AutoFitResult {
    const canvasWidth = this.renderManager.getCanvasLogicalWidth();
    let zoom = Math.max(this.config.minAutoFitZoom, this.state.zoomLevel, 1.0);
    const maxZoom = Math.max(this.config.maxAutoFitZoom, zoom);

    if (this.renderManager.getContentWidth(zoom) >= canvasWidth) {
      this.state.zoomLevel = zoom;
      return { type: "unchanged" };
    }

    const step = 0.05;
    while (
      zoom <= maxZoom &&
      this.renderManager.getContentWidth(zoom) < canvasWidth
    ) {
      zoom += step;
    }

    if (
      zoom <= maxZoom &&
      this.renderManager.getContentWidth(zoom) >= canvasWidth
    ) {
      this.state.zoomLevel = parseFloat(zoom.toFixed(3));
      return {
        type: "fit",
        percentage: Math.round(this.state.zoomLevel * 100),
      };
    }

    this.state.zoomLevel = maxZoom;

    if (this.config.endPaddingTime === 0) {
      const currentWidth = this.renderManager.getContentWidth(maxZoom);
      if (currentWidth < canvasWidth) {
        const missingPixels = canvasWidth - currentWidth;
        const secondsPerPixel = this.config.secondWidth * maxZoom;
        const extraSeconds = missingPixels / secondsPerPixel;
        this.config.endPaddingTime = Math.ceil(extraSeconds);
        this.renderManager.invalidateLayoutCache();
        return {
          type: "cappedWithPadding",
          percentage: Math.round(maxZoom * 100),
          seconds: this.config.endPaddingTime,
        };
      }
    }

    this.markDirty();
    return {
      type: "cappedContentShort",
      percentage: Math.round(maxZoom * 100),
    };
  }

  public zoomByFactor(factor: number): ZoomUpdateResult {
    return this.applyZoomLevel(this.state.zoomLevel * factor);
  }

  public setZoomLevel(zoomLevel: number): ZoomUpdateResult {
    return this.applyZoomLevel(zoomLevel);
  }

  public setEndTime(endTime: number): EndTimeUpdateResult {
    const hasOverflowEvents = this.state.tracks.some((track) =>
      track.events.some((event) => event.endTime > endTime)
    );
    const oldEndTime = this.config.endTime;

    this.config.endTime = endTime;
    this.renderManager.invalidateLayoutCache();

    if (this.state.timeIndicatorPosition > endTime) {
      this.state.timeIndicatorPosition = endTime;
    }

    const maxScrollX = this.renderManager.computeMaxScrollX(this.state.zoomLevel);
    this.state.scrollX = Math.max(0, Math.min(maxScrollX, this.state.scrollX));

    return {
      oldEndTime,
      endTime,
      hasOverflowEvents,
    };
  }

  private applyZoomLevel(targetZoomLevel: number): ZoomUpdateResult {
    const oldZoomLevel = this.state.zoomLevel;
    const oldScrollX = this.state.scrollX;
    const centerX = this.renderManager.getCachedLogicalWidth() / 2;
    const centerTimeOffset =
      (centerX + oldScrollX) / (this.config.secondWidth * oldZoomLevel);

    this.state.zoomLevel = this.clampZoomLevel(targetZoomLevel);

    const newCenterX =
      centerTimeOffset * this.config.secondWidth * this.state.zoomLevel;
    this.state.scrollX = newCenterX - centerX;

    const maxScrollX = this.renderManager.computeMaxScrollX(this.state.zoomLevel);
    this.state.scrollX = Math.max(0, Math.min(maxScrollX, this.state.scrollX));

    return {
      changed: oldZoomLevel !== this.state.zoomLevel,
      zoomLevel: this.state.zoomLevel,
      percentage: Math.round(this.state.zoomLevel * 100),
    };
  }

  private clampZoomLevel(zoomLevel: number): number {
    return Math.max(1.0, Math.min(1000.0, zoomLevel));
  }

  private markDirty(): void {
    this.renderManager.markDirty([
      ...VIEWPORT_DIRTY_LAYERS,
    ] as ViewportDirtyLayer[]);
  }
}
