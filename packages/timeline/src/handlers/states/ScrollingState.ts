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

    // 垂直滚动条拖拽
    if (state.draggingScrollbar) {
      const contentHeight =
        config.timelineHeight +
        config.firstTrackTopMargin +
        state.tracks.length * (config.trackHeight + config.trackMargin);
      const contentWidth =
        config.startPaddingTime +
        (config.endTime + config.endPaddingTime - config.startTime) *
          config.secondWidth *
          state.zoomLevel;
      const hasHorizontalScrollbar = contentWidth > canvasWidth;
      const horizontalScrollbarPadding = hasHorizontalScrollbar ? 13 : 0;
      const availableHeight = canvasHeight - horizontalScrollbarPadding;
      const scrollbarTrackHeight = availableHeight - config.timelineHeight - 5;
      const viewportRatio = availableHeight / contentHeight;
      const handleHeight = Math.max(30, scrollbarTrackHeight * viewportRatio);
      const maxScrollY = Math.max(0, contentHeight - availableHeight);

      const handleY =
        canvasY - config.timelineHeight - state.scrollbarDragOffset;
      const scrollRatio = handleY / (scrollbarTrackHeight - handleHeight);
      state.scrollY = Math.max(
        0,
        Math.min(maxScrollY, scrollRatio * maxScrollY)
      );

      this.timeline.notifyChange("scroll:y");
      return null;
    }

    // 水平滚动条拖拽
    if (state.draggingHorizontalScrollbar) {
      const hContentWidth =
        config.startPaddingTime +
        (config.endTime + config.endPaddingTime - config.startTime) *
          config.secondWidth *
          state.zoomLevel;
      const scrollbarTrackWidth = canvasWidth;
      const viewportRatio = canvasWidth / hContentWidth;
      const handleWidth = Math.max(30, scrollbarTrackWidth * viewportRatio);
      const maxScrollX = Math.max(0, hContentWidth - canvasWidth);

      const handleX = canvasX - state.horizontalScrollbarDragOffset;
      const scrollRatio = handleX / (scrollbarTrackWidth - handleWidth);
      state.scrollX = Math.max(
        0,
        Math.min(maxScrollX, scrollRatio * maxScrollX)
      );

      this.timeline.notifyChange("scroll:x");
      return null;
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

  private createIdleState(): InteractionState {
    return new IdleState(this.timeline);
  }
}
