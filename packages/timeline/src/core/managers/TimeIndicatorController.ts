import type { TimelineConfig, TimelineState } from "../../types";
import { getSnapInterval, getTimeX, snapToInterval } from "../../utils";
import type { RenderManager } from "./RenderManager";

const TIME_INDICATOR_DIRTY_LAYERS = [
  "background",
  "tracks",
  "timeline",
  "guideLines",
  "indicator",
  "scrollbar",
  "interaction",
  "overlay",
] as const;

type TimeIndicatorDirtyLayer = (typeof TIME_INDICATOR_DIRTY_LAYERS)[number];

interface TimeIndicatorUpdateResult {
  changed: boolean;
  position: number;
}

type TimeIndicatorRenderManager = Pick<
  RenderManager,
  "getCanvasLogicalWidth" | "computeMaxScrollX" | "markDirty"
>;

export interface TimeIndicatorControllerOptions {
  config: TimelineConfig;
  state: TimelineState;
  renderManager: TimeIndicatorRenderManager;
}

export class TimeIndicatorController {
  private readonly config: TimelineConfig;
  private readonly state: TimelineState;
  private readonly renderManager: TimeIndicatorRenderManager;
  private lastEdgeScrollTime = 0;

  constructor(options: TimeIndicatorControllerOptions) {
    this.config = options.config;
    this.state = options.state;
    this.renderManager = options.renderManager;
  }

  public setPosition(
    seconds: number,
    applySnap = false
  ): TimeIndicatorUpdateResult {
    const nextPosition = this.resolvePosition(seconds, applySnap);
    if (nextPosition === this.state.timeIndicatorPosition) {
      return {
        changed: false,
        position: nextPosition,
      };
    }

    this.state.timeIndicatorPosition = nextPosition;
    this.scrollIntoViewport(nextPosition);
    return {
      changed: true,
      position: nextPosition,
    };
  }

  public setPositionDuringDrag(seconds: number): void {
    const nextPosition = this.clampPosition(seconds);
    this.state.timeIndicatorPosition = nextPosition;
    this.scrollIntoViewportThrottled(nextPosition);
  }

  private resolvePosition(seconds: number, applySnap: boolean): number {
    let nextPosition = seconds;

    if (applySnap && this.state.snapEnabled) {
      const snapIntervalSeconds = getSnapInterval(
        this.state.zoomLevel,
        this.config.snapInterval,
        this.config.snapToSeconds,
        this.config.secondPrecisionZoomThreshold,
        this.config.scale,
        this.config.scaleSplitCount
      );
      nextPosition = snapToInterval(nextPosition, snapIntervalSeconds);
    }

    return this.clampPosition(nextPosition);
  }

  private clampPosition(seconds: number): number {
    return Math.max(
      this.config.startTime,
      Math.min(this.config.endTime, seconds)
    );
  }

  private scrollIntoViewportThrottled(seconds: number): void {
    const now = performance.now();
    if (now - this.lastEdgeScrollTime < this.getEdgeScrollThrottle()) {
      return;
    }

    const timeIndicatorX = this.getTimeIndicatorX(seconds, this.state.scrollX);
    const canvasWidth = this.renderManager.getCanvasLogicalWidth();
    const triggerMargin = this.getEdgeScrollTriggerMargin();

    if (
      timeIndicatorX >= triggerMargin &&
      timeIndicatorX <= canvasWidth - triggerMargin
    ) {
      return;
    }

    this.lastEdgeScrollTime = now;
    const viewportMargin = this.getEdgeScrollViewportMargin();
    const timeAtZeroScroll = this.getTimeIndicatorX(seconds, 0);
    const maxScrollX = this.renderManager.computeMaxScrollX(this.state.zoomLevel);

    if (timeIndicatorX < triggerMargin) {
      this.state.scrollX = Math.max(
        0,
        Math.min(maxScrollX, timeAtZeroScroll - viewportMargin)
      );
    } else {
      this.state.scrollX = Math.max(
        0,
        Math.min(maxScrollX, timeAtZeroScroll - (canvasWidth - viewportMargin))
      );
    }

    this.markDirty();
  }

  private scrollIntoViewport(seconds: number): void {
    const timeIndicatorX = this.getTimeIndicatorX(seconds, this.state.scrollX);
    const canvasWidth = this.renderManager.getCanvasLogicalWidth();
    const margin = this.getEdgeScrollViewportMargin();
    let needsScroll = false;

    if (timeIndicatorX < margin) {
      const targetScrollX = this.getTimeIndicatorX(seconds, 0) - margin;
      const maxScrollX = this.renderManager.computeMaxScrollX(this.state.zoomLevel);
      this.state.scrollX = Math.max(0, Math.min(maxScrollX, targetScrollX));
      needsScroll = true;
    } else if (timeIndicatorX > canvasWidth - margin) {
      const targetScrollX =
        this.getTimeIndicatorX(seconds, 0) - (canvasWidth - margin);
      const maxScrollX = this.renderManager.computeMaxScrollX(this.state.zoomLevel);
      this.state.scrollX = Math.max(0, Math.min(maxScrollX, targetScrollX));
      needsScroll = true;
    }

    if (needsScroll) {
      this.markDirty();
    }
  }

  private getTimeIndicatorX(seconds: number, scrollX: number): number {
    return getTimeX(
      seconds,
      this.config.startTime,
      this.config.startPaddingTime,
      this.config.secondWidth,
      this.state.zoomLevel,
      scrollX
    );
  }

  private getEdgeScrollThrottle(): number {
    return this.resolveEdgeScrollValue(
      this.config.edgeScrollThrottle,
      80
    );
  }

  private getEdgeScrollTriggerMargin(): number {
    return this.resolveEdgeScrollValue(
      this.config.edgeScrollTriggerMargin,
      30
    );
  }

  private getEdgeScrollViewportMargin(): number {
    return this.resolveEdgeScrollValue(
      this.config.edgeScrollViewportMargin,
      50
    );
  }

  private resolveEdgeScrollValue(value: number, fallback: number): number {
    if (!Number.isFinite(value) || value < 0) {
      return fallback;
    }

    return value;
  }

  private markDirty(): void {
    this.renderManager.markDirty([
      ...TIME_INDICATOR_DIRTY_LAYERS,
    ] as TimeIndicatorDirtyLayer[]);
  }
}
