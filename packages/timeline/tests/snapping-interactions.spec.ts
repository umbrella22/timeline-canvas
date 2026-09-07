import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { Timeline } from "../src";
import { MouseHandler } from "../src/handlers/MouseHandler";
import { createMockCanvas } from "./helpers";

let timelineId = 0;

interface SnapScenario {
  name: string;
  zoomLevel: number;
  options?: ConstructorParameters<typeof Timeline>[1];
}

const snapScenarios: SnapScenario[] = [
  { name: "low zoom", zoomLevel: 1 },
  { name: "medium zoom", zoomLevel: 3 },
  { name: "high zoom", zoomLevel: 10 },
  {
    name: "custom scale",
    zoomLevel: 3,
    options: { scale: 60, scaleSplitCount: 10 },
  },
];

function createTimeline(
  options: ConstructorParameters<typeof Timeline>[1] = {}
): Timeline {
  const id = `snapping-interactions-${timelineId++}`;
  createMockCanvas(id, 1200, 180);
  return new Timeline(id, {
    autoFitOnInit: false,
    autoAddTrack: false,
    autoRemoveEmptyLastTrack: false,
    enableEventSplit: false,
    enableTimeIndicator: false,
    startTime: 0,
    endTime: 100,
    startPaddingTime: 0,
    secondWidth: 2,
    timelineHeight: 20,
    trackHeight: 40,
    firstTrackTopMargin: 0,
    trackMargin: 10,
    resizeHandleWidth: 8,
    snapToSeconds: true,
    ...options,
  });
}

function mouseEvent(type: string, x: number, y: number): MouseEvent {
  return new MouseEvent(type, { button: 0, clientX: x, clientY: y });
}

function freezeAnimationFrame(): void {
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((_callback: FrameRequestCallback) => 1)
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
}

function pixelsPerSecond(timeline: Timeline): number {
  return timeline.config.secondWidth * timeline.state.zoomLevel;
}

function dragEventTo(timeline: Timeline, targetStartTime: number): void {
  const event = timeline.state.tracks[0].events[0];
  const handler = new MouseHandler(timeline);
  const pxPerSecond = pixelsPerSecond(timeline);
  const y = timeline.config.timelineHeight + timeline.config.trackHeight / 2;
  const downX = (event.startTime + event.duration / 2) * pxPerSecond;
  const moveX =
    downX + (targetStartTime - event.startTime) * pxPerSecond;

  handler.handleMouseDown(mouseEvent("mousedown", downX, y));
  expect(handler.getCurrentStateName()).toBe("Dragging");
  handler.handleMouseMove(mouseEvent("mousemove", moveX, y));
  handler.handleMouseUp(mouseEvent("mouseup", moveX, y));
}

