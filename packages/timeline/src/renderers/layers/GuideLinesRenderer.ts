import type { Renderer, RenderContext, LayerType } from "../core/types";
import { formatTime } from "../../utils";

/**
 * 辅助线渲染器 - 绘制对齐辅助线
 */
export class GuideLinesRenderer implements Renderer {
  readonly name = "GuideLines";
  readonly layer: LayerType = "guideLines";

  render(context: RenderContext): void {
    const { ctx, config, state, width, height } = context;

    ctx.save();

    if (state.guideLines.length > 0) {
      ctx.strokeStyle = config.colors.guideLine;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      for (const guideLine of state.guideLines) {
        const x =
          config.startPaddingTime +
          (guideLine.time - config.startTime) *
            config.secondWidth *
            state.zoomLevel -
          state.scrollX;
        if (x < -10 || x > width + 10) continue;

        ctx.beginPath();
        ctx.moveTo(x, config.timelineHeight);
        ctx.lineTo(x, height);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = config.colors.guideLineLabel;
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.fillText(formatTime(guideLine.time), x, config.timelineHeight - 5);
        ctx.setLineDash([5, 5]);
      }
    }

    if (state.dragTimeReference) {
      const x =
        config.startPaddingTime +
        (state.dragTimeReference.time - config.startTime) *
          config.secondWidth *
          state.zoomLevel -
        state.scrollX;
      if (x >= -10 && x <= width + 10) {
        const eventCanvasY = state.dragTimeReference.y - state.scrollY;

        ctx.strokeStyle = config.colors.dragTimeReferenceLine;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(x, config.timelineHeight);
        ctx.lineTo(x, eventCanvasY);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = config.colors.dragTimeReferenceLabel;
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";

        const timeText = formatTime(state.dragTimeReference.time);
        const textMetrics = ctx.measureText(timeText);
        const textWidth = textMetrics.width;
        const textHeight = 14;
        const padding = 4;

        ctx.fillStyle = config.colors.dragTimeReferenceLabelBackground;
        ctx.fillRect(
          x - textWidth / 2 - padding,
          config.timelineHeight - textHeight - padding - 5,
          textWidth + padding * 2,
          textHeight + padding * 2
        );

        ctx.fillStyle = config.colors.dragTimeReferenceLabel;
        ctx.fillText(timeText, x, config.timelineHeight - 5);
      }
    }

    ctx.restore();
  }

  shouldRender(context: RenderContext, prevContext?: RenderContext): boolean {
    if (!prevContext) return true;

    const { state } = context;
    const { state: prevState } = prevContext;

    return (
      state.guideLines !== prevState.guideLines ||
      state.dragTimeReference !== prevState.dragTimeReference ||
      state.scrollX !== prevState.scrollX ||
      state.scrollY !== prevState.scrollY ||
      state.zoomLevel !== prevState.zoomLevel
    );
  }
}
