import { scrollbarGeometry, scrollFromHandle } from "../../utils/scrollbars";
import {
  BaseState,
  type InteractionState,
  type MouseEventContext,
} from "./InteractionState";
import type { TimelineInteractionAPI } from "../TimelineInteractionAPI";
import { IdleState } from "./IdleState";

/**
 * 滚动条拖拽状态
 * 负责处理垂直和水平滚动条的拖拽
 */
export class ScrollingState extends BaseState {
  readonly name = "Scrolling";

  constructor(timeline: TimelineInteractionAPI) {
    super(timeline);
  }

  handleMouseMove(ctx: MouseEventContext): InteractionState | null {
    const { canvasX, canvasY, canvasWidth, canvasHeight } = ctx;
    const config = this.timeline.config;
    const state = this.timeline.state;

    const { x, y } = scrollbarGeometry(config, state, canvasWidth, canvasHeight);
    if (state.draggingScrollbar) {
      state.scrollY = scrollFromHandle(y, canvasY, state.scrollbarDragOffset, state.scrollY);
      this.timeline.notifyChange("scroll:y");
    } else if (state.draggingHorizontalScrollbar) {
      state.scrollX = scrollFromHandle(x, canvasX, state.horizontalScrollbarDragOffset, state.scrollX);
      this.timeline.notifyChange("scroll:x");
    }
    return null;
  }

  handleMouseUp(_ctx: MouseEventContext): InteractionState | null {
    const state = this.timeline.state;

    if (state.draggingScrollbar) {
      state.draggingScrollbar = false;
      this.timeline.setStatus(this.timeline.t("statusReady"));
    }

    if (state.draggingHorizontalScrollbar) {
      state.draggingHorizontalScrollbar = false;
      this.timeline.setStatus(this.timeline.t("statusReady"));
    }

    return this.createIdleState();
  }

  handleCancel(_ctx: MouseEventContext): InteractionState | null {
    const state = this.timeline.state;
    state.draggingScrollbar = false;
    state.draggingHorizontalScrollbar = false;
    this.timeline.setStatus(this.timeline.t("statusReady"));
    return this.createIdleState();
  }

  private createIdleState(): InteractionState {
    return new IdleState(this.timeline);
  }
}
