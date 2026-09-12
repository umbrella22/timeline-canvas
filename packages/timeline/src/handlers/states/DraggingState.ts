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
import {
  POINTER_CANCELLED_REASON,
  abortGesture,
  cancelAllPreviewsAndAbort,
  cancelDriftedGesture,
} from "./gestureAbort";
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
    // cursor 复位统一在 onExit：成功/终止/取消路径一致，不再散落各分支
    this.timeline.getCanvas().style.cursor = "default";
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
      // M2：索引漂移可能使手势事件消失——原 preview 事务不得成为孤儿
      if (
        this.timeline.editTransactions.active &&
        state.draggingEvent.originBusinessId !== undefined
      ) {
        return cancelDriftedGesture(
          this.timeline,
          state.draggingEvent.originBusinessId,
          "draggingEvent",
          "events:move",
        );
      }
      logger.warn(this.timeline.t("warningInvalidDraggingState"), {
        value: state.draggingEvent,
      });
      return abortGesture(this.timeline, "draggingEvent", "events:move");
    }

    const event = state.tracks[trackIndex].events[eventIndex];

    // M2：手势期间宿主修改数据（如删除同轨前序事件）会使下标漂移——
    // 命中的事件不再是手势开始时的对象时，取消原 preview 事务并终止手势
    if (
      this.timeline.editTransactions.active &&
      state.draggingEvent.originBusinessId !== undefined &&
      event.businessId !== state.draggingEvent.originBusinessId
    ) {
      return cancelDriftedGesture(
        this.timeline,
        state.draggingEvent.originBusinessId,
        "draggingEvent",
        "events:move",
      );
    }

    // M2 编辑协议：动作开始即捕获 before 快照；busy 等拒绝直接终止本次编辑。
    // 已存在非 preview 事务（pending/待核对）同样终止：绝不能落入 legacy 事实施改路径
    if (this.timeline.editTransactions.active && event.businessId !== undefined) {
      const existingTransaction = this.timeline.editTransactions.getTransaction(event.businessId);
      if (existingTransaction && existingTransaction.state !== "preview") {
        this.timeline.setStatus("busy: event is locked by an in-flight edit operation");
        return abortGesture(this.timeline, "draggingEvent", "events:move");
      }
      if (!existingTransaction) {
        const beginResult = this.timeline.editTransactions.tryBegin({
          event,
          trackIndex,
          eventIndex,
          action: "move",
        });
        if (!beginResult.ok) {
          this.timeline.setStatus(`${beginResult.code}: ${beginResult.reason}`);
          return abortGesture(this.timeline, "draggingEvent", "events:move");
        }
      }
    }

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

    // M2 编辑协议：候选校验 + 草稿更新；不修改确认事实，不自动创建产线。
    // 协议激活且事件带业务身份时绝不落入 legacy 事实施改路径——即使宿主在
    // setStatus 等同步回调中重入变更 API 使事务失效，也只终止手势
    if (this.timeline.editTransactions.active && event.businessId !== undefined) {
      const transaction = this.timeline.editTransactions.getTransaction(event.businessId);
      if (!transaction || transaction.state !== "preview") {
        this.timeline.setStatus("busy: event is locked by an in-flight edit operation");
        return abortGesture(this.timeline, "draggingEvent", "events:move");
      }
      if (targetTrackIndex >= state.tracks.length) targetTrackIndex = state.tracks.length - 1;
      if (targetTrackIndex < 0) targetTrackIndex = 0;
      const newEndTime = fixFloatPrecision(newStartTime + event.duration);
      const validation = this.timeline.validateScheduleEditCandidate({
        eventBusinessId: event.businessId,
        fromTrackIndex: trackIndex,
        fromEventIndex: eventIndex,
        toTrackIndex: targetTrackIndex,
        startTime: newStartTime,
        endTime: newEndTime,
      });
      if (validation.allowed) {
        const targetResource = state.tracks[targetTrackIndex].businessId;
        if (targetResource !== undefined) {
          this.timeline.editTransactions.updateDraft(
            event.businessId,
            { resourceBusinessId: targetResource, startTime: newStartTime, endTime: newEndTime },
            targetTrackIndex,
          );
        }
      } else {
        this.timeline.editTransactions.markCandidateInvalid(event.businessId);
        this.timeline.setStatus(`${validation.code}: ${validation.reason}`);
      }
      if (state.draggingEvent) {
        state.draggingEvent.currentMouseX = logicalX;
        state.draggingEvent.currentMouseY = logicalY;
        state.draggingEvent.canMove = validation.allowed;
      }
      this.timeline.notifyChange("events:move");
      return null;
    }

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
      // 拖拽自动加轨绕过了 addTrack 入口，必须补发视口相关变更，
      // 否则订阅者快照（visibleTrackRange/revision）保持陈旧
      this.timeline.notifyChange("tracks:add");
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
        this.timeline.invalidateBusinessIndexTrack(targetTrackIndex);
        this.timeline.invalidateBusinessIndexTrack(trackIndex);
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
      return cancelAllPreviewsAndAbort(this.timeline, "draggingEvent", "events:move");
    }

    const event = state.tracks[trackIndex]?.events[eventIndex];
    if (!event) {
      logger.warn(this.timeline.t("warningDraggingEventMissing"), {
        trackIndex,
        eventIndex,
      });
      return cancelAllPreviewsAndAbort(this.timeline, "draggingEvent", "events:move");
    }

    // M2：mouseup 与 mousemove 同等的身份校验——最后一条 move 处理完之后、
    // mouseup 之前宿主改动数据会使下标漂移，按漂移后下标结算会提交错误事件
    if (
      this.timeline.editTransactions.active &&
      state.draggingEvent.originBusinessId !== undefined &&
      event.businessId !== state.draggingEvent.originBusinessId
    ) {
      return cancelDriftedGesture(
        this.timeline,
        state.draggingEvent.originBusinessId,
        "draggingEvent",
        "events:move",
      );
    }
    const wasSelected =
      state.selectedEvent &&
      state.selectedEvent.trackIndex === originalTrackIndex &&
      state.selectedEvent.eventIndex === originalEventIndex;

    // M2 编辑协议：preview 事务落点提交（校验失败/业务拒绝已由 cancelPreview 清理并通知）；
    // 协议激活且事件带业务身份时绝不回落 legacy 结算：pending/待核对事务的真实拖拽
    // 防御性终止（协议路径未改事实，不发布虚假 onEventMove）；事务在手势中途被宿主
    // 作废时同样终止。锁定事件的单击保留点击语义，但不覆盖 busy 反馈。
    const activeTransaction =
      event.businessId !== undefined
        ? this.timeline.editTransactions.getTransaction(event.businessId)
        : undefined;
    if (event.businessId !== undefined && activeTransaction?.state === "preview") {
      this.timeline.commitScheduleEdit(event.businessId);
      return abortGesture(this.timeline, "draggingEvent", "events:move");
    }
    let lockedClick = false;
    if (event.businessId !== undefined && this.timeline.editTransactions.active) {
      if (activeTransaction) {
        if (state.draggingEvent.isDragging) {
          this.timeline.setStatus("busy: event is locked by an in-flight edit operation");
          return abortGesture(this.timeline, "draggingEvent", "events:move");
        }
        lockedClick = true;
        this.timeline.setStatus("busy: event is locked by an in-flight edit operation");
      } else if (state.draggingEvent.isDragging) {
        // 协议激活的真实拖拽在手势中途丢失事务（宿主作废）：绝不回落 legacy 结算；
        // 无事务的单击是普通点击，仍走点击语义
        this.timeline.setStatus("cancelled: edit operation invalidated during gesture");
        return abortGesture(this.timeline, "draggingEvent", "events:move");
      }
    }

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
        // M2 回调扩展：oldEvent 与源/目标资源业务身份；旧字段保持不变
        const fromTrack = state.tracks[originalTrackIndex];
        const toTrack = state.tracks[trackIndex];
        this.timeline.callbacks.onEventMove({
          trackIndex,
          eventIndex,
          event: cloneEvent(event),
          fromTrackIndex: originalTrackIndex,
          ...(state.draggingEvent?.oldEvent ? { oldEvent: state.draggingEvent.oldEvent } : {}),
          ...(fromTrack?.businessId !== undefined
            ? { fromResourceBusinessId: fromTrack.businessId }
            : {}),
          ...(toTrack?.businessId !== undefined ? { toResourceBusinessId: toTrack.businessId } : {}),
        });
      }
    } else {
      // 没有实际拖拽,只是点击（锁定事件保留点击语义，但不覆盖 busy 反馈）
      state.selectedEvent = { trackIndex, eventIndex } as SelectedEvent;
      if (!lockedClick) {
        this.timeline.setStatus(
          this.timeline.t("statusEventSelected", { title: event.title })
        );
      }

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

  handleCancel(_ctx: MouseEventContext): InteractionState | null {
    // M2 编辑协议：预览取消（尚无副作用），清空候选草稿
    return cancelAllPreviewsAndAbort(
      this.timeline,
      "draggingEvent",
      "events:move",
      POINTER_CANCELLED_REASON,
    );
  }

  private createIdleState(): InteractionState {
    return new IdleState(this.timeline);
  }
}
