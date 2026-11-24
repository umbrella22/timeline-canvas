import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Timeline, formatTime, type TimelineOptions } from "../src";
import { snapToInterval } from "../src/utils/time";
import { createMockCanvas } from "./helpers";

const timelines: Timeline[] = [];
function fixture(options: TimelineOptions = {}, height = 178) {
  const id = `input-${timelines.length}`;
  createMockCanvas(id, 400, height);
  const t = new Timeline(id, {
    autoFitOnInit: false,
    autoAddTrack: false,
    autoRemoveEmptyLastTrack: false,
    startTime: 0,
    endTime: 600,
    startPaddingTime: 0,
    secondWidth: 1,
    trackHeight: 40,
    trackMargin: 10,
    timelineHeight: 20,
    firstTrackTopMargin: 0,
    enableTimeIndicator: false,
    ...options,
  });
  timelines.push(t);
  t.loadData({
    tracks: [
      { businessId: "A", events: [{ businessId: "X", title: "X", startTime: 20, endTime: 80 }] },
      { businessId: "B", events: [] },
    ],
  });
  return t;
}
function input(t: Timeline, type: string, x: number, y: number, buttons = 1, button = 0) {
  t.getCanvas().dispatchEvent(
    new MouseEvent(type, { clientX: x, clientY: y, buttons, button, bubbles: true }),
  );
}
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
afterEach(async () => {
  await Promise.all(timelines.splice(0).map((t) => t.destroy()));
  vi.unstubAllGlobals();
});

