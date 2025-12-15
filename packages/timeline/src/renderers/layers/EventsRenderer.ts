import type { RenderContext } from "../core/types";
import type { PluginManager } from "../../core/managers/PluginManager";
import {
  formatTime,
  formatTimeRange,
  formatDuration,
  drawRoundedRect,
} from "../../utils";
import { LogColors, getLogger } from "../../core/managers/Logger";

const logger = getLogger("EventsRenderer");

/**
 * 事件渲染器 - 绘制轨道上的所有事件
 */
export class EventsRenderer {
  renderEvents(
    ctx: CanvasRenderingContext2D,
    config: RenderContext["config"],
    state: RenderContext["state"],
    trackIndex: number,
    trackY: number,
    canvas: HTMLCanvasElement,
    pluginManager?: PluginManager,
    canvasLogicalWidth?: number
  ): void {
    const logicalWidth = canvasLogicalWidth ?? canvas.width;
    const track = state.tracks[trackIndex];
    const eventVerticalPadding = Math.max(5, config.trackHeight * 0.0625);
    const eventHeight = config.trackHeight - eventVerticalPadding * 2;
    const textStyle = config.eventTextStyle;
    const titleFontSize =
      textStyle.titleFontSize === "auto"
        ? Math.max(10, Math.min(14, config.trackHeight * 0.175))
        : textStyle.titleFontSize;
    const timeFontSize =
      textStyle.timeFontSize === "auto"
        ? Math.max(8, Math.min(12, config.trackHeight * 0.15))
        : textStyle.timeFontSize;

    logger.debugStyled(
      LogColors.eventRender,
      `Track ${trackIndex}: ${track.events.length} events`
    );

    for (let eventIndex = 0; eventIndex < track.events.length; eventIndex++) {
      const event = track.events[eventIndex];
      const isDraggingThis =
        state.draggingEvent &&
        state.draggingEvent.isDragging &&
        state.draggingEvent.trackIndex === trackIndex &&
        state.draggingEvent.eventIndex === eventIndex;
      if (isDraggingThis) {
        logger.debugStyled(
          LogColors.eventSkip,
          `  ⊘ Event[${eventIndex}] "${event.title}" skipped (dragging)`
        );
        continue;
      }
      const eventX =
        config.startPaddingTime +
        (event.startTime - config.startTime) *
          config.secondWidth *
          state.zoomLevel -
        state.scrollX;
      const eventWidth = event.duration * config.secondWidth * state.zoomLevel;
      if (eventX + eventWidth < 0 || eventX > logicalWidth) {
        logger.debugStyled(
          LogColors.eventSkip,
          `  ⊘ Event[${eventIndex}] "${event.title}" culled (out of viewport)`
        );
        continue;
      }

      logger.debugStyled(LogColors.eventInfo, `  ● Event[${eventIndex}]`, {
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        duration: event.duration,
        x: eventX.toFixed(1),
        width: eventWidth.toFixed(1),
      });

      const isSelected =
        state.selectedEvent &&
        state.selectedEvent.trackIndex === trackIndex &&
        state.selectedEvent.eventIndex === eventIndex;
      const isHighlighted =
        state.highlightedEvent &&
        state.highlightedEvent.trackIndex === trackIndex &&
        state.highlightedEvent.eventIndex === eventIndex;
      const isInHighlightList = state.timeIndicatorHighlightedEvents.some(
        (h) => h.trackIndex === trackIndex && h.eventIndex === eventIndex
      );
      const indicatorPosition = state.timeIndicatorPosition;
      const isIndicatorInRange =
        indicatorPosition > event.startTime &&
        indicatorPosition < event.endTime;
      const isTimeIndicatorHighlighted =
        !state.isManualSelection && isInHighlightList && isIndicatorInRange;
      const shouldHighlight =
        isSelected || isHighlighted || isTimeIndicatorHighlighted;
      ctx.save();
      const borderRadius = config.eventBlockStyle.borderRadius;
      ctx.fillStyle = event.color;
      if (borderRadius > 0) {
        drawRoundedRect(
          ctx,
          eventX,
          trackY + eventVerticalPadding,
          eventWidth,
          eventHeight,
          borderRadius
        );
        ctx.fill();
      } else {
        ctx.fillRect(
          eventX,
          trackY + eventVerticalPadding,
          eventWidth,
          eventHeight
        );
      }
      if (shouldHighlight) {
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
            trackY + eventVerticalPadding,
            eventWidth,
            eventHeight,
            borderRadius
          );
          ctx.stroke();
        } else {
          ctx.strokeRect(
            eventX,
            trackY + eventVerticalPadding,
            eventWidth,
            eventHeight
          );
        }
        ctx.shadowBlur = 0;
      }
      if (shouldHighlight) {
        ctx.fillStyle = config.colors.eventOverlay;
        if (borderRadius > 0) {
          drawRoundedRect(
            ctx,
            eventX,
            trackY + eventVerticalPadding,
            eventWidth,
            eventHeight,
            borderRadius
          );
          ctx.fill();
        } else {
          ctx.fillRect(
            eventX,
            trackY + eventVerticalPadding,
            eventWidth,
            eventHeight
          );
        }
      }
      ctx.restore();
      if (pluginManager) {
        pluginManager.emitEvent(
          "render:event:media",
          ctx,
          canvas,
          config,
          state,
          trackIndex,
          eventIndex,
          eventX,
          trackY,
          eventWidth,
          eventVerticalPadding,
          eventHeight
        );
      }
      this.drawEventText(
        ctx,
        config,
        event,
        eventX,
        trackY,
        eventWidth,
        eventVerticalPadding,
        titleFontSize,
        timeFontSize,
        textStyle
      );
      if (config.enableEventResize) {
        this.drawResizeHandles(
          ctx,
          config,
          state,
          trackIndex,
          eventIndex,
          eventX,
          trackY,
          eventWidth,
          eventHeight,
          eventVerticalPadding
        );
      }
      if (config.showEventDurationLabel && shouldHighlight) {
        this.drawEventDurationLabel(
          ctx,
          config,
          event,
          eventX,
          trackY,
          eventWidth,
          eventVerticalPadding
        );
      }
      if (
        config.enableEventSplit &&
        state.hoveredSplitLine &&
        !state.draggingEvent &&
        !state.resizingEvent &&
        !state.draggingTimeIndicator
      ) {
        this.drawSplitLine(
          ctx,
          config,
          state,
          trackIndex,
          eventIndex,
          trackY,
          eventVerticalPadding,
          eventHeight
        );
      }
    }
  }

  private truncateText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string {
    if (maxWidth <= 0) return "";
    const textWidth = ctx.measureText(text).width;
    if (textWidth <= maxWidth) return text;
    const ellipsis = "...";
    const ellipsisWidth = ctx.measureText(ellipsis).width;
    if (ellipsisWidth >= maxWidth) return ellipsis;
    let left = 0;
    let right = text.length;
    let result = "";
    while (left < right) {
      const mid = Math.floor((left + right + 1) / 2);
      const testText = text.substring(0, mid) + ellipsis;
      const testWidth = ctx.measureText(testText).width;
      if (testWidth <= maxWidth) {
        result = testText;
        left = mid;
      } else {
        right = mid - 1;
      }
    }
    return result || ellipsis;
  }

  private drawEventText(
    ctx: CanvasRenderingContext2D,
    config: RenderContext["config"],
    event: any,
    eventX: number,
    trackY: number,
    eventWidth: number,
    eventVerticalPadding: number,
    titleFontSize: number,
    timeFontSize: number,
    textStyle: any
  ): void {
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
      top: trackY + eventVerticalPadding + titleFontSize,
      middle: trackY + config.trackHeight / 2,
      bottom: trackY + config.trackHeight - eventVerticalPadding,
    };
    const baseTextY =
      verticalAlignMap[textStyle.verticalAlign] ??
      trackY + eventVerticalPadding;
    ctx.textAlign = textStyle.textAlign;
    const shouldShowTitle =
      textStyle.showTitle && config.trackHeight >= textStyle.minHeightForTitle;
    const shouldShowTime =
      textStyle.showTime && config.trackHeight >= textStyle.minHeightForTime;
    const timeText = formatTimeRange(event.startTime, event.endTime);
    const textPadding = 10;
    const maxTextWidth = eventWidth - textPadding * 2;
    if (shouldShowTitle) {
      ctx.fillStyle = titleColor;
      ctx.font = `${textStyle.titleFontWeight} ${titleFontSize}px ${textStyle.titleFontFamily}`;
      const titleY = shouldShowTime
        ? baseTextY - titleFontSize / 2 + textStyle.titleOffsetY
        : baseTextY + textStyle.titleOffsetY;
      const truncatedTitle = this.truncateText(ctx, event.title, maxTextWidth);
      ctx.fillText(truncatedTitle, textX, titleY);
    }
    if (shouldShowTime) {
      ctx.fillStyle = timeColor;
      ctx.font = `${textStyle.timeFontWeight} ${timeFontSize}px ${textStyle.timeFontFamily}`;
      const timeY = shouldShowTitle
        ? baseTextY + timeFontSize + textStyle.timeOffsetY
        : baseTextY + textStyle.timeOffsetY;
      const truncatedTime = this.truncateText(ctx, timeText, maxTextWidth);
      ctx.fillText(truncatedTime, textX, timeY);
    }
  }

  private drawResizeHandles(
    ctx: CanvasRenderingContext2D,
    config: RenderContext["config"],
    state: RenderContext["state"],
    trackIndex: number,
    eventIndex: number,
    eventX: number,
    trackY: number,
    eventWidth: number,
    eventHeight: number,
    eventVerticalPadding: number
  ): void {
    const isHovered =
      state.hoveredResizeHandle &&
      state.hoveredResizeHandle.trackIndex === trackIndex &&
      state.hoveredResizeHandle.eventIndex === eventIndex;
    const isResizing =
      state.resizingEvent &&
      state.resizingEvent.trackIndex === trackIndex &&
      state.resizingEvent.eventIndex === eventIndex;
    const isSelected =
      state.selectedEvent &&
      state.selectedEvent.trackIndex === trackIndex &&
      state.selectedEvent.eventIndex === eventIndex;
    if (isSelected || isHovered || isResizing) {
      const handleWidth = config.resizeHandleWidth;
      const handleColor = "rgba(255, 255, 255, 0.8)";
      const handleHoverColor = "rgba(255, 255, 255, 1)";
      const isLeftHovered =
        isHovered && state.hoveredResizeHandle!.edge === "left";
      const isLeftResizing = isResizing && state.resizingEvent!.edge === "left";
      ctx.fillStyle =
        isLeftHovered || isLeftResizing ? handleHoverColor : handleColor;
      ctx.fillRect(
        eventX - handleWidth / 2,
        trackY + eventVerticalPadding,
        handleWidth,
        eventHeight
      );
      const isRightHovered =
        isHovered && state.hoveredResizeHandle!.edge === "right";
      const isRightResizing =
        isResizing && state.resizingEvent!.edge === "right";
      ctx.fillStyle =
        isRightHovered || isRightResizing ? handleHoverColor : handleColor;
      ctx.fillRect(
        eventX + eventWidth - handleWidth / 2,
        trackY + eventVerticalPadding,
        handleWidth,
        eventHeight
      );
    }
  }

  private drawSplitLine(
    ctx: CanvasRenderingContext2D,
    config: RenderContext["config"],
    state: RenderContext["state"],
    trackIndex: number,
    eventIndex: number,
    trackY: number,
    eventVerticalPadding: number,
    eventHeight: number
  ): void {
    const splitLine = state.hoveredSplitLine!;
    if (
      splitLine.trackIndex === trackIndex &&
      splitLine.eventIndex === eventIndex
    ) {
      const splitX =
        (splitLine.splitTime + config.startPaddingTime - config.startTime) *
          config.secondWidth *
          state.zoomLevel -
        state.scrollX;
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(splitX, trackY + eventVerticalPadding);
      ctx.lineTo(splitX, trackY + eventVerticalPadding + eventHeight);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255, 255, 0, 1)";
      ctx.beginPath();
      ctx.arc(splitX, trackY + eventVerticalPadding, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(
        splitX,
        trackY + eventVerticalPadding + eventHeight,
        4,
        0,
        Math.PI * 2
      );
      ctx.fill();
      const splitTimeText = formatTime(splitLine.splitTime);
      ctx.font = "bold 11px Arial";
      ctx.fillStyle = "rgba(255, 255, 0, 1)";
      ctx.textAlign = "center";
      ctx.fillText(
        `切割: ${splitTimeText}`,
        splitX,
        trackY + eventVerticalPadding - 5
      );
      ctx.restore();
    }
  }

  private drawEventDurationLabel(
    ctx: CanvasRenderingContext2D,
    config: RenderContext["config"],
    event: any,
    eventX: number,
    trackY: number,
    eventWidth: number,
    eventVerticalPadding: number
  ): void {
    ctx.save();
    const accurateDuration = Math.round(event.duration * 1000) / 1000;
    let durationText: string;
    if (config.formatEventDuration) {
      durationText = config.formatEventDuration(accurateDuration);
    } else {
      durationText = formatDuration(accurateDuration);
    }
    ctx.font = "bold 11px Arial";
    ctx.fillStyle = config.colors.eventDurationLabel;
    ctx.textAlign = "center";
    const labelX = eventX + eventWidth / 2;
    const labelY = trackY + eventVerticalPadding - 8;
    ctx.fillText(durationText, labelX, labelY);
    ctx.restore();
  }
}
