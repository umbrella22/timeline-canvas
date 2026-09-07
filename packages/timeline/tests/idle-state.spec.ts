import { describe, expect, it, vi } from "vite-plus/test";

import { Timeline } from "../src";
import { IdleState } from "../src/handlers/states/IdleState";
import type { MouseEventContext } from "../src/handlers/states/InteractionState";
import { DraggingState } from "../src/handlers/states/DraggingState";
import { ResizingState } from "../src/handlers/states/ResizingState";
import { ScrollingState } from "../src/handlers/states/ScrollingState";
import { TimeIndicatorDragState } from "../src/handlers/states/TimeIndicatorDragState";
import { createMockCanvas } from "./helpers";

function createTimeline(
  options: ConstructorParameters<typeof Timeline>[1] = {}
): Timeline {
  createMockCanvas("idle-timeline", 200, 120);
  return new Timeline("idle-timeline", {
    autoFitOnInit: false,
    startTime: 0,
    endTime: 100,
    startPaddingTime: 0,
    secondWidth: 10,
    timelineHeight: 20,
    trackHeight: 40,
    firstTrackTopMargin: 0,
    trackMargin: 10,
    ...options,
  });
}

function createMouseContext(
  x: number,
  y: number,
  button = 0
): MouseEventContext {
  return {
    canvasX: x,
    canvasY: y,
    logicalX: x,
    logicalY: y,
    originalEvent: new MouseEvent("mousedown", {
      button,
      clientX: x,
      clientY: y,
    }),
    canvasWidth: 200,
    canvasHeight: 120,
  };
}

describe("IdleState", () => {
  it("命中事件主体时切换到 DraggingState", () => {
    const timeline = createTimeline();
    const idleState = new IdleState(timeline);

    timeline.loadData({
      tracks: [
        {
          events: [{ startTime: 10, endTime: 20, title: "可拖拽事件" }],
        },
      ],
    });

    const nextState = idleState.handleMouseDown(createMouseContext(150, 30));

    expect(nextState).toBeInstanceOf(DraggingState);
    expect(timeline.state.selectedEvent).toEqual({ trackIndex: 0, eventIndex: 0 });
  });

  it("命中 resize handle 时切换到 ResizingState", () => {
    const timeline = createTimeline({ resizeHandleWidth: 8 });
    const idleState = new IdleState(timeline);

    timeline.loadData({
      tracks: [
        {
          events: [{ startTime: 10, endTime: 20, title: "可缩放事件" }],
        },
      ],
    });

    const hitTarget = timeline.getInteractionTarget(100, 30);
    const nextState = idleState.handleMouseDown(createMouseContext(100, 30));

    expect(hitTarget.resizeEdge).toBe("left");
    expect(nextState).toBeInstanceOf(ResizingState);
    expect(timeline.state.resizingEvent?.eventIndex).toBe(0);
  });

  it("命中水平滚动条时切换到 ScrollingState", () => {
    const timeline = createTimeline();
    const idleState = new IdleState(timeline);

    const nextState = idleState.handleMouseDown(createMouseContext(20, 110));

    expect(nextState).toBeInstanceOf(ScrollingState);
    expect(timeline.state.draggingHorizontalScrollbar).toBe(true);
  });

  it("命中时间指示器头部时切换到 TimeIndicatorDragState", () => {
    const timeline = createTimeline();
    const idleState = new IdleState(timeline);

    timeline.setTimeIndicator(5);
    const nextState = idleState.handleMouseDown(createMouseContext(50, 10));

    expect(nextState).toBeInstanceOf(TimeIndicatorDragState);
    expect(timeline.state.draggingTimeIndicator).toBe(true);
  });

  it("只读事件保持选中并阻止拖拽", () => {
    const onEventClick = vi.fn();
    const timeline = createTimeline({ onEventClick });
    const idleState = new IdleState(timeline);

    timeline.loadData({
      tracks: [
        {
          events: [
            { startTime: 10, endTime: 20, title: "只读事件", readonly: true },
          ],
        },
      ],
    });

    const nextState = idleState.handleMouseDown(createMouseContext(150, 30));

    expect(nextState).toBeNull();
    expect(timeline.state.draggingEvent).toBeNull();
    expect(timeline.state.selectedEvent).toEqual({ trackIndex: 0, eventIndex: 0 });
    expect(onEventClick).toHaveBeenCalledTimes(1);
  });

  it("全局只读在 UI 边界阻止双击切割但保留程序化切割 API", () => {
    const timeline = createTimeline({ readOnly: true, enableEventSplit: true });
    const idleState = new IdleState(timeline);

    timeline.loadData({
      tracks: [
        {
          events: [{ startTime: 10, endTime: 20, title: "普通事件" }],
        },
      ],
    });

    idleState.handleMouseDown(createMouseContext(150, 30));
    idleState.handleMouseDown(createMouseContext(150, 30));

    expect(timeline.state.tracks[0].events).toHaveLength(1);
    expect(timeline.splitEvent(0, 0, 15)).toBe(true);
    expect(timeline.state.tracks[0].events).toHaveLength(2);
  });

  it("事件只读阻止双击切割", () => {
    const timeline = createTimeline({ enableEventSplit: true });
    const idleState = new IdleState(timeline);

    timeline.loadData({
      tracks: [
        {
          events: [
            { startTime: 10, endTime: 20, title: "只读事件", readonly: true },
          ],
        },
      ],
    });

    idleState.handleMouseDown(createMouseContext(150, 30));
    idleState.handleMouseDown(createMouseContext(150, 30));

    expect(timeline.state.tracks[0].events).toHaveLength(1);
  });

  it("可编辑事件仍可通过双击切割", () => {
    const timeline = createTimeline({ enableEventSplit: true });
    const idleState = new IdleState(timeline);

    timeline.loadData({
      tracks: [
        {
          events: [{ startTime: 10, endTime: 20, title: "可编辑事件" }],
        },
      ],
    });

    idleState.handleMouseDown(createMouseContext(150, 30));
    idleState.handleMouseDown(createMouseContext(150, 30));

    expect(timeline.state.tracks[0].events).toHaveLength(2);
  });

  it("点击菜单外部时关闭上下文菜单", () => {
    const timeline = createTimeline();
    const idleState = new IdleState(timeline);

    timeline.state.contextMenuVisible = true;
    timeline.state.contextMenuEvent = { trackIndex: 0, eventIndex: 0 };
    timeline.state.contextMenuBounds = {
      x: 10,
      y: 10,
      width: 80,
      height: 60,
      itemHeight: 20,
      padding: 8,
    };

    const nextState = idleState.handleMouseDown(createMouseContext(150, 80));

    expect(nextState).toBeNull();
    expect(timeline.state.contextMenuVisible).toBe(false);
    expect(timeline.state.contextMenuEvent).toBeNull();
  });
});
