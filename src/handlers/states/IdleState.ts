import {
  BaseState,
  type InteractionState,
  type MouseEventContext,
} from "./InteractionState";
import type { Timeline } from "../../core/Timeline";
import {
  cloneEvent,
  formatTimeRange,
  getTimeX,
  getSnapInterval,
  snapToInterval,
} from "../../utils";
import { DraggingState } from "./DraggingState";
import { ResizingState } from "./ResizingState";
import { ScrollingState } from "./ScrollingState";
import { TimeIndicatorDragState } from "./TimeIndicatorDragState";

/**
 * 空闲状态 - 没有进行任何交互操作
 * 负责:
 * - 检测鼠标悬停效果
 * - 检测是否点击了可交互元素(事件、滚动条、时间指示器等)
 * - 切换到对应的交互状态
 */
export class IdleState extends BaseState {
  readonly name = "Idle";

  constructor(timeline: Timeline) {
    super(timeline);
  }

  handleMouseDown(ctx: MouseEventContext): InteractionState | null {
    const {
      canvasX,
      canvasY,
      logicalX,
      logicalY,
      canvasWidth,
      canvasHeight,
      originalEvent,
    } = ctx;
    const config = this.timeline.config;
    const state = this.timeline.state;
    const canvas = this.timeline.getCanvas();
    const isReadOnly = config.readOnly;

    // 如果是右键点击,不处理任何交互,等待 contextmenu 事件
    if (originalEvent.button === 2) {
      return null;
    }

    // 处理上下文菜单点击
    if (state.contextMenuVisible) {
      const menuBounds = state.contextMenuBounds;
      if (menuBounds) {
        const menuX = menuBounds.x;
        const menuY = menuBounds.y;
        const menuWidth = menuBounds.width;
        const menuHeight = menuBounds.height;

        if (
          canvasX >= menuX &&
          canvasX <= menuX + menuWidth &&
          canvasY >= menuY &&
          canvasY <= menuY + menuHeight
        ) {
          const itemIndex = Math.floor(
            (canvasY - menuY - menuBounds.padding) / menuBounds.itemHeight
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
              this.timeline.setStatus("只读事件不可编辑或删除");
              state.contextMenuVisible = false;
              state.contextMenuEvent = null;
              this.timeline.draw();
              return null;
            }

            if (this.timeline.callbacks.onContextMenu) {
              this.timeline.callbacks.onContextMenu({
                menuType: menuItem.type,
                trackIndex,
                eventIndex,
                event: cloneEvent(event),
              });
            }

            state.contextMenuVisible = false;
            state.contextMenuEvent = null;
            this.timeline.draw();
          }
          return null;
        } else {
          // 点击菜单外部,关闭菜单
          state.contextMenuVisible = false;
          state.contextMenuEvent = null;
          this.timeline.draw();
        }
      }
    }

    // 检查垂直滚动条
    const contentHeight =
      config.timelineHeight +
      config.firstTrackTopMargin +
      state.tracks.length * (config.trackHeight + config.trackMargin);
    const availableHeight = this.timeline.getAvailableHeight();

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

