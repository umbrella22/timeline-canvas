import { cloneEvent, formatTimeRange, getTimeX } from "../../../utils";
import type { InteractionState, MouseEventContext } from "../InteractionState";
import type { IdleStateDelegate } from "./IdleShared";

export class IdleMouseDownRouter {
  constructor(private readonly delegate: IdleStateDelegate) {}

  public handleMouseDown(ctx: MouseEventContext): InteractionState | null {
    const timeline = this.delegate.getTimeline();
    const { config, state } = timeline;
    const { canvasX, canvasY, logicalX, logicalY, canvasWidth, canvasHeight } =
      ctx;
    const canvas = timeline.getCanvas();
    const isReadOnly = config.readOnly;

    if (ctx.originalEvent.button === 2) {
      return null;
    }

    const contextMenuResult = this.handleContextMenuClick(ctx);
    if (contextMenuResult.handled) {
      return contextMenuResult.nextState;
    }

    const scrollbarState = this.handleScrollbarMouseDown(
      canvasX,
      canvasY,
      canvasWidth,
      canvasHeight
    );
    if (scrollbarState) {
      return scrollbarState;
    }

    const indicatorState = this.handleTimeIndicatorMouseDown(canvasX, canvasY);
    if (indicatorState) {
      return indicatorState;
    }

    if (logicalY < config.timelineHeight) {
      return null;
    }

    const hitResult = timeline.getInteractionTarget(canvasX, canvasY);

    if (config.enableEventResize && !isReadOnly && hitResult.resizeEdge) {
      const event =
        state.tracks[hitResult.trackIndex!].events[hitResult.eventIndex!];
      if (event.readonly) {
        canvas.style.cursor = "not-allowed";
        return null;
      }

      state.resizingEvent = {
        trackIndex: hitResult.trackIndex!,
        eventIndex: hitResult.eventIndex!,
        edge: hitResult.resizeEdge,
        startX: logicalX,
        originalStartTime: event.startTime,
        originalDuration: event.duration,
      };

      return this.delegate.createResizingState();
    }

    if (hitResult.eventIndex !== null && hitResult.trackIndex !== null) {
      return this.handleEventMouseDown(
        hitResult.trackIndex,
        hitResult.eventIndex,
        logicalX,
        logicalY
      );
    }

    state.selectedEvent = null;
    state.highlightedEvent = null;
    state.selectedTrack = null;
    state.isManualSelection = false;

    if (timeline.callbacks.onEventHighlight) {
      timeline.callbacks.onEventHighlight({
        trackIndex: null,
        eventIndex: null,
        event: null,
      });
    }

    timeline.notifyChange("selection:change");
    return null;
  }

  private handleContextMenuClick(
    ctx: MouseEventContext
  ): { handled: boolean; nextState: InteractionState | null } {
    const timeline = this.delegate.getTimeline();
    const { config, state } = timeline;
    const { canvasX, canvasY } = ctx;

    if (!state.contextMenuVisible || !state.contextMenuBounds) {
      return { handled: false, nextState: null };
    }

    const menuBounds = state.contextMenuBounds;
    const isInsideMenu =
      canvasX >= menuBounds.x &&
      canvasX <= menuBounds.x + menuBounds.width &&
      canvasY >= menuBounds.y &&
      canvasY <= menuBounds.y + menuBounds.height;

    if (!isInsideMenu) {
      state.contextMenuVisible = false;
      state.contextMenuEvent = null;
      timeline.notifyChange("interaction:contextMenu");
      return { handled: false, nextState: null };
    }

    const itemIndex = Math.floor(
      (canvasY - menuBounds.y - menuBounds.padding) / menuBounds.itemHeight
    );

    if (
      itemIndex >= 0 &&
      itemIndex < config.contextMenuItems.length &&
      state.contextMenuEvent
    ) {
      const menuItem = config.contextMenuItems[itemIndex];
      const { trackIndex, eventIndex } = state.contextMenuEvent;
      const event = state.tracks[trackIndex].events[eventIndex];

      if (
        event.readonly &&
        (menuItem.type === "delete" || menuItem.type === "edit")
      ) {
        timeline.setStatus("Read-only events cannot be edited or deleted");
        state.contextMenuVisible = false;
        state.contextMenuEvent = null;
        timeline.notifyChange("interaction:contextMenu");
        return { handled: true, nextState: null };
      }

      if (timeline.callbacks.onContextMenu) {
        timeline.callbacks.onContextMenu({
          menuType: menuItem.type,
          trackIndex,
          eventIndex,
          event: cloneEvent(event),
        });
      }

      state.contextMenuVisible = false;
      state.contextMenuEvent = null;
      timeline.notifyChange("interaction:contextMenu");
    }

    return { handled: true, nextState: null };
  }

