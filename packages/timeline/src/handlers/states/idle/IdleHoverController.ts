import { getSnapInterval, getTimeX, snapToInterval } from "../../../utils";
import type { Timeline } from "../../../core/Timeline";
import type { InteractionState, MouseEventContext } from "../InteractionState";
import type { IdleStateDelegate } from "./IdleShared";

export class IdleHoverController {
  constructor(private readonly delegate: IdleStateDelegate) {}

  public handleMouseMove(ctx: MouseEventContext): InteractionState | null {
    const timeline = this.delegate.getTimeline();
    const { config, state } = timeline;
    const { canvasX, canvasY, logicalX, logicalY } = ctx;
    const canvas = timeline.getCanvas();

    const menuHandled = this.handleContextMenuHover(canvasX, canvasY);
    if (menuHandled) {
      return null;
    }

    const hitResult = timeline.getInteractionTarget(canvasX, canvasY);

    if (logicalY >= config.timelineHeight && !config.readOnly) {
      const contentHandled = this.handleContentHover(
        hitResult,
        logicalX,
        canvas
      );
      if (contentHandled) {
        return null;
      }
    }

    const indicatorHandled = this.handleTimeIndicatorHover(canvasX, canvasY);
    if (indicatorHandled) {
      return null;
    }

    if (
      hitResult.eventIndex !== null &&
      hitResult.trackIndex !== null &&
      !hitResult.resizeEdge
    ) {
      const event = state.tracks[hitResult.trackIndex].events[hitResult.eventIndex];
      canvas.style.cursor = "pointer";
      timeline.setStatus(
        `${event.title} (${timeline.formatTime(event.startTime)} - ${timeline.formatTime(
          event.endTime
        )})`
      );
      return null;
    }

    canvas.style.cursor = "default";
    return null;
  }

  private handleContextMenuHover(
    canvasX: number,
    canvasY: number
  ): boolean {
    const timeline = this.delegate.getTimeline();
    const { config, state } = timeline;
    const canvas = timeline.getCanvas();

    if (!state.contextMenuVisible || !state.contextMenuBounds) {
      return false;
    }

    const menuBounds = state.contextMenuBounds;
    const isInsideMenu =
      canvasX >= menuBounds.x &&
      canvasX <= menuBounds.x + menuBounds.width &&
      canvasY >= menuBounds.y &&
      canvasY <= menuBounds.y + menuBounds.height;

    if (!isInsideMenu) {
      if (state.hoveredContextMenuItem !== -1) {
        state.hoveredContextMenuItem = -1;
        timeline.notifyChange("interaction:contextMenu");
      }
      return false;
    }

    const itemIndex = Math.floor(
      (canvasY - menuBounds.y - menuBounds.padding) / menuBounds.itemHeight
    );

    if (itemIndex >= 0 && itemIndex < config.contextMenuItems.length) {
      if (state.hoveredContextMenuItem !== itemIndex) {
        state.hoveredContextMenuItem = itemIndex;
        timeline.notifyChange("interaction:contextMenu");
      }
      canvas.style.cursor = "pointer";
      return true;
    }

    if (state.hoveredContextMenuItem !== -1) {
      state.hoveredContextMenuItem = -1;
      timeline.notifyChange("interaction:contextMenu");
    }

    return true;
  }

  private handleContentHover(
    hitResult: ReturnType<Timeline["getInteractionTarget"]>,
    logicalX: number,
    canvas: HTMLCanvasElement
  ): boolean {
    const timeline = this.delegate.getTimeline();
    const { config, state } = timeline;

    if (config.enableEventResize && hitResult.resizeEdge) {
      const event =
        state.tracks[hitResult.trackIndex!].events[hitResult.eventIndex!];

      if (event.readonly) {
        state.hoveredResizeHandle = null;
        canvas.style.cursor = "not-allowed";
        timeline.hideSplitLine();
        timeline.notifyChange("interaction:hover");
        return true;
      }

      state.hoveredResizeHandle = {
        trackIndex: hitResult.trackIndex!,
        eventIndex: hitResult.eventIndex!,
        edge: hitResult.resizeEdge,
      };
      canvas.style.cursor = "ew-resize";
      timeline.hideSplitLine();
      timeline.notifyChange("interaction:hover");
      return true;
    }

    state.hoveredResizeHandle = null;

    if (!config.enableEventSplit) {
      timeline.hideSplitLine();
      return false;
    }

    if (
      hitResult.eventIndex === null ||
      hitResult.trackIndex === null ||
      hitResult.resizeEdge
    ) {
      timeline.hideSplitLine();
      return false;
    }

    const trackIndex = hitResult.trackIndex;
    const eventIndex = hitResult.eventIndex;
    const event = state.tracks[trackIndex].events[eventIndex];

    if (event.readonly) {
      timeline.hideSplitLine();
      canvas.style.cursor = "not-allowed";
      timeline.notifyChange("interaction:hover");
      return true;
    }

    let splitTime =
      (logicalX - config.startPaddingTime) /
        (config.secondWidth * state.zoomLevel) +
      config.startTime;

    if (state.snapEnabled) {
      const snapIntervalSeconds = getSnapInterval(
        state.zoomLevel,
        config.snapInterval,
        config.snapToSeconds,
        config.secondPrecisionZoomThreshold,
        config.scale,
        config.scaleSplitCount
      );
      splitTime = snapToInterval(splitTime, snapIntervalSeconds);
    }

    const firstDuration = splitTime - event.startTime;
    const secondDuration = event.duration - firstDuration;
    const canShowSplitLine =
      splitTime > event.startTime &&
      splitTime < event.startTime + event.duration &&
      firstDuration >= config.minEventDuration &&
      secondDuration >= config.minEventDuration;

    if (!canShowSplitLine) {
      timeline.hideSplitLine();
      return false;
    }

    timeline.showSplitLine(trackIndex, eventIndex, splitTime);
    canvas.style.cursor = "pointer";
    timeline.notifyChange("interaction:splitLine");
    return true;
  }

  private handleTimeIndicatorHover(
    canvasX: number,
    canvasY: number
  ): boolean {
    const timeline = this.delegate.getTimeline();
    const { config, state } = timeline;
    const canvas = timeline.getCanvas();

    if (!config.enableTimeIndicator || canvasY > config.timelineHeight) {
      return false;
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
    const isHovered =
      canvasX >= timeIndicatorX - headSize / 2 &&
      canvasX <= timeIndicatorX + headSize / 2 &&
      canvasY >= 0 &&
      canvasY <= config.timeIndicatorHeadSize;

    if (!isHovered) {
      return false;
    }

    canvas.style.cursor = config.readOnly ? "not-allowed" : "ew-resize";
    return true;
  }
}
