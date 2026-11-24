import { LegacyGesture } from "./legacyGesture";
import {
  BaseState,
  type InteractionState,
  type MouseEventContext,
} from "./InteractionState";
import type { TimelineInteractionAPI } from "../TimelineInteractionAPI";
import {
  fixFloatPrecision,
  getSnapInterval,
  snapToInterval,
  cloneEvent,
} from "../../utils";
import { IdleState } from "./IdleState";
import {
  POINTER_CANCELLED_REASON,
  abortGesture,
  cancelAllPreviewsAndAbort,
  cancelDriftedGesture,
} from "./gestureAbort";

/**
 * 调整事件大小状态
 * 负责处理事件左右边缘的拖拽调整
 */
export class ResizingState extends BaseState {
  readonly name = "Resizing";

  constructor(timeline: TimelineInteractionAPI) {
    super(timeline);
  }

  private legacy?: LegacyGesture;

  onEnter(): void {
    const p = this.timeline.state.resizingEvent;
    if (p && (!this.timeline.editTransactions.active || p.originBusinessId === undefined)) {
      this.legacy = new LegacyGesture(this.timeline, { trackIndex: p.trackIndex, eventIndex: p.eventIndex });
    }
    this.timeline.beginIndexBatch();
  }

  onExit(): void {
    const state = this.timeline.state;
    state.guideLines = [];
    // cursor 复位统一在 onExit：成功/终止/取消路径一致，不再散落各分支
    this.timeline.getCanvas().style.cursor = "default";
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

    // 验证事件索引是否有效
    if (
      trackIndex < 0 ||
      trackIndex >= state.tracks.length ||
      eventIndex < 0 ||
      eventIndex >= state.tracks[trackIndex].events.length
    ) {
      // M2：索引漂移使手势事件消失时，原 preview 事务不得成为孤儿
      if (
        this.timeline.editTransactions.active &&
        state.resizingEvent.originBusinessId !== undefined
      ) {
        return cancelDriftedGesture(
          this.timeline,
          state.resizingEvent.originBusinessId,
          "resizingEvent",
          "events:update",
        );
      }
      return abortGesture(this.timeline, "resizingEvent", "events:update");
    }

    const event = state.tracks[trackIndex].events[eventIndex];
    const deltaX = logicalX - state.resizingEvent.startX;
    const deltaTime = deltaX / (config.secondWidth * state.zoomLevel);

    // M2：手势期间索引漂移检测（同 DraggingState）
    if (
      this.timeline.editTransactions.active &&
      state.resizingEvent.originBusinessId !== undefined &&
      event.businessId !== state.resizingEvent.originBusinessId
    ) {
      return cancelDriftedGesture(
        this.timeline,
        state.resizingEvent.originBusinessId,
        "resizingEvent",
        "events:update",
      );
    }

    const originalEnd = fixFloatPrecision(originalStartTime + originalDuration);
    const isLeft = edge === "left";
    const rawEdge = (isLeft ? originalStartTime : originalEnd) + deltaTime;
    const rawDuration = isLeft ? originalEnd - rawEdge : rawEdge - originalStartTime;
    state.guideLines = this.timeline.calculateGuideLines(trackIndex, eventIndex, trackIndex,
      isLeft ? rawEdge : originalStartTime, rawDuration > 0 ? rawDuration : originalDuration);
    const guide = this.timeline.snapEdgeToGuideLines(rawEdge);
    const grid = getSnapInterval(state.zoomLevel, config.snapInterval, config.snapToSeconds,
      config.secondPrecisionZoomThreshold, config.scale, config.scaleSplitCount);
    const snapped = guide ?? (state.snapEnabled ? snapToInterval(rawEdge, grid) : rawEdge);
    let startTime = isLeft ? fixFloatPrecision(Math.max(config.startTime, snapped)) : originalStartTime;
    let endTime = isLeft ? originalEnd : fixFloatPrecision(Math.max(originalStartTime + config.minEventDuration, snapped));
    // M2 编辑协议：动作开始即捕获 before；候选以草稿更新，不改确认事实
    if (this.timeline.editTransactions.active && event.businessId !== undefined) {
      const existingTransaction = this.timeline.editTransactions.getTransaction(event.businessId);
      if (existingTransaction && existingTransaction.state !== "preview") {
        this.timeline.setStatus("busy: event is locked by an in-flight edit operation");
        return abortGesture(this.timeline, "resizingEvent", "events:update");
      }
      if (!existingTransaction) {
        const beginResult = this.timeline.editTransactions.tryBegin({
          event,
          trackIndex,
          eventIndex,
          action: "resize",
          resizeEdge: edge,
        });
        if (!beginResult.ok) {
          this.timeline.setStatus(`${beginResult.code}: ${beginResult.reason}`);
          return abortGesture(this.timeline, "resizingEvent", "events:update");
        }
      }
      const transaction = this.timeline.editTransactions.getTransaction(event.businessId);
      const validation = this.timeline.validateScheduleEditCandidate({
        eventBusinessId: event.businessId,
        fromTrackIndex: trackIndex,
        fromEventIndex: eventIndex,
        toTrackIndex: trackIndex,
        startTime,
        endTime,
      });
      if (this.timeline.editTransactions.getTransaction(event.businessId) !== transaction) return this.createIdleState();
      if (validation.allowed) {
        const resource = state.tracks[trackIndex].businessId;
        if (resource !== undefined) {
          this.timeline.editTransactions.updateDraft(
            event.businessId,
            { resourceBusinessId: resource, startTime, endTime },
            trackIndex,
          );
        }
      } else {
        this.timeline.editTransactions.markCandidateInvalid(event.businessId);
        this.timeline.setStatus(`${validation.code}: ${validation.reason}`);
      }
      this.timeline.notifyChange("events:update");
      return null;
    }

    if (isLeft) startTime = Math.min(startTime, originalEnd - config.minEventDuration);
    else endTime = Math.min(endTime, config.endTime + config.endPaddingTime);
    const duration = fixFloatPrecision(endTime - startTime);
    if (duration >= config.minEventDuration && this.timeline.canMoveEvent(trackIndex, eventIndex, trackIndex, startTime, duration) &&
        state.resizingEvent && state.tracks[trackIndex]?.events[eventIndex] === event) {
      event.startTime = startTime;
      event.duration = duration;
      event.endTime = endTime;
      this.legacy?.record(trackIndex);
      this.timeline.invalidateIndexTrack(trackIndex);
    }

    this.timeline.notifyChange("events:update");
    this.timeline.setStatus(
      this.timeline.t("statusEventResizing", {
        start: this.timeline.formatTime(event.startTime),
        end: this.timeline.formatTime(event.endTime),
      })
    );

    return null;
  }

