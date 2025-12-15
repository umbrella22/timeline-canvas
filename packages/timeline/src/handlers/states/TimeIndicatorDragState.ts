import {
  BaseState,
  type InteractionState,
  type MouseEventContext,
} from "./InteractionState";
import type { Timeline } from "../../core/Timeline";
import { getSnapInterval, snapToInterval } from "../../utils";
import { IdleState } from "./IdleState";

/**
 * 时间指示器拖拽状态
 * 负责处理时间指示器的拖拽移动
 */
export class TimeIndicatorDragState extends BaseState {
  readonly name = "TimeIndicatorDrag";

  constructor(timeline: Timeline) {
    super(timeline);
  }

  handleMouseMove(ctx: MouseEventContext): InteractionState | null {
    const { canvasX } = ctx;
    const config = this.timeline.config;
    const state = this.timeline.state;
    const canvas = this.timeline.getCanvas();

    if (!state.draggingTimeIndicator) {
      return this.createIdleState();
    }

    canvas.style.cursor = config.readOnly ? "not-allowed" : "ew-resize";

    const newTimeIndicatorX = canvasX - state.timeIndicatorDragOffsetX;
    let newTime =
      (newTimeIndicatorX + state.scrollX - config.startPaddingTime) /
        (config.secondWidth * state.zoomLevel) +
      config.startTime;

    // 应用吸附
    if (state.snapEnabled) {
      const snapIntervalSeconds = getSnapInterval(
        state.zoomLevel,
        config.snapInterval,
        config.snapToSeconds,
        config.secondPrecisionZoomThreshold
      );
      newTime = snapToInterval(newTime, snapIntervalSeconds);
    }

    newTime = Math.max(config.startTime, Math.min(config.endTime, newTime));
    this.timeline.setTimeIndicator(newTime, false);

    return null;
  }

  handleMouseUp(_ctx: MouseEventContext): InteractionState | null {
    const state = this.timeline.state;

    if (state.draggingTimeIndicator) {
      state.draggingTimeIndicator = false;
      this.timeline.setStatus(
        `时间指示器已放置: ${this.timeline.formatTime(
          state.timeIndicatorPosition
        )}`
      );
    }

    return this.createIdleState();
  }

  private createIdleState(): InteractionState {
    return new IdleState(this.timeline);
  }
}
