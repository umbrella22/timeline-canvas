import type { RenderContext } from "../core/types";
import type { PluginManager } from "../../core/managers/PluginManager";
import type { EventTextStyle, TimelineEvent } from "../../types";
import {
  formatTime,
  formatTimeRange,
  formatDuration,
  drawRoundedRect,
} from "../../utils";
import { drawEventContent } from "../core/EventContentRenderer";
import { LogColors, getLogger } from "../../core/managers/Logger";

const logger = getLogger("EventsRenderer");

/**
 * 事件渲染器 - 绘制轨道上的所有事件
 */
export class EventsRenderer {
  /** 每实例限流：模块级 Map 会被多个 Timeline 实例共享且按 trackIndex 无上界增长 */
  private lastTrackLogTime = new Map<number, number>();

  renderEvents(
    ctx: CanvasRenderingContext2D,
    config: RenderContext["config"],
    state: RenderContext["state"],
    trackIndex: number,
    trackY: number,
    canvas: HTMLCanvasElement,
    pluginManager?: PluginManager,
    canvasLogicalWidth?: number,
    dpr = 1
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

    const now = performance.now();
    const lastLogTime = this.lastTrackLogTime.get(trackIndex) ?? 0;
    if (now - lastLogTime >= 500) {
      this.lastTrackLogTime.set(trackIndex, now);
      logger.debugStyled(
        LogColors.eventRender,
        `Track ${trackIndex}: ${track.events.length} events`
      );
    }

    const indicatorPosition = state.timeIndicatorPosition;
    for (let eventIndex = 0; eventIndex < track.events.length; eventIndex++) {
      const event = track.events[eventIndex];
      // M2 编辑协议：存在候选草稿时按 draft 位置绘制（原位置不再显示）
      const draft =
        event.businessId !== undefined
          ? state.editDrafts.get(event.businessId)
          : undefined;
      const isDraggingThis =
        state.draggingEvent &&
        state.draggingEvent.isDragging &&
        state.draggingEvent.trackIndex === trackIndex &&
        state.draggingEvent.eventIndex === eventIndex;
      if (isDraggingThis && !draft) {
        continue;
      }
      let eventX =
        config.startPaddingTime +
        (event.startTime - config.startTime) *
          config.secondWidth *
          state.zoomLevel -
        state.scrollX;
      let eventWidth = event.duration * config.secondWidth * state.zoomLevel;
      let displayTrackY = trackY;
      if (draft) {
        eventX =
          config.startPaddingTime +
          (draft.startTime - config.startTime) *
            config.secondWidth *
            state.zoomLevel -
          state.scrollX;
        eventWidth =
          (draft.endTime - draft.startTime) * config.secondWidth * state.zoomLevel;
        displayTrackY =
          config.timelineHeight +
          config.firstTrackTopMargin +
          draft.targetTrackIndex * (config.trackHeight + config.trackMargin) -
          state.scrollY;
      }
      if (eventX + eventWidth < 0 || eventX > logicalWidth) {
        continue;
      }

      const isSelected =
        state.selectedEvent &&
        state.selectedEvent.trackIndex === trackIndex &&
        state.selectedEvent.eventIndex === eventIndex;
      const isHighlighted =
        state.highlightedEvent &&
        state.highlightedEvent.trackIndex === trackIndex &&
        state.highlightedEvent.eventIndex === eventIndex;
      const isTimeIndicatorHighlighted =
        config.enableTimeIndicator &&
        !state.isManualSelection &&
        indicatorPosition > event.startTime &&
        indicatorPosition < event.endTime;
      const shouldHighlight =
        isSelected || isHighlighted || isTimeIndicatorHighlighted;
      ctx.save();
      const borderRadius = config.eventBlockStyle.borderRadius;
      ctx.fillStyle = event.color;
      if (borderRadius > 0) {
        drawRoundedRect(
          ctx,
          eventX,
          displayTrackY + eventVerticalPadding,
          eventWidth,
          eventHeight,
          borderRadius
        );
        ctx.fill();
      } else {
        ctx.fillRect(
          eventX,
          displayTrackY + eventVerticalPadding,
          eventWidth,
          eventHeight
        );
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
          displayTrackY,
          eventWidth,
          eventVerticalPadding,
          eventHeight
        );
      }
      if (shouldHighlight) {
        ctx.save();
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
            displayTrackY + eventVerticalPadding,
            eventWidth,
            eventHeight,
            borderRadius,
            true
          );
        } else {
          ctx.strokeRect(
            eventX,
            displayTrackY + eventVerticalPadding,
            eventWidth,
            eventHeight
          );
        }
        ctx.shadowBlur = 0;
        ctx.restore();
      }
      const isResizingThis =
        state.resizingEvent &&
        state.resizingEvent.trackIndex === trackIndex &&
        state.resizingEvent.eventIndex === eventIndex;
      this.drawEventContentEntry({
        ctx,
        canvas,
        config,
        state,
        event,
        track,
        trackIndex,
        eventIndex,
        eventX,
        trackY: displayTrackY,
        eventWidth,
        eventVerticalPadding,
        titleFontSize,
        timeFontSize,
        textStyle,
        dpr,
        phase: isResizingThis ? "resize" : "normal",
        selected: Boolean(isSelected),
        // 与核心高亮描边同一判定（含时间指示器高亮），保证自定义渲染器能复现视觉状态
        highlighted: Boolean(shouldHighlight),
      });
      if (config.enableEventResize) {
        this.drawResizeHandles(
          ctx,
          config,
          state,
          trackIndex,
          eventIndex,
          eventX,
          displayTrackY,
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
          displayTrackY,
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
          displayTrackY,
          eventVerticalPadding,
          eventHeight
        );
      }
    }
  }

  /** 通过共享入口绘制内容：未配置 renderEventContent 时走默认文字绘制 */
  private drawEventContentEntry(args: {
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    config: RenderContext["config"];
    state: RenderContext["state"];
    event: TimelineEvent;
    track: RenderContext["state"]["tracks"][number];
    trackIndex: number;
    eventIndex: number;
    eventX: number;
    trackY: number;
    eventWidth: number;
    eventVerticalPadding: number;
    titleFontSize: number;
    timeFontSize: number;
    textStyle: EventTextStyle;
    dpr: number;
    phase: "normal" | "resize";
    selected: boolean;
    highlighted: boolean;
  }): void {
    const {
      ctx,
      canvas,
      config,
      state,
      event,
      track,
      trackIndex,
      eventIndex,
      eventX,
      trackY,
      eventWidth,
      eventVerticalPadding,
      titleFontSize,
      timeFontSize,
      textStyle,
      dpr,
      phase,
      selected,
      highlighted,
    } = args;
    drawEventContent({
      ctx,
      canvas,
      config,
      state,
      dpr,
      event,
      track,
      trackIndex,
      eventIndex,
      rect: {
        x: eventX,
        y: trackY,
        width: eventWidth,
        height: config.trackHeight,
      },
      phase,
      selected,
      highlighted,
      drawDefaultContent: (defaultCtx) =>
        this.drawEventText(
          defaultCtx,
          config,
          event,
          eventX,
          trackY,
          eventWidth,
          eventVerticalPadding,
          titleFontSize,
          timeFontSize,
          textStyle
        ),
      renderEventContent: config.renderEventContent,
    });
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
    event: TimelineEvent,
    eventX: number,
    trackY: number,
    eventWidth: number,
    eventVerticalPadding: number,
    titleFontSize: number,
    timeFontSize: number,
    textStyle: EventTextStyle
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
        `Split: ${splitTimeText}`,
        splitX,
        trackY + eventVerticalPadding - 5
      );
      ctx.restore();
    }
  }

  private drawEventDurationLabel(
    ctx: CanvasRenderingContext2D,
    config: RenderContext["config"],
    event: TimelineEvent,
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
      durationText = formatDuration(
        accurateDuration,
        config.eventDurationPrefix
      );
    }
    ctx.font = "bold 11px Arial";
    ctx.fillStyle = config.colors.eventDurationLabel;
    ctx.textAlign = "center";
    const labelX = eventX + eventWidth / 2;
    // 首行事件标签悬在事件框上方，clamp 到时间轴带之下，避免被轴头截断
    const labelY = Math.max(
      trackY + eventVerticalPadding - 8,
      config.timelineHeight + 12
    );
    ctx.fillText(durationText, labelX, labelY);
    ctx.restore();
  }
}
