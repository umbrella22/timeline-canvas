import {
  BaseState,
  type InteractionState,
  type MouseEventContext,
} from "./InteractionState";
import type { TimelineInteractionAPI } from "../TimelineInteractionAPI";
import type { Track, SelectedEvent } from "../../types";
import {
  fixFloatPrecision,
  getSnapInterval,
  snapToInterval,
  cloneEvent,
  getTimeX,
} from "../../utils";
import { IdleState } from "./IdleState";
import { getLogger } from "../../core/managers/Logger";

const logger = getLogger("DraggingState");

/**
 * 拖拽事件状态
 * 负责处理事件在轨道内或跨轨道的拖拽操作
 */
export class DraggingState extends BaseState {
  readonly name = "Dragging";
  private readonly MOVE_THRESHOLD = 5;
  /** 是否当前吸附在辅助线上（粘滞吸附） */
  private isSnappedToGuideLine = false;
  /** 当前吸附位置的时间 */
  private snappedTime: number | null = null;

  constructor(timeline: TimelineInteractionAPI) {
    super(timeline);
  }

  onEnter(): void {
    this.timeline.beginIndexBatch();
  }

  onExit(): void {
    const state = this.timeline.state;
    state.guideLines = [];
    state.dragTimeReference = null;
    this.timeline.endIndexBatch();
    this.timeline.autoRemoveEmptyLastTrack();
  }

