import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { Timeline } from "../src";
import { MouseHandler } from "../src/handlers/MouseHandler";
import { createMockCanvas } from "./helpers";

let timelineId = 0;

function createTimeline(
  options: ConstructorParameters<typeof Timeline>[1] = {}
): Timeline {
  const id = `mouse-handler-${timelineId++}`;
  createMockCanvas(id, 300, 120);
  return new Timeline(id, {
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

function mouseEvent(type: string, clientX: number, clientY: number): MouseEvent {
  return new MouseEvent(type, { button: 0, clientX, clientY });
}

function freezeAnimationFrame(): ReturnType<typeof vi.fn> {
  const cancelAnimationFrame = vi.fn();
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((_callback: FrameRequestCallback) => 1)
  );
  vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);
  return cancelAnimationFrame;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MouseHandler", () => {
  it("无 release 坐标时使用待提交移动而非虚拟零坐标", () => {
    const onEventMove = vi.fn();
    const timeline = createTimeline({ onEventMove, enableEventSplit: false });
    const handler = new MouseHandler(timeline);
    const cancelAnimationFrame = freezeAnimationFrame();
    timeline.state.snapEnabled = false;
    timeline.loadData({
      tracks: [
        { events: [{ startTime: 10, endTime: 20, title: "待拖拽" }] },
      ],
    });

    handler.handleMouseDown(mouseEvent("mousedown", 150, 30));
    handler.handleMouseMove(mouseEvent("mousemove", 180, 30));
    handler.handleMouseUp();

    expect(timeline.state.tracks[0].events[0].startTime).toBe(13);
    expect(onEventMove).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it("在 mouseup 前处理待提交的 resize 位置", () => {
    const onEventUpdate = vi.fn();
    const timeline = createTimeline({ onEventUpdate, resizeHandleWidth: 8 });
    const handler = new MouseHandler(timeline);
    freezeAnimationFrame();
    timeline.state.snapEnabled = false;
    timeline.loadData({
      tracks: [
        { events: [{ startTime: 10, endTime: 20, title: "待缩放" }] },
      ],
    });

    handler.handleMouseDown(mouseEvent("mousedown", 200, 30));
    handler.handleMouseMove(mouseEvent("mousemove", 230, 30));
    handler.handleMouseUp(mouseEvent("mouseup", 230, 30));

    expect(timeline.state.tracks[0].events[0].endTime).toBe(23);
    expect(onEventUpdate).toHaveBeenCalledTimes(1);
  });

  it("在 mouseup 前处理待提交的时间指示器位置", () => {
    const timeline = createTimeline();
    const handler = new MouseHandler(timeline);
    freezeAnimationFrame();
    timeline.state.snapEnabled = false;
    timeline.setTimeIndicator(5);
    const setTimeIndicator = vi.spyOn(timeline, "setTimeIndicator");

    handler.handleMouseDown(mouseEvent("mousedown", 50, 10));
    handler.handleMouseMove(mouseEvent("mousemove", 80, 10));
    handler.handleMouseUp(mouseEvent("mouseup", 80, 10));

    expect(timeline.state.timeIndicatorPosition).toBe(8);
    expect(setTimeIndicator).toHaveBeenCalledWith(8, false);
  });

  it("取消交互时丢弃待处理移动且不触发点击或完成回调", () => {
    const onEventClick = vi.fn();
    const onEventMove = vi.fn();
    const timeline = createTimeline({
      onEventClick,
      onEventMove,
      enableEventSplit: false,
    });
    const handler = new MouseHandler(timeline);
    freezeAnimationFrame();
    timeline.state.snapEnabled = false;
    timeline.loadData({
      tracks: [
        { events: [{ startTime: 10, endTime: 20, title: "取消拖拽" }] },
      ],
    });

    handler.handleMouseDown(mouseEvent("mousedown", 150, 30));
    handler.handleMouseMove(mouseEvent("mousemove", 180, 30));
    handler.handleCancel(mouseEvent("pointercancel", 180, 30));

    expect(handler.getCurrentStateName()).toBe("Idle");
    expect(timeline.state.draggingEvent).toBeNull();
    expect(timeline.state.tracks[0].events[0].startTime).toBe(10);
    expect(onEventClick).not.toHaveBeenCalled();
    expect(onEventMove).not.toHaveBeenCalled();
  });
});