        // 导入并切换到滚动状态
        return this.createScrollingState();
      }
    }

    // 检查水平滚动条
    const contentWidth = this.timeline.getContentWidthForZoom(state.zoomLevel);
    if (contentWidth > canvasWidth) {
      const scrollbarHeight = 8;
      const scrollbarY = canvasHeight - scrollbarHeight - 5;
      const scrollbarX = 0;
      const scrollbarTrackWidth = canvasWidth;

      if (
        canvasY >= scrollbarY &&
        canvasY <= scrollbarY + scrollbarHeight &&
        canvasX >= scrollbarX &&
        canvasX <= scrollbarX + scrollbarTrackWidth
      ) {
        state.draggingHorizontalScrollbar = true;
        const viewportRatio = canvasWidth / contentWidth;
        const handleWidth = Math.max(30, scrollbarTrackWidth * viewportRatio);
        const maxScrollX = contentWidth - canvasWidth;
        const scrollRatio = state.scrollX / maxScrollX;
        const handleX =
          scrollbarX + (scrollbarTrackWidth - handleWidth) * scrollRatio;
        state.horizontalScrollbarDragOffset = canvasX - handleX;

        return this.createScrollingState();
      }
    }

    // 检查时间指示器
    if (config.enableTimeIndicator && !isReadOnly) {
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

      if (
        canvasX >= timeIndicatorX - headSize / 2 &&
        canvasX <= timeIndicatorX + headSize / 2 &&
        canvasY >= headY &&
        canvasY <= config.timelineHeight
      ) {
        state.draggingTimeIndicator = true;
        state.timeIndicatorDragOffsetX = canvasX - timeIndicatorX;

        return this.createTimeIndicatorDragState();
      }
    }

    // 如果点击在时间轴区域,不处理
    if (logicalY < config.timelineHeight) return null;

    // 检查是否点击了事件的调整手柄
    if (config.enableEventResize && !isReadOnly) {
      const handle = this.timeline.getResizeHandle(logicalX, logicalY);
      if (handle) {
        const event = state.tracks[handle.trackIndex].events[handle.eventIndex];
        if (event.readonly) {
          canvas.style.cursor = "not-allowed";
          return null;
        }

        state.resizingEvent = {
          trackIndex: handle.trackIndex,
          eventIndex: handle.eventIndex,
          edge: handle.edge,
          startX: logicalX,
          originalStartTime: event.startTime,
          originalDuration: event.duration,
        };

        return this.createResizingState();
      }
    }

    // 8. 检查是否点击了事件
    const clickedEvent = this.timeline.getEventAtPosition(canvasX, canvasY);
    if (clickedEvent) {
      const { trackIndex, eventIndex } = clickedEvent;
      const event = state.tracks[trackIndex].events[eventIndex];

      // 双击检测
      const now = Date.now();
      const isDoubleClick =
        state.lastClickEvent &&
        state.lastClickEvent.trackIndex === trackIndex &&
        state.lastClickEvent.eventIndex === eventIndex &&
        now - state.lastClickTime < 300;

      if (isDoubleClick && config.enableEventSplit) {
        if (event.readonly) {
          this.timeline.setStatus("只读事件不可切割");
          state.lastClickTime = 0;
          state.lastClickEvent = null;
          return null;
        }

        const clickTime =
          (logicalX + state.scrollX - config.startPaddingTime) /
            (config.secondWidth * state.zoomLevel) +
          config.startTime;
        this.timeline.splitEvent(trackIndex, eventIndex, clickTime);
        state.lastClickTime = 0;
        state.lastClickEvent = null;
        this.timeline.hideSplitLine();
        this.timeline.draw();
        return null;
      }

      state.lastClickEvent = { trackIndex, eventIndex };
      state.lastClickTime = now;
      state.selectedEvent = { trackIndex, eventIndex };
      state.isManualSelection = true;
      state.highlightedEvent = null;
      state.selectedTrack = null;

      // 只读事件或全局只读模式:仅选中,不拖拽
      if (event.readonly || isReadOnly) {
        this.timeline.setStatus(`已选中: ${event.title}`);
        if (this.timeline.callbacks.onEventHighlight) {
          this.timeline.callbacks.onEventHighlight({
            trackIndex,
            eventIndex,
            event: cloneEvent(event),
          });
        }
        if (this.timeline.callbacks.onEventClick) {
          this.timeline.callbacks.onEventClick({
            trackIndex,
            eventIndex,
            event: cloneEvent(event),
            trackName: `轨道 ${trackIndex + 1}`,
            formattedTimeRange: formatTimeRange(event.startTime, event.endTime),
          });
        }
        this.timeline.draw();
        return null;
      }

      // 准备拖拽事件
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

      if (this.timeline.callbacks.onEventHighlight) {
        this.timeline.callbacks.onEventHighlight({
          trackIndex,
          eventIndex,
          event: cloneEvent(event),
        });
      }

      this.timeline.draw();
      return this.createDraggingState();
    }

    // 9. 点击空白区域:清除选择
    state.selectedEvent = null;
    state.highlightedEvent = null;
    state.selectedTrack = null;
    state.isManualSelection = false;

    if (this.timeline.callbacks.onEventHighlight) {
      this.timeline.callbacks.onEventHighlight({
        trackIndex: null,
        eventIndex: null,
        event: null,
      });
    }

    this.timeline.draw();
    return null;
  }

  handleMouseMove(ctx: MouseEventContext): InteractionState | null {
    const { canvasX, canvasY, logicalX, logicalY } = ctx;
    const config = this.timeline.config;
    const state = this.timeline.state;
    const canvas = this.timeline.getCanvas();

    // 1. 上下文菜单悬停
    if (state.contextMenuVisible) {
      const menuBounds = state.contextMenuBounds;
      if (menuBounds) {
        const menuX = menuBounds.x;
        const menuY = menuBounds.y;
        const menuWidth = menuBounds.width;
        const menuHeight = menuBounds.height;

        if (
          canvasX >= menuX &&
          canvasX <= menuX + menuWidth &&
          canvasY >= menuY &&
          canvasY <= menuY + menuHeight
        ) {
          const itemIndex = Math.floor(
            (canvasY - menuY - menuBounds.padding) / menuBounds.itemHeight
          );
          if (itemIndex >= 0 && itemIndex < config.contextMenuItems.length) {
            if (state.hoveredContextMenuItem !== itemIndex) {
              state.hoveredContextMenuItem = itemIndex;
              this.timeline.draw();
            }
            canvas.style.cursor = "pointer";
          } else {
            if (state.hoveredContextMenuItem !== -1) {
              state.hoveredContextMenuItem = -1;
              this.timeline.draw();
            }
          }
          return null;
        } else {
          if (state.hoveredContextMenuItem !== -1) {
            state.hoveredContextMenuItem = -1;
            this.timeline.draw();
          }
        }
      }
    }

    // 2. 内容区域的交互
    if (logicalY >= config.timelineHeight && !config.readOnly) {
      // 2.1 检查调整大小手柄
      if (config.enableEventResize) {
        const handle = this.timeline.getResizeHandle(logicalX, logicalY);
        if (handle) {
          const evt = state.tracks[handle.trackIndex].events[handle.eventIndex];
          if (evt.readonly) {
            state.hoveredResizeHandle = null;
            canvas.style.cursor = "not-allowed";
            this.timeline.hideSplitLine();
            this.timeline.draw();
            return null;
          }

          state.hoveredResizeHandle = handle;
          canvas.style.cursor = "ew-resize";
          this.timeline.hideSplitLine();
          this.timeline.draw();
          return null;
        }
        state.hoveredResizeHandle = null;
      }

      // 2.2 检查事件切割线
      if (config.enableEventSplit) {
        const clickedEvent = this.timeline.getEventAtPosition(
          logicalX,
          logicalY
        );
        if (clickedEvent) {
          const { trackIndex, eventIndex } = clickedEvent;
          const event = state.tracks[trackIndex].events[eventIndex];

          if (event.readonly) {
            this.timeline.hideSplitLine();
            canvas.style.cursor = "not-allowed";
            this.timeline.draw();
            return null;
          }

          let splitTime =
            (logicalX + state.scrollX - config.startPaddingTime) /
              (config.secondWidth * state.zoomLevel) +
            config.startTime;

          if (state.snapEnabled) {
            const snapIntervalSeconds = getSnapInterval(
              state.zoomLevel,
              config.snapInterval,
              config.snapToSeconds,
              config.secondPrecisionZoomThreshold
            );
            splitTime = snapToInterval(splitTime, snapIntervalSeconds);
          }

          const firstDuration = splitTime - event.startTime;
          const secondDuration = event.duration - firstDuration;

          if (
            splitTime > event.startTime &&
            splitTime < event.startTime + event.duration &&
            firstDuration >= config.minEventDuration &&
            secondDuration >= config.minEventDuration
          ) {
            this.timeline.showSplitLine(trackIndex, eventIndex, splitTime);
            canvas.style.cursor = "pointer";
            this.timeline.draw();
            return null;
          }
        }
        this.timeline.hideSplitLine();
      } else {
        this.timeline.hideSplitLine();
      }
    }

    // 3. 时间指示器悬停
    if (config.enableTimeIndicator && canvasY <= config.timelineHeight) {
      const timeIndicatorX = getTimeX(
        state.timeIndicatorPosition,
        config.startTime,
        config.startPaddingTime,
        config.secondWidth,
        state.zoomLevel,
        state.scrollX
      );
      const headSize = config.timeIndicatorHeadSize;

      if (
        canvasX >= timeIndicatorX - headSize / 2 &&
        canvasX <= timeIndicatorX + headSize / 2 &&
        canvasY >= 0 &&
        canvasY <= config.timeIndicatorHeadSize
      ) {
        canvas.style.cursor = config.readOnly ? "not-allowed" : "ew-resize";
        this.timeline.draw();
        return null;
      }
    }

    // 4. 事件悬停
    const hoveredEvent = this.timeline.getEventAtPosition(canvasX, canvasY);
    if (hoveredEvent) {
      const { trackIndex, eventIndex } = hoveredEvent;
      const event = state.tracks[trackIndex].events[eventIndex];
      // 只读模式下仍然可以点击选中，所以显示 pointer
      canvas.style.cursor = "pointer";
      this.timeline.setStatus(
        `${event.title} (${this.timeline.formatTime(
          event.startTime
        )} - ${this.timeline.formatTime(event.endTime)})`
      );
    } else {
      canvas.style.cursor = "default";
    }

    this.timeline.draw();
    return null;
  }

  handleContextMenu(ctx: MouseEventContext): InteractionState | null {
    ctx.originalEvent.preventDefault();
    const { canvasX, canvasY } = ctx;
    const config = this.timeline.config;
    const state = this.timeline.state;

    // 只有在加载了 ContextMenuPlugin 时才响应右键菜单
    if (
      !config.enableContextMenu ||
      config.readOnly ||
      !this.timeline.isPluginLoaded("context-menu")
    ) {
      return null;
    }

    const clickedEvent = this.timeline.getEventAtPosition(canvasX, canvasY);
    if (clickedEvent) {
      const { trackIndex, eventIndex } = clickedEvent;
      state.contextMenuEvent = { trackIndex, eventIndex };
      state.contextMenuVisible = true;
      state.contextMenuX = canvasX;
      state.contextMenuY = canvasY;
      state.hoveredContextMenuItem = -1;
      this.timeline.draw();
    } else {
      state.contextMenuVisible = false;
      state.contextMenuEvent = null;
      this.timeline.draw();
    }

    return null;
  }

  /**
   * 创建拖拽状态
   */
  private createDraggingState(): InteractionState {
    return new DraggingState(this.timeline);
  }

  /**
   * 创建调整大小状态
   */
  private createResizingState(): InteractionState {
    return new ResizingState(this.timeline);
  }

  /**
   * 创建滚动状态
   */
  private createScrollingState(): InteractionState {
    return new ScrollingState(this.timeline);
  }

  /**
   * 创建时间指示器拖拽状态
   */
  private createTimeIndicatorDragState(): InteractionState {
    return new TimeIndicatorDragState(this.timeline);
  }
}
