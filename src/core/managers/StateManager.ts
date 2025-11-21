import type { TimelineState, TimelineConfig } from "../../types";

export class StateManager {
  public state: TimelineState;

  constructor(config: TimelineConfig) {
    this.state = {
      tracks: [],
      selectedTrack: null,
      selectedEvent: null,
      highlightedEvent: null,
      draggingEvent: null,
      dragOffsetX: 0,
      dragOffsetY: 0,
      resizingEvent: null,
      draggingTimeIndicator: false,
      timeIndicatorDragOffsetX: 0,
      draggingScrollbar: false,
      scrollbarDragOffset: 0,
      draggingHorizontalScrollbar: false,
      horizontalScrollbarDragOffset: 0,
      zoomLevel: 1,
      scrollX: 0,
      scrollY: 0,
      snapEnabled: true,
      timeIndicatorSnapEnabled: true,
      contextMenuEvent: null,
      contextMenuVisible: false,
      contextMenuX: 0,
      contextMenuY: 0,
      hoveredContextMenuItem: -1,
      timeIndicatorPosition: config.startTime,
      timeIndicatorHighlightedEvents: [],
      isManualSelection: false,
      guideLines: [],
      dragTimeReference: null,
      hoveredResizeHandle: null,
      lastClickTime: 0,
      lastClickEvent: null,
      hoveredSplitLine: null,
      statusText: "就绪",
      contextMenuBounds: null,
      lastDrawTime: 0,
    };
  }

  setStatus(text: string, onStatusChange?: (text: string) => void): void {
    this.state.statusText = text;
    if (onStatusChange) onStatusChange(text);
  }
}