import type { Renderer, RenderContext, LayerType } from "../core/types";

/**
 * 时间指示器渲染器 - 绘制时间指示器
 */
export class IndicatorRenderer implements Renderer {
  readonly name = "Indicator";
  readonly layer: LayerType = "indicator";

  render(context: RenderContext): void {
    const { ctx, config, state, width, height } = context;

    if (!config.enableTimeIndicator) return;

    const timeIndicatorX =
      config.startPaddingTime +
      (state.timeIndicatorPosition - config.startTime) *
        config.secondWidth *
        state.zoomLevel -
      state.scrollX;
    if (timeIndicatorX < -10 || timeIndicatorX > width + 10) return;

    ctx.strokeStyle = config.colors.timeIndicator;
    ctx.lineWidth = config.timeIndicatorWidth;
    ctx.beginPath();
    ctx.moveTo(timeIndicatorX, config.timelineHeight);
    ctx.lineTo(timeIndicatorX, height);
    ctx.stroke();

    const headSize = config.timeIndicatorHeadSize;
    const triangleHeight = config.timeIndicatorTriangleHeight;
    const headY = config.timelineHeight - headSize - triangleHeight;

    ctx.fillStyle = config.colors.timeIndicator;
    ctx.fillRect(timeIndicatorX - headSize / 2, headY, headSize, headSize);

    ctx.beginPath();
    ctx.moveTo(timeIndicatorX - headSize / 2, headY + headSize);
    ctx.lineTo(timeIndicatorX + headSize / 2, headY + headSize);
    ctx.lineTo(timeIndicatorX, headY + headSize + triangleHeight);
    ctx.closePath();
    ctx.fill();
  }

  shouldRender(context: RenderContext, prevContext?: RenderContext): boolean {
    if (!prevContext) return true;

    const { config, state } = context;
    const { config: prevConfig, state: prevState } = prevContext;

    if (!config.enableTimeIndicator) return false;

    return (
      state.timeIndicatorPosition !== prevState.timeIndicatorPosition ||
      state.draggingTimeIndicator !== prevState.draggingTimeIndicator ||
      state.scrollX !== prevState.scrollX ||
      state.zoomLevel !== prevState.zoomLevel ||
      config.timelineHeight !== prevConfig.timelineHeight
    );
  }
}