describe("gesture and viewport regressions", () => {
  it.each(["blur", "released", "readOnly", "destroy"])(
    "rolls back a processed cross-track frame on %s",
    async (reason) => {
      const moved = vi.fn();
      const t = fixture({ onEventMove: moved });
      t.highlightEvent(0, 0);
      const before = t.getEventByBusinessId("X");
      input(t, "mousedown", 50, 40);
      input(t, "mousemove", 125, 90);
      await frame();
      expect(t.getEventByBusinessId("X")).toMatchObject({
        resourceBusinessId: "B",
        event: { startTime: 95 },
      });
      if (reason === "blur") window.dispatchEvent(new Event("blur"));
      else if (reason === "released") input(t, "mousemove", 140, 90, 0);
      else if (reason === "readOnly") t.setReadOnly(true);
      else await t.destroy();
      expect(t.state.tracks[0].events[0]).toEqual(before!.event);
      expect(t.state.tracks[1].events).toHaveLength(0);
      expect(t.state.draggingEvent).toBeNull();
      expect(moved).not.toHaveBeenCalled();
    },
  );

  it("restores a resized event, then ignores a stationary edge click", async () => {
    const updated = vi.fn();
    const t = fixture({ onEventUpdate: updated });
    input(t, "mousedown", 80, 40);
    input(t, "mousemove", 110, 40);
    await frame();
    expect(t.state.tracks[0].events[0].endTime).toBe(110);
    window.dispatchEvent(new Event("blur"));
    input(t, "mousedown", 80, 40);
    input(t, "mouseup", 80, 40, 0);
    expect(t.state.tracks[0].events[0]).toMatchObject({ startTime: 20, endTime: 80, duration: 60 });
    expect(updated).not.toHaveBeenCalled();
  });

  it("keeps a committed legacy move addressable after both track indexes were warm", async () => {
    const t = fixture();
    expect(t.getEventByBusinessId("X")?.trackIndex).toBe(0);
    input(t, "mousedown", 50, 40);
    input(t, "mousemove", 125, 90);
    input(t, "mouseup", 125, 90, 0);
    expect(t.getEventByBusinessId("X")?.trackIndex).toBe(1);
    expect(t.updateEventByBusinessId("X", { title: "moved" }).ok).toBe(true);
    expect(t.deleteEventByBusinessId("X").ok).toBe(true);
    expect(t.state.tracks[1].events).toHaveLength(0);
  });

  it.each([
    [50, 81, 36, 96],
    [80, 111, 20, 96],
    [20, 51, 36, 80],
  ])("snaps a scheduled gesture from %s to %s", async (from, to, start, end) => {
    const hook = vi.fn(async () => ({ accepted: true as const }));
    const t = fixture({ secondWidth: 2, scheduleEditing: { onBeforeCommit: hook } });
    input(t, "mousedown", from * 2, 40);
    input(t, "mousemove", from * 2 + to - from, 40);
    input(t, "mouseup", from * 2 + to - from, 40, 0);
    expect(hook).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(t.getEventByBusinessId("X")?.event).toMatchObject({ startTime: start, endTime: end });
  });

  it("normalizes line and page wheel deltas in both directions and clamps tiny scrollbar drags", async () => {
    const t = fixture({}, 68);
    t.addTrack();
    t.addTrack();
    const wheel = (deltaX: number, deltaY: number, deltaMode: number) =>
      t.getCanvas().dispatchEvent(new WheelEvent("wheel", { deltaX, deltaY, deltaMode }));
    wheel(2, 1, 1);
    expect([t.state.scrollX, t.state.scrollY]).toEqual([32, 16]);
    wheel(1, 1, 2);
    expect([t.state.scrollX, t.state.scrollY]).toEqual([200, 84]);
    input(t, "mousedown", 391, 25);
    input(t, "mousemove", 391, 25);
    await frame();
    expect(t.state.scrollY).toBe(84);
    expect(t.getEventAtPosition(25, 10)).toBeNull();
  });

  it("leaves a movable center on a narrow block and ignores auxiliary mouse buttons", () => {
    const t = fixture();
    t.updateEventData(0, 0, { duration: 6 });
    expect([20, 23, 26].map((x) => t.getInteractionTarget(x, 40).resizeEdge)).toEqual([
      "left",
      null,
      "right",
    ]);
    for (const button of [1, 3, 4]) {
      input(t, "mousedown", 23, 40, 4, button);
      expect(t.state.draggingEvent).toBeNull();
    }
  });

  it("emits the final highlight once at the outer batch boundary", () => {
    const highlight = vi.fn();
    const t = fixture({ enableTimeIndicator: true, onTimeIndicatorHighlight: highlight });
    t.beginChangeBatch();
    t.beginChangeBatch();
    t.addEvent(1, 100, 150, "unrelated");
    t.setTimeIndicator(25);
    t.endChangeBatch();
    expect(highlight).not.toHaveBeenCalled();
    t.endChangeBatch();
    expect(highlight).toHaveBeenCalledTimes(1);
    expect(t.state.timeIndicatorHighlightedEvents).toEqual([{ trackIndex: 0, eventIndex: 0 }]);
  });

  it("rejects non-finite timing and preserves state on invalid metadata or destruction", async () => {
    const add = vi.fn();
    const t = fixture({ onEventAdd: add });
    expect(() => t.addEvent(0, 90, 100, "invalid", "", { nested: { fn: () => 0 } })).toThrow();
    expect(t.splitEvent(0, 0, NaN)).toBe(false);
    expect(t.canMoveEvent(0, 0, 1, NaN, 60)).toBe(false);
    expect(t.setEndTime(Infinity)).toBe(false);
    t.zoom(NaN);
    expect(t.getZoomLevel()).toBe(1);
    expect(formatTime(-30)).toBe("-00:00:30");
    expect(snapToInterval(5.25, 0)).toBe(5.25);
    await t.destroy();
    t.addEvent(0, 90, 100, "late");
    t.addTrack();
    expect(t.deleteEvent(0, 0)).toBe(false);
    expect(t.state.tracks.map((track) => track.events.length)).toEqual([1, 0]);
    expect(add).not.toHaveBeenCalled();
  });

  it("keeps module debug output local when another timeline changes its debug setting", () => {
    const output = vi.spyOn(console, "debug").mockImplementation(() => {});
    const first = fixture({ debug: true });
    const second = fixture({ debug: false });
    output.mockClear();
    second.markDirty(["tracks"]);
    expect(output).not.toHaveBeenCalled();
    first.markDirty(["tracks"]);
    expect(output).toHaveBeenCalled();
    output.mockClear();
    first.setDebug(false);
    first.markDirty(["tracks"]);
    expect(output).not.toHaveBeenCalled();
  });

  it("validates geometry before connecting handlers and accepts frozen options", () => {
    createMockCanvas("frozen-options");
    const t = new Timeline("frozen-options", Object.freeze({ autoFitOnInit: false }));
    timelines.push(t);
    expect(t.config.startPaddingTime).toBe(10);
    for (const options of [
      { secondWidth: 0 },
      { endTime: Infinity },
      { scaleSplitCount: NaN },
      { trackHeight: -1 },
    ]) {
      expect(() => new Timeline("frozen-options", options)).toThrow(RangeError);
    }
  });
});
