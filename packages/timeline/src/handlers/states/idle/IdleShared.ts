import type { Timeline } from "../../../core/Timeline";
import type {
  InteractionState,
  MouseEventContext,
} from "../InteractionState";

export interface IdleStateFactory {
  getTimeline(): Timeline;
  createDraggingState(): InteractionState;
  createResizingState(): InteractionState;
  createScrollingState(): InteractionState;
  createTimeIndicatorDragState(): InteractionState;
}

export type IdleStateDelegate = IdleStateFactory;

export type IdleMouseEventHandler = (
  ctx: MouseEventContext
) => InteractionState | null;
