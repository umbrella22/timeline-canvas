import { scrollbarGeometry } from "../../utils/scrollbars";
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
    const { y } = scrollbarGeometry(config, state, width, height);
    if (y.maximum > 0 && y.track > 0) {
      const scrollbarWidth = 8;
      const scrollbarX = width - scrollbarWidth - 5;
      const { origin: scrollbarY, track: scrollbarTrackHeight, handle: handleHeight, position: handleY } = y;
      ctx.fillStyle = config.colors.scrollbarTrack;
      drawRoundedRect(
        ctx,
        scrollbarX,
        scrollbarY,
        scrollbarWidth,
        scrollbarTrackHeight,
        4
      );

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
    const { x } = scrollbarGeometry(config, state, width, height);
    if (x.maximum <= 0 || x.track <= 0) return;
    const { origin: scrollbarX, track: scrollbarTrackWidth, handle: handleWidth, position: handleX } = x;
    const scrollbarHeight = 8;
    const scrollbarY = height - scrollbarHeight - 5;
    ctx.fillStyle = config.colors.scrollbarTrack;
    drawRoundedRect(
      ctx,
      scrollbarX,
      scrollbarY,
      scrollbarTrackWidth,
      scrollbarHeight,
      4
    );

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
