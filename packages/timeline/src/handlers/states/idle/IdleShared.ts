import type { TimelineInteractionAPI } from "../../TimelineInteractionAPI";
import type {
  InteractionState,
  MouseEventContext,
} from "../InteractionState";

export interface IdleStateFactory {
  getTimeline(): TimelineInteractionAPI;
  createDraggingState(): InteractionState;
  createResizingState(): InteractionState;
  createScrollingState(): InteractionState;
  createTimeIndicatorDragState(): InteractionState;
}

export type IdleStateDelegate = IdleStateFactory;

export type IdleMouseEventHandler = (
  ctx: MouseEventContext
) => InteractionState | null;
