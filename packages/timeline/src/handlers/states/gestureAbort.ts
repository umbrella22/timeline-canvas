import type { BusinessId } from "../../types";
import type { TimelineInteractionAPI } from "../TimelineInteractionAPI";
import type { InteractionState } from "./InteractionState";
import { IdleState } from "./IdleState";

/** 手势防御终止的统一 reason 文案（拖拽/拉伸共用） */
export const GESTURE_INTERRUPTED_REASON =
  "gesture interrupted: source event changed under the pointer";

/** pointercancel 路径的统一 reason 文案 */
export const POINTER_CANCELLED_REASON = "pointer cancelled during preview";

type GesturePointer = "draggingEvent" | "resizingEvent";

/**
 * 手势防御终止统一收尾：清空手势指针、通知渲染并返回 Idle。
 * cursor 复位统一由 Dragging/Resizing 的 onExit 处理，终止分支不再各自散落复位。
 */
export function abortGesture(
  timeline: TimelineInteractionAPI,
  pointer: GesturePointer,
  notify: "events:move" | "events:update",
): InteractionState {
  if (pointer === "draggingEvent") timeline.state.draggingEvent = null;
  else timeline.state.resizingEvent = null;
  timeline.notifyChange(notify);
  return new IdleState(timeline);
}

/** 手势期间源事件身份漂移：取消原 preview 事务（防孤儿锁）后统一收尾 */
export function cancelDriftedGesture(
  timeline: TimelineInteractionAPI,
  businessId: BusinessId,
  pointer: GesturePointer,
  notify: "events:move" | "events:update",
): InteractionState {
  timeline.editTransactions.cancelPreview(
    businessId,
    GESTURE_INTERRUPTED_REASON,
    "cancelled",
    "cancelled",
  );
  return abortGesture(timeline, pointer, notify);
}

/** 手势事件丢失/指针被取消：取消全部遗留 preview 事务（防孤儿锁）后统一收尾 */
export function cancelAllPreviewsAndAbort(
  timeline: TimelineInteractionAPI,
  pointer: GesturePointer,
  notify: "events:move" | "events:update",
  reason: string = GESTURE_INTERRUPTED_REASON,
): InteractionState {
  if (timeline.editTransactions.active) {
    for (const businessId of Array.from(timeline.state.editDrafts.keys())) {
      timeline.editTransactions.cancelPreview(businessId, reason, "cancelled", "cancelled");
    }
  }
  return abortGesture(timeline, pointer, notify);
}
