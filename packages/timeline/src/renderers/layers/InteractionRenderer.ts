import type { Renderer, RenderContext, LayerType } from "../core/types";
import type { TimelineConfig, TimelineEvent, TimelineState } from "../../types";
import { drawRoundedRect, formatTime } from "../../utils";
import { drawEventContent } from "../core/EventContentRenderer";

/**
 * 交互层渲染器 - 绘制拖拽预览和拖拽中的事件
 */
export class InteractionRenderer implements Renderer {
  readonly name = "Interaction";
  readonly layer: LayerType = "interaction";

  render(context: RenderContext): void {
    const { ctx, config, state } = context;

    if (!state.draggingEvent || !state.draggingEvent.isDragging) {
      return;
    }

    // 绘制拖拽预览
    this.renderDragPreview(ctx, config, state);

    // 绘制拖拽中的事件
    this.renderDraggingEvent(context);
  }

  private renderDragPreview(
    ctx: CanvasRenderingContext2D,
    config: Readonly<TimelineConfig>,
    state: Readonly<TimelineState>
  ): void {
    if (!state.draggingEvent) return;
    if (!state.tracks[state.draggingEvent.trackIndex]) return;

    const event =
      state.tracks[state.draggingEvent.trackIndex].events[
        state.draggingEvent.eventIndex
      ];
    if (!event) return;

    const y = state.draggingEvent.currentMouseY || 0;
    const canMove = state.draggingEvent.canMove !== false;

    const targetTrackIndex = Math.floor(
      (y - config.timelineHeight - config.firstTrackTopMargin) /
        (config.trackHeight + config.trackMargin)
    );
    const clampedTrackIndex = Math.max(
      0,
      Math.min(state.tracks.length - 1, targetTrackIndex)
    );
    const targetTrackY =
      config.timelineHeight +
      config.firstTrackTopMargin +
      clampedTrackIndex * (config.trackHeight + config.trackMargin);

    const x = state.draggingEvent.currentMouseX || 0;
    const eventX = x - state.dragOffsetX;
    const eventWidth = event.duration * config.secondWidth * state.zoomLevel;

    const eventVerticalPadding = Math.max(5, config.trackHeight * 0.0625);
    const eventHeight = config.trackHeight - eventVerticalPadding * 2;
    const borderRadius = config.eventBlockStyle.borderRadius;

    ctx.save();

    if (canMove) {
      ctx.fillStyle = config.colors.dragPreviewValid;
      ctx.strokeStyle = config.colors.dragPreviewBorderValid;
    } else {
      ctx.fillStyle = config.colors.dragPreviewInvalid;
      ctx.strokeStyle = config.colors.dragPreviewBorderInvalid;
    }

    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.globalAlpha = 0.6;

    if (borderRadius > 0) {
      drawRoundedRect(
        ctx,
        eventX,
        targetTrackY - state.scrollY + eventVerticalPadding,
        eventWidth,
        eventHeight,
        borderRadius
      );
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(
        eventX,
        targetTrackY - state.scrollY + eventVerticalPadding,
        eventWidth,
        eventHeight
      );
      ctx.strokeRect(
        eventX,
        targetTrackY - state.scrollY + eventVerticalPadding,
        eventWidth,
        eventHeight
      );
    }

    ctx.restore();
  }

  private renderDraggingEvent(context: RenderContext): void {
    const { ctx, config, state, canvas, dpr, pluginManager } = context;
    if (!state.draggingEvent) return;
    const track = state.tracks[state.draggingEvent.trackIndex];
    if (!track?.events) return;

    const event = track.events[state.draggingEvent.eventIndex];
    if (!event) return;
    // M2 编辑协议：候选显示由 EventsRenderer 按草稿投影绘制，此处不再画预览
    if (event.businessId !== undefined && state.editDrafts.has(event.businessId)) {
      return;
    }

    const x = state.draggingEvent.currentMouseX || 0;
    const y = state.draggingEvent.currentMouseY || 0;
    const eventX = x - state.dragOffsetX;
    const eventY = y - state.dragOffsetY - state.scrollY;
    const eventWidth = event.duration * config.secondWidth * state.zoomLevel;
    const eventVerticalPadding = Math.max(5, config.trackHeight * 0.0625);
    const eventHeight = config.trackHeight - eventVerticalPadding * 2;

    ctx.save();
    const borderRadius = config.eventBlockStyle.borderRadius;

    // 绘制事件背景
    ctx.fillStyle = event.color;
    if (borderRadius > 0) {
      drawRoundedRect(
        ctx,
        eventX,
        eventY + eventVerticalPadding,
        eventWidth,
        eventHeight,
        borderRadius
      );
      ctx.fill();
    } else {
      ctx.fillRect(
        eventX,
        eventY + eventVerticalPadding,
        eventWidth,
        eventHeight
      );
    }

    // 绘制选中边框
    ctx.strokeStyle = config.colors.eventBorderSelected;
    ctx.lineWidth = 2;
    if (config.eventBlockStyle.enableSelectionGlow) {
      ctx.shadowColor = config.colors.eventBorderSelected;
      ctx.shadowBlur = config.eventBlockStyle.selectionGlowBlur;
    }

    if (borderRadius > 0) {
      drawRoundedRect(
        ctx,
        eventX,
        eventY + eventVerticalPadding,
        eventWidth,
        eventHeight,
        borderRadius
      );
      ctx.stroke();
    } else {
      ctx.strokeRect(
        eventX,
        eventY + eventVerticalPadding,
        eventWidth,
        eventHeight
      );
    }

    ctx.shadowBlur = 0;

    ctx.restore();

    // 拖动中的事件是独立可见表示：媒体 hook 在此恰好执行一次（源实体已被 EventsRenderer 跳过）
    if (pluginManager) {
      pluginManager.emitEvent(
        "render:event:media",
        ctx,
        canvas,
        config,
        state,
        state.draggingEvent.trackIndex,
        state.draggingEvent.eventIndex,
        eventX,
        eventY,
        eventWidth,
        eventVerticalPadding,
        eventHeight
      );
    }

    // 内容经共享入口绘制：rect 使用实际拖动预览位置
    drawEventContent({
      ctx,
      canvas,
      config: config as TimelineConfig,
      state: state as TimelineState,
      dpr,
      event,
      track,
      trackIndex: state.draggingEvent.trackIndex,
      eventIndex: state.draggingEvent.eventIndex,
      rect: {
        x: eventX,
        y: eventY,
        width: eventWidth,
        height: config.trackHeight,
      },
      phase: "drag",
      selected: true,
      highlighted: true,
      drawDefaultContent: (defaultCtx) =>
        this.renderEventText(
          defaultCtx,
          config,
          event,
          eventX,
          eventY,
          eventWidth,
          eventVerticalPadding
        ),
      renderEventContent: config.renderEventContent,
    });
  }