  private handleScrollbarMouseDown(
    canvasX: number,
    canvasY: number,
    canvasWidth: number,
    canvasHeight: number
  ): InteractionState | null {
    const timeline = this.delegate.getTimeline();
    const { config, state } = timeline;

    const contentHeight =
      config.timelineHeight +
      config.firstTrackTopMargin +
      state.tracks.length * (config.trackHeight + config.trackMargin);
    const availableHeight = timeline.getAvailableHeight();

    if (contentHeight > availableHeight) {
      const scrollbarWidth = 8;
      const scrollbarX = canvasWidth - scrollbarWidth - 5;
      const scrollbarY = config.timelineHeight;
      const scrollbarTrackHeight = availableHeight - config.timelineHeight - 5;

      if (
        canvasX >= scrollbarX &&
        canvasX <= scrollbarX + scrollbarWidth &&
        canvasY >= scrollbarY &&
        canvasY <= scrollbarY + scrollbarTrackHeight
      ) {
        state.draggingScrollbar = true;
        const viewportRatio = availableHeight / contentHeight;
        const handleHeight = Math.max(30, scrollbarTrackHeight * viewportRatio);
        const maxScrollY = contentHeight - availableHeight;
        const scrollRatio = state.scrollY / maxScrollY;
        const handleY =
          scrollbarY + (scrollbarTrackHeight - handleHeight) * scrollRatio;
        state.scrollbarDragOffset = canvasY - handleY;

        return this.delegate.createScrollingState();
      }
    }

    const contentWidth = timeline.getContentWidthForZoom(state.zoomLevel);
    if (contentWidth <= canvasWidth) {
      return null;
    }

    const scrollbarHeight = 8;
    const scrollbarY = canvasHeight - scrollbarHeight - 5;
    const scrollbarTrackWidth = canvasWidth;

    if (
      canvasY >= scrollbarY &&
      canvasY <= scrollbarY + scrollbarHeight &&
      canvasX >= 0 &&
      canvasX <= scrollbarTrackWidth
    ) {
      state.draggingHorizontalScrollbar = true;
      const viewportRatio = canvasWidth / contentWidth;
      const handleWidth = Math.max(30, scrollbarTrackWidth * viewportRatio);
      const maxScrollX = contentWidth - canvasWidth;
      const scrollRatio = state.scrollX / maxScrollX;
      const handleX = (scrollbarTrackWidth - handleWidth) * scrollRatio;
      state.horizontalScrollbarDragOffset = canvasX - handleX;

      return this.delegate.createScrollingState();
    }

    return null;
  }