  handleMouseMove(ctx: MouseEventContext): InteractionState | null {
    const { logicalX, logicalY } = ctx;
    const config = this.timeline.config;
    const state = this.timeline.state;
    const canvas = this.timeline.getCanvas();

    if (!state.draggingEvent) {
      return this.createIdleState();
    }

    // 检查是否达到拖拽阈值
    const moveDistance = Math.sqrt(
      Math.pow(logicalX - state.draggingEvent.startX, 2) +
        Math.pow(logicalY - state.draggingEvent.startY, 2)
    );

    if (moveDistance > this.MOVE_THRESHOLD) {
      state.draggingEvent.isDragging = true;
    }

    if (!state.draggingEvent.isDragging) {
      canvas.style.cursor = "move";
      return null;
    }

    const { trackIndex, eventIndex } = state.draggingEvent;

    // 验证事件索引是否有效
    if (
      trackIndex < 0 ||
      trackIndex >= state.tracks.length ||
      eventIndex < 0 ||
      eventIndex >= state.tracks[trackIndex].events.length
    ) {
      logger.warn(this.timeline.t("warningInvalidDraggingState"), {
        value: state.draggingEvent,
      });
      state.draggingEvent = null;
      return this.createIdleState();
    }

    const event = state.tracks[trackIndex].events[eventIndex];

    this.timeline.setStatus(
      this.timeline.t("statusDragging", { title: event.title })
    );

    // 计算新的时间位置
    const currentMouseX = logicalX;
    const originalMouseX = state.draggingEvent.startX;
    const deltaPixels = currentMouseX - originalMouseX;
    const deltaTime = deltaPixels / (config.secondWidth * state.zoomLevel);
    let newStartTime = state.draggingEvent.originalStartTime + deltaTime;

    // 计算目标轨道
    let targetTrackIndex = Math.floor(
      (logicalY - config.timelineHeight - config.firstTrackTopMargin) /
        (config.trackHeight + config.trackMargin)
    );

    // 自动添加轨道
    if (config.autoAddTrack && targetTrackIndex >= state.tracks.length) {
      const newTrack: Track = { id: state.tracks.length, events: [] };
      state.tracks.push(newTrack);
      this.timeline.setStatus(
        this.timeline.t("statusAutoTrackAdded", {
          count: state.tracks.length,
        })
      );
      if (this.timeline.callbacks.onTrackAdd) {
        this.timeline.callbacks.onTrackAdd(newTrack);
      }
    }

    targetTrackIndex = Math.max(
      0,
      Math.min(state.tracks.length - 1, targetTrackIndex)
    );

    // 计算辅助线
    state.guideLines = this.timeline.calculateGuideLines(
      trackIndex,
      eventIndex,
      targetTrackIndex,
      newStartTime,
      event.duration
    );

    // 吸附到辅助线（最高优先级）
    const guideLineSnap = this.timeline.snapToGuideLines(
      newStartTime,
      event.duration
    );
    if (guideLineSnap !== null) {
      // 粘滞吸附机制：如果已经吸附在辅助线上，需要更大的拖拽量才能脱离
      if (this.isSnappedToGuideLine && this.snappedTime !== null) {
        const breakFreeThreshold = this.timeline.config.guideLineSnapThreshold * 1.5;
        if (Math.abs(newStartTime - this.snappedTime) < breakFreeThreshold) {
          newStartTime = this.snappedTime;
        } else {
          // 脱离吸附
          this.isSnappedToGuideLine = false;
          this.snappedTime = null;
          newStartTime = guideLineSnap;
          this.isSnappedToGuideLine = true;
          this.snappedTime = guideLineSnap;
        }
      } else {
        newStartTime = guideLineSnap;
        this.isSnappedToGuideLine = true;
        this.snappedTime = guideLineSnap;
      }
    } else {
      this.isSnappedToGuideLine = false;
      this.snappedTime = null;

      if (state.snapEnabled) {
        // 吸附到时间指示器
        if (config.enableTimeIndicator && state.timeIndicatorSnapEnabled) {
          const timeIndicatorX = getTimeX(
            state.timeIndicatorPosition,
            config.startTime,
            config.startPaddingTime,
            config.secondWidth,
            state.zoomLevel,
            state.scrollX
          );
          const eventX =
            config.startPaddingTime +
            (newStartTime - config.startTime) *
              config.secondWidth *
              state.zoomLevel -
            state.scrollX;
          const distance = Math.abs(eventX - timeIndicatorX);

          if (distance < config.timeIndicatorSnapThreshold) {
            newStartTime = state.timeIndicatorPosition;
          } else {
            const snapIntervalSeconds = getSnapInterval(
              state.zoomLevel,
              config.snapInterval,
              config.snapToSeconds,
              config.secondPrecisionZoomThreshold,
              config.scale,
              config.scaleSplitCount
            );
            newStartTime = snapToInterval(newStartTime, snapIntervalSeconds);
          }
        } else {
          const snapIntervalSeconds = getSnapInterval(
            state.zoomLevel,
            config.snapInterval,
            config.snapToSeconds,
            config.secondPrecisionZoomThreshold,
            config.scale,
            config.scaleSplitCount
          );
          newStartTime = snapToInterval(newStartTime, snapIntervalSeconds);
        }
      }
    }

    // 限制在时间范围内
    newStartTime = Math.max(
      config.startTime,
      Math.min(config.endTime - event.duration, newStartTime)
    );

    // 设置拖拽时间参考线
    const eventY =
      config.timelineHeight +
      config.firstTrackTopMargin +
      targetTrackIndex * (config.trackHeight + config.trackMargin) +
      config.trackHeight / 2;
    state.dragTimeReference = { time: newStartTime, y: eventY };

    // 检查是否可以移动
    const canMove = this.timeline.canMoveEvent(
      trackIndex,
      eventIndex,
      targetTrackIndex,
      newStartTime,
      event.duration
    );

    if (canMove) {
      event.startTime = newStartTime;
      event.endTime = fixFloatPrecision(newStartTime + event.duration);
      this.timeline.invalidateIndexTrack(trackIndex);

      // 跨轨道移动
      if (targetTrackIndex !== trackIndex) {
        const eventToMove = state.tracks[trackIndex].events.splice(
          eventIndex,
          1
        )[0];
        state.tracks[targetTrackIndex].events.push(eventToMove);

        state.draggingEvent.trackIndex = targetTrackIndex;
        state.draggingEvent.eventIndex =
          state.tracks[targetTrackIndex].events.length - 1;
        state.selectedTrack = targetTrackIndex;

        if (state.selectedEvent && state.selectedEvent.trackIndex === trackIndex) {
          if (state.selectedEvent.eventIndex === eventIndex) {
            // 被选中的事件就是被拖拽的事件，跟随移动
            state.selectedEvent = {
              trackIndex: targetTrackIndex,
              eventIndex: state.tracks[targetTrackIndex].events.length - 1,
            } as SelectedEvent;
          } else if (state.selectedEvent.eventIndex > eventIndex) {
            // splice 导致源轨道后续事件索引前移，需修正
            state.selectedEvent = {
              ...state.selectedEvent,
              eventIndex: state.selectedEvent.eventIndex - 1,
            } as SelectedEvent;
          }
        }

        this.timeline.invalidateIndexTrack(targetTrackIndex);
        this.timeline.invalidateIndexTrack(trackIndex);
      }
    }

    if (state.draggingEvent) {
      state.draggingEvent.currentMouseX = logicalX;
      state.draggingEvent.currentMouseY = logicalY;
      state.draggingEvent.canMove = canMove;
    }

    this.timeline.notifyChange("events:move");
    return null;
  }