function resizeEventTo(
  timeline: Timeline,
  edge: "left" | "right",
  targetTime: number
): void {
  const event = timeline.state.tracks[0].events[0];
  const handler = new MouseHandler(timeline);
  const pxPerSecond = pixelsPerSecond(timeline);
  const y = timeline.config.timelineHeight + timeline.config.trackHeight / 2;
  const originalEdgeTime = edge === "left" ? event.startTime : event.endTime;
  const downX = originalEdgeTime * pxPerSecond;
  const moveX = downX + (targetTime - originalEdgeTime) * pxPerSecond;

  handler.handleMouseDown(mouseEvent("mousedown", downX, y));
  expect(handler.getCurrentStateName()).toBe("Resizing");
  handler.handleMouseMove(mouseEvent("mousemove", moveX, y));
  handler.handleMouseUp(mouseEvent("mouseup", moveX, y));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("snapping interactions", () => {
  it.each(snapScenarios)(
    "snaps event dragging to one second at $name",
    ({ zoomLevel, options }) => {
      const timeline = createTimeline(options);
      timeline.state.zoomLevel = zoomLevel;
      timeline.loadData({
        tracks: [
          { events: [{ startTime: 10, endTime: 20, title: "drag target" }] },
        ],
      });
      freezeAnimationFrame();

      dragEventTo(timeline, 13.4);

      expect(timeline.state.tracks[0].events[0]).toMatchObject({
        startTime: 13,
        endTime: 23,
      });
    }
  );

  it.each(snapScenarios)(
    "snaps the left resize edge to one second at $name",
    ({ zoomLevel, options }) => {
      const timeline = createTimeline(options);
      timeline.state.zoomLevel = zoomLevel;
      timeline.loadData({
        tracks: [
          { events: [{ startTime: 20, endTime: 40, title: "left resize" }] },
        ],
      });
      freezeAnimationFrame();

      resizeEventTo(timeline, "left", 23.4);

      expect(timeline.state.tracks[0].events[0]).toMatchObject({
        startTime: 23,
        endTime: 40,
        duration: 17,
      });
    }
  );

  it.each(snapScenarios)(
    "snaps the right resize edge to one second at $name",
    ({ zoomLevel, options }) => {
      const timeline = createTimeline(options);
      timeline.state.zoomLevel = zoomLevel;
      timeline.loadData({
        tracks: [
          { events: [{ startTime: 20, endTime: 40, title: "right resize" }] },
        ],
      });
      freezeAnimationFrame();

      resizeEventTo(timeline, "right", 43.4);

      expect(timeline.state.tracks[0].events[0]).toMatchObject({
        startTime: 20,
        endTime: 43,
        duration: 23,
      });
    }
  );

  it("keeps magnetic snapping between events while dragging", () => {
    const timeline = createTimeline();
    timeline.loadData({
      tracks: [
        { events: [{ startTime: 10, endTime: 15, title: "drag target" }] },
        {
          events: [
            { startTime: 30.25, endTime: 35.25, title: "magnetic reference" },
          ],
        },
      ],
    });
    freezeAnimationFrame();

    dragEventTo(timeline, 29.7);

    expect(timeline.state.tracks[0].events[0]).toMatchObject({
      startTime: 30.25,
      endTime: 35.25,
    });
  });

  it("keeps magnetic snapping between events while resizing", () => {
    const timeline = createTimeline();
    timeline.loadData({
      tracks: [
        { events: [{ startTime: 20, endTime: 25, title: "resize target" }] },
        {
          events: [
            { startTime: 30.25, endTime: 35.25, title: "magnetic reference" },
          ],
        },
      ],
    });
    freezeAnimationFrame();

    resizeEventTo(timeline, "right", 29.7);

    expect(timeline.state.tracks[0].events[0]).toMatchObject({
      startTime: 20,
      endTime: 30.25,
      duration: 10.25,
    });
  });

  it("keeps continuous event times when snapping is disabled", () => {
    const dragTimeline = createTimeline();
    dragTimeline.state.snapEnabled = false;
    dragTimeline.loadData({
      tracks: [
        { events: [{ startTime: 10, endTime: 20, title: "continuous drag" }] },
      ],
    });
    freezeAnimationFrame();

    dragEventTo(dragTimeline, 13.375);

    expect(dragTimeline.state.tracks[0].events[0].startTime).toBeCloseTo(
      13.375
    );

    const leftTimeline = createTimeline();
    leftTimeline.state.snapEnabled = false;
    leftTimeline.loadData({
      tracks: [
        { events: [{ startTime: 20, endTime: 40, title: "continuous left" }] },
      ],
    });
    resizeEventTo(leftTimeline, "left", 23.375);

    expect(leftTimeline.state.tracks[0].events[0].startTime).toBeCloseTo(
      23.375
    );

    const rightTimeline = createTimeline();
    rightTimeline.state.snapEnabled = false;
    rightTimeline.loadData({
      tracks: [
        { events: [{ startTime: 20, endTime: 40, title: "continuous right" }] },
      ],
    });
    resizeEventTo(rightTimeline, "right", 43.375);

    expect(rightTimeline.state.tracks[0].events[0].endTime).toBeCloseTo(43.375);
  });
});