  private handleTimeIndicatorMouseDown(
    canvasX: number,
    canvasY: number
  ): InteractionState | null {
    const timeline = this.delegate.getTimeline();
    const { config, state } = timeline;

    if (!config.enableTimeIndicator || config.readOnly) {
      return null;
    }

    const timeIndicatorX = getTimeX(
      state.timeIndicatorPosition,
      config.startTime,
      config.startPaddingTime,
      config.secondWidth,
      state.zoomLevel,
      state.scrollX
    );
    const headSize = config.timeIndicatorHeadSize;
    const triangleHeight = config.timeIndicatorTriangleHeight;
    const headY = config.timelineHeight - headSize - triangleHeight;

    const isInsideIndicator =
      canvasX >= timeIndicatorX - headSize / 2 &&
      canvasX <= timeIndicatorX + headSize / 2 &&
      canvasY >= headY &&
      canvasY <= config.timelineHeight;

    if (!isInsideIndicator) {
      return null;
    }

    state.draggingTimeIndicator = true;
    state.timeIndicatorDragOffsetX = canvasX - timeIndicatorX;
    return this.delegate.createTimeIndicatorDragState();
  }

  private handleEventMouseDown(
    trackIndex: number,
    eventIndex: number,
    logicalX: number,
    logicalY: number
  ): InteractionState | null {
    const timeline = this.delegate.getTimeline();
    const { config, state } = timeline;
    const canvas = timeline.getCanvas();
    const event = state.tracks[trackIndex].events[eventIndex];
    const now = Date.now();
    const isDoubleClick =
      state.lastClickEvent &&
      state.lastClickEvent.trackIndex === trackIndex &&
      state.lastClickEvent.eventIndex === eventIndex &&
      now - state.lastClickTime < 300;

    if (isDoubleClick && config.enableEventSplit) {
      if (event.readonly) {
        timeline.setStatus("Read-only events cannot be split");
        state.lastClickTime = 0;
        state.lastClickEvent = null;
        return null;
      }

      const clickTime =
        (logicalX - config.startPaddingTime) /
          (config.secondWidth * state.zoomLevel) +
        config.startTime;
      timeline.splitEvent(trackIndex, eventIndex, clickTime);
      state.lastClickTime = 0;
      state.lastClickEvent = null;
      timeline.hideSplitLine();
      return null;
    }

    state.lastClickEvent = { trackIndex, eventIndex };
    state.lastClickTime = now;
    state.selectedEvent = { trackIndex, eventIndex };
    state.isManualSelection = true;
    state.highlightedEvent = null;
    state.selectedTrack = null;

    if (event.readonly || config.readOnly) {
      canvas.style.cursor = "not-allowed";
      timeline.setStatus(`已选中: ${event.title}`);

      if (timeline.callbacks.onEventHighlight) {
        timeline.callbacks.onEventHighlight({
          trackIndex,
          eventIndex,
          event: cloneEvent(event),
        });
      }

      if (timeline.callbacks.onEventClick) {
        timeline.callbacks.onEventClick({
          trackIndex,
          eventIndex,
          event: cloneEvent(event),
          trackName: `轨道 ${trackIndex + 1}`,
          formattedTimeRange: formatTimeRange(event.startTime, event.endTime),
        });
      }

      timeline.notifyChange("selection:change");
      return null;
    }

    const eventX =
      config.startPaddingTime +
      (event.startTime - config.startTime) *
        config.secondWidth *
        state.zoomLevel -
      state.scrollX;
    const eventY =
      config.timelineHeight +
      config.firstTrackTopMargin +
      trackIndex * (config.trackHeight + config.trackMargin);

    state.draggingEvent = {
      trackIndex,
      eventIndex,
      eventX,
      eventY,
      originalTrackIndex: trackIndex,
      originalEventIndex: eventIndex,
      originalStartTime: event.startTime,
      startX: logicalX,
      startY: logicalY,
      isDragging: false,
    };
    state.dragOffsetX = logicalX - eventX;
    state.dragOffsetY = logicalY - eventY;

    if (timeline.callbacks.onEventHighlight) {
      timeline.callbacks.onEventHighlight({
        trackIndex,
        eventIndex,
        event: cloneEvent(event),
      });
    }

    timeline.notifyChange("selection:change");
    return this.delegate.createDraggingState();
  }
}