  handleMouseUp(_ctx: MouseEventContext): InteractionState | null {
    const state = this.timeline.state;

    if (!state.draggingEvent) {
      return this.createIdleState();
    }

    const { trackIndex, eventIndex, originalTrackIndex, originalEventIndex } =
      state.draggingEvent;

    // 验证轨道索引是否有效
    if (trackIndex < 0 || trackIndex >= state.tracks.length) {
      logger.warn(this.timeline.t("warningDraggingEventMissing"), {
        trackIndex,
        eventIndex,
      });
      state.draggingEvent = null;
      return this.createIdleState();
    }

    const event = state.tracks[trackIndex]?.events[eventIndex];
    if (!event) {
      logger.warn(this.timeline.t("warningDraggingEventMissing"), {
        trackIndex,
        eventIndex,
      });
      state.draggingEvent = null;
      return this.createIdleState();
    }
    const wasSelected =
      state.selectedEvent &&
      state.selectedEvent.trackIndex === originalTrackIndex &&
      state.selectedEvent.eventIndex === originalEventIndex;

    if (state.draggingEvent.isDragging) {
      this.timeline.setStatus(
        this.timeline.t("statusEventPlaced", {
          title: event.title,
          start: this.timeline.formatTime(event.startTime),
          end: this.timeline.formatTime(event.endTime),
        })
      );

      if (wasSelected) {
        state.selectedEvent = { trackIndex, eventIndex } as SelectedEvent;
      }

      if (this.timeline.callbacks.onEventMove) {
        this.timeline.callbacks.onEventMove({
          trackIndex,
          eventIndex,
          event: cloneEvent(event),
          fromTrackIndex: originalTrackIndex,
        });
      }
    } else {
      // 没有实际拖拽,只是点击
      state.selectedEvent = { trackIndex, eventIndex } as SelectedEvent;
      this.timeline.setStatus(
        this.timeline.t("statusEventSelected", { title: event.title })
      );

      if (this.timeline.callbacks.onEventClick) {
        this.timeline.callbacks.onEventClick({
          trackIndex,
          eventIndex,
          event: cloneEvent(event),
          trackName: this.timeline.t("labelTrackName", {
            index: trackIndex + 1,
          }),
          formattedTimeRange: `${this.timeline.formatTime(
            event.startTime
          )} - ${this.timeline.formatTime(event.endTime)}`,
        });
      }
    }

    state.draggingEvent = null;
    this.timeline.notifyChange("events:move");

    return this.createIdleState();
  }

  private createIdleState(): InteractionState {
    return new IdleState(this.timeline);
  }
}