  handleMouseUp(ctx: MouseEventContext): InteractionState | null {
    const state = this.timeline.state;

    if (!state.resizingEvent) {
      return this.createIdleState();
    }

    const { trackIndex, eventIndex } = state.resizingEvent;

    // 验证事件索引是否有效
    if (
      trackIndex < 0 ||
      trackIndex >= state.tracks.length ||
      eventIndex < 0 ||
      eventIndex >= state.tracks[trackIndex].events.length
    ) {
      // M2：索引漂移使手势事件消失时，取消遗留的 preview 事务（防孤儿锁）
      return cancelAllPreviewsAndAbort(this.timeline, "resizingEvent", "events:update");
    }

    const event = state.tracks[trackIndex].events[eventIndex];

    // M2：mouseup 与 mousemove 同等的身份校验
    if (
      this.timeline.editTransactions.active &&
      state.resizingEvent.originBusinessId !== undefined &&
      event.businessId !== state.resizingEvent.originBusinessId
    ) {
      return cancelDriftedGesture(
        this.timeline,
        state.resizingEvent.originBusinessId,
        "resizingEvent",
        "events:update",
      );
    }

    // M2 编辑协议：preview 事务落点提交；pending/待核对的锁定事件给 busy 反馈
    const activeTransaction =
      event.businessId !== undefined
        ? this.timeline.editTransactions.getTransaction(event.businessId)
        : undefined;
    if (event.businessId !== undefined && activeTransaction?.state === "preview") {
      this.timeline.commitScheduleEdit(event.businessId);
      return abortGesture(this.timeline, "resizingEvent", "events:update");
    }
    if (event.businessId !== undefined && activeTransaction) {
      // 锁定事件事实未变：不发 resize 成功回调，只给 busy 反馈；
      // 清空 resizingEvent，避免渲染相位停留在 "resize"（把手高亮/split 线被抑制）
      this.timeline.setStatus("busy: event is locked by an in-flight edit operation");
      return abortGesture(this.timeline, "resizingEvent", "events:update");
    }
    if (
      event.businessId !== undefined &&
      this.timeline.editTransactions.active &&
      !activeTransaction &&
      ctx.logicalX !== state.resizingEvent.startX
    ) {
      // 协议激活的真实拉伸在手势中途丢失事务（宿主作废）：绝不回落 legacy 事实施改路径；
      // 无位移的边缘单击保持 legacy 点击语义
      this.timeline.setStatus("cancelled: edit operation invalidated during gesture");
      return abortGesture(this.timeline, "resizingEvent", "events:update");
    }

    if (event.startTime === state.resizingEvent.originalStartTime && event.duration === state.resizingEvent.originalDuration) {
      return abortGesture(this.timeline, "resizingEvent", "events:update");
    }
    const oldEventSnapshot = state.resizingEvent.oldEvent;
    state.resizingEvent = null;
    this.timeline.setStatus(
      this.timeline.t("statusEventResized", { title: event.title })
    );

    if (this.timeline.callbacks.onEventUpdate) {
      this.timeline.callbacks.onEventUpdate({
        type: "resize",
        trackIndex,
        eventIndex,
        event: cloneEvent(event),
        ...(oldEventSnapshot ? { oldEvent: oldEventSnapshot } : {}),
      });
    }

    this.timeline.notifyChange("events:update");
    return this.createIdleState();
  }

  handleCancel(_ctx: MouseEventContext): InteractionState | null {
    this.legacy?.rollback();
    // M2 编辑协议：预览取消（尚无副作用）
    return cancelAllPreviewsAndAbort(
      this.timeline,
      "resizingEvent",
      "events:update",
      POINTER_CANCELLED_REASON,
    );
  }

  private createIdleState(): InteractionState {
    return new IdleState(this.timeline);
  }
}