  private renderEventText(
    ctx: CanvasRenderingContext2D,
    config: Readonly<TimelineConfig>,
    event: TimelineEvent,
    eventX: number,
    eventY: number,
    eventWidth: number,
    eventVerticalPadding: number
  ): void {
    const textStyle = config.eventTextStyle;
    const titleColor = textStyle.titleColor || config.colors.eventText;
    const timeColor = textStyle.timeColor || config.colors.eventText;

    const horizontalAlignMap: Record<string, number> = {
      left: eventX + 10,
      right: eventX + eventWidth - 10,
      center: eventX + eventWidth / 2,
    };
    const textX =
      horizontalAlignMap[textStyle.textAlign] ?? eventX + eventWidth / 2;

    const verticalAlignMap: Record<string, number> = {
      top: eventY + eventVerticalPadding,
      middle: eventY + config.trackHeight / 2,
      bottom: eventY + config.trackHeight - eventVerticalPadding,
    };
    const baseTextY =
      verticalAlignMap[textStyle.verticalAlign] ??
      eventY + eventVerticalPadding;

    ctx.textAlign = textStyle.textAlign as CanvasTextAlign;

    const shouldShowTitle =
      textStyle.showTitle && config.trackHeight >= textStyle.minHeightForTitle;
    const shouldShowTime =
      textStyle.showTime && config.trackHeight >= textStyle.minHeightForTime;

    const titleFontSize =
      textStyle.titleFontSize === "auto"
        ? Math.max(10, Math.min(14, config.trackHeight * 0.175))
        : textStyle.titleFontSize;
    const timeFontSize =
      textStyle.timeFontSize === "auto"
        ? Math.max(8, Math.min(12, config.trackHeight * 0.15))
        : textStyle.timeFontSize;

    const timeText = `${formatTime(event.startTime)} - ${formatTime(
      event.endTime
    )}`;

    if (shouldShowTitle) {
      ctx.fillStyle = titleColor;
      ctx.font = `${textStyle.titleFontWeight} ${titleFontSize}px ${textStyle.titleFontFamily}`;
      const titleY = shouldShowTime
        ? baseTextY -
          (typeof titleFontSize === "number" ? titleFontSize : 14) / 2 +
          textStyle.titleOffsetY
        : baseTextY + textStyle.titleOffsetY;
      ctx.fillText(event.title, textX, titleY);
    }

    if (shouldShowTime) {
      ctx.fillStyle = timeColor;
      ctx.font = `${textStyle.timeFontWeight} ${timeFontSize}px ${textStyle.timeFontFamily}`;
      const timeY = shouldShowTitle
        ? baseTextY +
          (typeof timeFontSize === "number" ? timeFontSize : 12) +
          textStyle.timeOffsetY
        : baseTextY + textStyle.timeOffsetY;
      ctx.fillText(timeText, textX, timeY);
    }
  }

  shouldRender(context: RenderContext, prevContext?: RenderContext): boolean {
    if (!prevContext) return true;

    const { state } = context;
    const { state: prevState } = prevContext;

    // 拖拽状态本身发生变化
    if (state.draggingEvent !== prevState.draggingEvent) {
      return true;
    }

    // 拖拽位置发生变化
    if (
      state.draggingEvent &&
      prevState.draggingEvent &&
      (state.draggingEvent.currentMouseX !==
        prevState.draggingEvent.currentMouseX ||
        state.draggingEvent.currentMouseY !==
          prevState.draggingEvent.currentMouseY)
    ) {
      return true;
    }

    return false;
  }
}
