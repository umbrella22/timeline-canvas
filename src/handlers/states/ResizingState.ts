import {
  BaseState,
  type InteractionState,
  type MouseEventContext,
} from "./InteractionState";
import type { Timeline } from "../../core/Timeline";
import {
  fixFloatPrecision,
  getSnapInterval,
  snapToInterval,
  cloneEvent,
} from "../../utils";
import { IdleState } from "./IdleState";

/**
 * 调整事件大小状态
 * 负责处理事件左右边缘的拖拽调整
 */
export class ResizingState extends BaseState {
  readonly name = "Resizing";

  constructor(timeline: Timeline) {
    super(timeline);
  }

  onEnter(): void {
    this.timeline.beginIndexBatch();
  }

  onExit(): void {
    this.timeline.endIndexBatch();
  }

  handleMouseMove(ctx: MouseEventContext): InteractionState | null {
    const { logicalX } = ctx;
    const config = this.timeline.config;
    const state = this.timeline.state;

    if (!state.resizingEvent) {
      return this.createIdleState();
    }

    const {
      trackIndex,
      eventIndex,
      edge,
      originalStartTime,
      originalDuration,
    } = state.resizingEvent;
    const event = state.tracks[trackIndex].events[eventIndex];
    const deltaX = logicalX - state.resizingEvent.startX;
    const deltaTime = deltaX / (config.secondWidth * state.zoomLevel);

    if (edge === "left") {
      // 调整左边缘
      let newStartTime = originalStartTime + deltaTime;
      const originalEndTime = fixFloatPrecision(
        originalStartTime + originalDuration
      );

      // 应用吸附
      if (state.snapEnabled) {
        const snapIntervalSeconds = getSnapInterval(
          state.zoomLevel,
          config.snapInterval,
          config.snapToSeconds,
          config.secondPrecisionZoomThreshold
        );
        newStartTime = snapToInterval(newStartTime, snapIntervalSeconds);
      }

      newStartTime = fixFloatPrecision(
        Math.max(config.startTime, newStartTime)
      );
      newStartTime = fixFloatPrecision(
        Math.min(newStartTime, originalEndTime - config.minEventDuration)
      );

      const newDuration = fixFloatPrecision(originalEndTime - newStartTime);

      // 检查是否与其他事件重叠
      let canResize = true;
      for (let i = 0; i < state.tracks[trackIndex].events.length; i++) {
        if (i === eventIndex) continue;
        const otherEvent = state.tracks[trackIndex].events[i];
        const otherStart = otherEvent.startTime;
        const otherEnd = otherStart + otherEvent.duration;

        if (newStartTime < otherEnd && originalEndTime > otherStart) {
          canResize = false;
          break;
        }
      }

      if (canResize) {
        const ok = this.timeline.canMoveEvent(
          trackIndex,
          eventIndex,
          trackIndex,
          newStartTime,
          newDuration
        );
        if (!ok) {
          this.timeline.draw();
          return null;
        }

        event.startTime = newStartTime;
        event.duration = fixFloatPrecision(newDuration);
        event.endTime = originalEndTime;
        this.timeline.invalidateIndexTrack(trackIndex);
      }
    } else {
      // 调整右边缘
      let newDuration = originalDuration + deltaTime;

      // 应用吸附
      if (state.snapEnabled) {
        const snapIntervalSeconds = getSnapInterval(
          state.zoomLevel,
          config.snapInterval,
          config.snapToSeconds,
          config.secondPrecisionZoomThreshold
        );
        const newEndTime = originalStartTime + newDuration;
        const snappedEndTime = snapToInterval(newEndTime, snapIntervalSeconds);
        newDuration = fixFloatPrecision(snappedEndTime - originalStartTime);
      } else {
        newDuration = fixFloatPrecision(newDuration);
      }

      newDuration = fixFloatPrecision(
        Math.max(config.minEventDuration, newDuration)
      );
      newDuration = fixFloatPrecision(
        Math.min(newDuration, config.endTime - originalStartTime)
      );

      const newEndTime = originalStartTime + newDuration;

      // 检查是否与其他事件重叠
      let canResize = true;
      for (let i = 0; i < state.tracks[trackIndex].events.length; i++) {
        if (i === eventIndex) continue;
        const otherEvent = state.tracks[trackIndex].events[i];
        const otherStart = otherEvent.startTime;
        const otherEnd = otherStart + otherEvent.duration;

        if (originalStartTime < otherEnd && newEndTime > otherStart) {
          canResize = false;
          break;
        }
      }

      if (canResize) {
        const ok = this.timeline.canMoveEvent(
          trackIndex,
          eventIndex,
          trackIndex,
          originalStartTime,
          newDuration
        );
        if (!ok) {
          this.timeline.draw();
          return null;
        }

        event.duration = fixFloatPrecision(newDuration);
        event.endTime = fixFloatPrecision(originalStartTime + newDuration);
        this.timeline.invalidateIndexTrack(trackIndex);
      }
    }

    this.timeline.draw();
    this.timeline.setStatus(
      `调整大小: ${this.timeline.formatTime(
        event.startTime
      )} - ${this.timeline.formatTime(event.endTime)}`
    );

    return null;
  }

  handleMouseUp(_ctx: MouseEventContext): InteractionState | null {
    const state = this.timeline.state;

    if (!state.resizingEvent) {
      return this.createIdleState();
    }

    const { trackIndex, eventIndex } = state.resizingEvent;
    const event = state.tracks[trackIndex].events[eventIndex];

    state.resizingEvent = null;
    this.timeline.getCanvas().style.cursor = "default";
    this.timeline.setStatus(`已调整事件大小: ${event.title}`);

    if (this.timeline.callbacks.onEventUpdate) {
      this.timeline.callbacks.onEventUpdate({
        type: "resize",
        trackIndex,
        eventIndex,
        event: cloneEvent(event),
      });
    }

    this.timeline.draw();
    return this.createIdleState();
  }

  private createIdleState(): InteractionState {
    return new IdleState(this.timeline);
  }
}
