import type { Renderer, RenderContext, LayerType } from "../core/types";
import { drawRoundedRect } from "../../utils";

/**
 * 滚动条渲染器 - 绘制垂直和水平滚动条
 */
export class ScrollbarRenderer implements Renderer {
  readonly name = "Scrollbar";
  readonly layer: LayerType = "scrollbar";

  render(context: RenderContext): void {
    const { ctx, config, state, width, height } = context;

    this.drawVerticalScrollbar(ctx, config, state, width, height);
    this.drawHorizontalScrollbar(ctx, config, state, width, height);
  }

  private drawVerticalScrollbar(
    ctx: CanvasRenderingContext2D,
    config: Readonly<RenderContext["config"]>,
    state: Readonly<RenderContext["state"]>,
    width: number,
    height: number
  ): void {
    const contentWidth =
      (config.endTime + config.endPaddingTime - config.startTime) *
      config.secondWidth *
      state.zoomLevel;
    const hasHorizontalScrollbar = contentWidth > width;
    const horizontalScrollbarPadding = hasHorizontalScrollbar ? 13 : 0;

    const contentHeight =
      config.timelineHeight +
      config.firstTrackTopMargin +
      state.tracks.length * (config.trackHeight + config.trackMargin);
    const availableHeight = height - horizontalScrollbarPadding;

    if (contentHeight > availableHeight) {
      const scrollbarWidth = 8;
      const scrollbarX = width - scrollbarWidth - 5;
      const scrollbarY = config.timelineHeight;
      const scrollbarTrackHeight =
        height - config.timelineHeight - horizontalScrollbarPadding - 5;

      ctx.fillStyle = config.colors.scrollbarTrack;
      drawRoundedRect(
        ctx,
        scrollbarX,
        scrollbarY,
        scrollbarWidth,
        scrollbarTrackHeight,
        4
      );

      const viewportRatio =
        (height - horizontalScrollbarPadding - 5) / contentHeight;
      const handleHeight = Math.max(30, scrollbarTrackHeight * viewportRatio);
      const maxScrollY =
        contentHeight - height + horizontalScrollbarPadding + 5;
      const scrollRatio = state.scrollY / maxScrollY;
      const handleY =
        scrollbarY + (scrollbarTrackHeight - handleHeight) * scrollRatio;

      ctx.fillStyle = state.draggingScrollbar
        ? config.colors.scrollbarHandleHover
        : config.colors.scrollbarHandle;
      drawRoundedRect(
        ctx,
        scrollbarX,
        handleY,
        scrollbarWidth,
        handleHeight,
        4
      );

      ctx.fillStyle = config.colors.scrollbarHandleHighlight;
      drawRoundedRect(
        ctx,
        scrollbarX,
        handleY,
        scrollbarWidth,
        handleHeight / 2,
        4
      );

      if (state.draggingScrollbar) {
        ctx.strokeStyle = config.colors.scrollbarBorder;
        ctx.lineWidth = 1;
        drawRoundedRect(
          ctx,
          scrollbarX,
          handleY,
          scrollbarWidth,
          handleHeight,
          4,
          true
        );
      }
    }
  }

  private drawHorizontalScrollbar(
    ctx: CanvasRenderingContext2D,
    config: Readonly<RenderContext["config"]>,
    state: Readonly<RenderContext["state"]>,
    width: number,
    height: number
  ): void {
    const contentWidth =
      (config.endTime + config.endPaddingTime - config.startTime) *
      config.secondWidth *
      state.zoomLevel;
    if (contentWidth <= width) return;

    const contentHeight =
      config.timelineHeight +
      config.firstTrackTopMargin +
      state.tracks.length * (config.trackHeight + config.trackMargin);
    const hasVerticalScrollbar = contentHeight > height;
    const verticalScrollbarPadding = hasVerticalScrollbar ? 13 : 0;

    const scrollbarHeight = 8;
    const scrollbarY = height - scrollbarHeight - 5;
    const scrollbarX = 0;
    const scrollbarTrackWidth = width - verticalScrollbarPadding;

    ctx.fillStyle = config.colors.scrollbarTrack;
    drawRoundedRect(
      ctx,
      scrollbarX,
      scrollbarY,
      scrollbarTrackWidth,
      scrollbarHeight,
      4
    );

    const viewportRatio = width / contentWidth;
    const handleWidth = Math.max(30, scrollbarTrackWidth * viewportRatio);
    const maxScrollX = contentWidth - width;
    const scrollRatio = state.scrollX / maxScrollX;
    const handleX =
      scrollbarX + (scrollbarTrackWidth - handleWidth) * scrollRatio;

    ctx.fillStyle = state.draggingHorizontalScrollbar
      ? config.colors.scrollbarHandleHover
      : config.colors.scrollbarHandle;
    drawRoundedRect(ctx, handleX, scrollbarY, handleWidth, scrollbarHeight, 4);

    ctx.fillStyle = config.colors.scrollbarHandleHighlight;
    drawRoundedRect(
      ctx,
      handleX,
      scrollbarY,
      handleWidth / 2,
      scrollbarHeight,
      4
    );

    if (state.draggingHorizontalScrollbar) {
      ctx.strokeStyle = config.colors.scrollbarBorder;
      ctx.lineWidth = 1;
      drawRoundedRect(
        ctx,
        handleX,
        scrollbarY,
        handleWidth,
        scrollbarHeight,
        4,
        true
      );
    }
  }

  shouldRender(context: RenderContext, prevContext?: RenderContext): boolean {
    if (!prevContext) return true;

    const { state } = context;
    const { state: prevState } = prevContext;

    return (
      state.scrollY !== prevState.scrollY ||
      state.scrollX !== prevState.scrollX ||
      state.draggingScrollbar !== prevState.draggingScrollbar ||
      state.draggingHorizontalScrollbar !==
        prevState.draggingHorizontalScrollbar
    );
  }
}
