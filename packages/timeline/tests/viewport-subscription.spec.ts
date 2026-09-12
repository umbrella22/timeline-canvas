import { describe, expect, it, vi } from "vite-plus/test";

import { Timeline } from "../src";
import { createMockCanvas } from "./helpers";

type AnyRecord = Record<string, unknown>;

function createTimeline(
  options: ConstructorParameters<typeof Timeline>[1] = {},
): Timeline {
  createMockCanvas("viewport-subscription-canvas", 400, 120);
  return new Timeline("viewport-subscription-canvas", {
    autoFitOnInit: false,
    startTime: 28800,
    endTime: 64800,
    startPaddingTime: 0,
    secondWidth: 0.05,
    trackHeight: 40,
    trackMargin: 10,
    timelineHeight: 20,
    firstTrackTopMargin: 0,
    ...options,
  });
}

function requireMethod(timeline: Timeline, name: string): (...args: unknown[]) => unknown {
  const method = (timeline as unknown as AnyRecord)[name];
  expect(
    typeof method,
    `C-05 capability: Timeline.${name} must exist`,
  ).toBe("function");
  return method.bind(timeline) as (...args: unknown[]) => unknown;
}

function loadTracks(timeline: Timeline): void {
  timeline.loadData({
    tracks: [
      { businessId: "A1", events: [{ startTime: 32400, endTime: 36000, title: "WO-1" }] },
      { businessId: "A2", events: [{ startTime: 32400, endTime: 36000, title: "WO-2" }] },
      { businessId: "A3", events: [{ startTime: 32400, endTime: 36000, title: "WO-3" }] },
    ],
  } as never);
}

describe("M1 viewport and coordinate contracts", () => {
  describe("C-05 viewport snapshot, row geometry and coordinates (T-VIEW)", () => {
    it("exposes viewport snapshot, subscription and coordinate capabilities", () => {
      const timeline = createTimeline();
      for (const name of [
        "getViewport",
        "subscribeViewport",
        "getTrackRectByBusinessId",
        "timeToX",
        "xToTime",
      ]) {
        expect(typeof (timeline as unknown as AnyRecord)[name], `Timeline.${name}`).toBe(
          "function",
        );
      }
    });

    it("returns a snapshot with logical size, scroll, zoom and visible row range", () => {
      const timeline = createTimeline();
      loadTracks(timeline);
      const getViewport = requireMethod(timeline, "getViewport") as () => AnyRecord;
      const snapshot = getViewport();
      expect(snapshot.width).toBe(400);
      expect(snapshot.height).toBe(120);
      expect(snapshot.dpr).toBe(1);
      expect(snapshot.zoomLevel).toBe(timeline.state.zoomLevel);
      expect(snapshot.trackHeight).toBe(40);
      expect(snapshot.trackMargin).toBe(10);
      expect(snapshot.timelineHeight).toBe(20);
      expect(snapshot.firstTrackTopMargin).toBe(0);
      expect(snapshot).toHaveProperty("contentRect");
      expect(snapshot).toHaveProperty("revision");
      expect(snapshot.trackCount).toBe(3);
      expect(snapshot.visibleTrackRange).toEqual([0, 1]);
    });

    it("notifies subscribers immediately and once per change", () => {
      const timeline = createTimeline();
      loadTracks(timeline);
      const listener = vi.fn();
      const subscribeViewport = requireMethod(timeline, "subscribeViewport") as (
        l: unknown,
      ) => () => void;
      subscribeViewport(listener);
      expect(listener).toHaveBeenCalledTimes(1);
      const scrollYBefore = timeline.state.scrollY;
      timeline.state.scrollY = scrollYBefore + 25;
      timeline.notifyChange("scroll:y");
      expect(listener).toHaveBeenCalledTimes(2);
      const snapshot = listener.mock.calls[1][0] as AnyRecord;
      expect(snapshot.scrollY).toBe(scrollYBefore + 25);
    });

    it("maps business ids to row rects and returns null for unknown ids", () => {
      const timeline = createTimeline();
      loadTracks(timeline);
      const getTrackRectByBusinessId = requireMethod(timeline, "getTrackRectByBusinessId") as (
        id: unknown,
      ) => AnyRecord | null;
      const rect = getTrackRectByBusinessId("A2");
      expect(rect).not.toBeNull();
      expect(rect?.businessId).toBe("A2");
      expect(rect?.trackIndex).toBe(1);
      expect(getTrackRectByBusinessId("NOPE")).toBeNull();
    });

    it("keeps timeToX and xToTime inverse with null for invalid input", () => {
      const timeline = createTimeline();
      loadTracks(timeline);
      const timeToX = requireMethod(timeline, "timeToX") as (t: number) => number | null;
      const xToTime = requireMethod(timeline, "xToTime") as (x: number) => number | null;
      const x = timeToX(32400);
      expect(x).not.toBeNull();
      expect(xToTime(x as number)).toBeCloseTo(32400, 6);
      expect(timeToX(Number.NaN)).toBeNull();
      expect(xToTime(Number.POSITIVE_INFINITY)).toBeNull();
    });

    it("isolates subscriber exceptions and stops after unsubscribe", () => {
      const timeline = createTimeline();
      loadTracks(timeline);
      const boom = vi.fn(() => {
        throw new Error("listener boom");
      });
      const fine = vi.fn();
      const subscribeViewport = requireMethod(timeline, "subscribeViewport") as (
        l: unknown,
      ) => () => void;
      const unsubscribe = subscribeViewport(boom);
      subscribeViewport(fine);
      expect(() => unsubscribe()).not.toThrow();
      expect(() => unsubscribe()).not.toThrow();
      timeline.state.scrollY += 10;
      expect(() => timeline.notifyChange("scroll:y")).not.toThrow();
      expect(fine).toHaveBeenCalledTimes(2);
      const callsAfterUnsubscribe = boom.mock.calls.length;
      timeline.state.scrollY += 10;
      timeline.notifyChange("scroll:y");
      expect(boom).toHaveBeenCalledTimes(callsAfterUnsubscribe);
    });

    it("notifies viewport subscribers when drag auto-adds a track", async () => {
      const timeline = createTimeline({ autoAddTrack: true });
      loadTracks(timeline);
      const listener = vi.fn();
      const subscribeViewport = requireMethod(timeline, "subscribeViewport") as (
        l: unknown,
      ) => () => void;
      subscribeViewport(listener);
      expect(listener.mock.calls[0][0]).toMatchObject({ trackCount: 3 });

      const canvas = timeline.getCanvas();
      const fire = (type: string, x: number, y: number): void => {
        canvas.dispatchEvent(
          new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }),
        );
      };
      // 事件 WO-1 位于 x 180–360、行 0（y 20–60）；x=200 稳定命中事件索引 0
      fire("mousedown", 200, 40);
      fire("mousemove", 215, 190);
      // 等待 RAF 节流的拖动帧执行自动加轨，再抬起
      await new Promise((resolve) => setTimeout(resolve, 30)).then(() => {
        fire("mouseup", 215, 190);
      });

      expect(timeline.state.tracks.length).toBe(4);
      const notified = listener.mock.calls.filter((call) => {
        const snapshot = call[0] as AnyRecord;
        return snapshot.trackCount === 4;
      });
      expect(notified.length).toBeGreaterThan(0);
      const lastSnapshot = notified[notified.length - 1][0] as AnyRecord;
      expect(lastSnapshot.revision).toBeGreaterThan(
        (listener.mock.calls[0][0] as AnyRecord).revision as number,
      );
    });

    it("clamps scrollY and republishes an in-bounds snapshot after a shrinking import", () => {
      const timeline = createTimeline();
      loadTracks(timeline);
      // 底部滚动状态下导入更小数据集（1 轨），旧 scrollY 已越界
      timeline.state.scrollY = 10000;
      const loadScheduleData = requireMethod(timeline, "loadScheduleData") as (
        data: unknown,
      ) => { ok: boolean };
      expect(
        loadScheduleData({
          tracks: [
            { businessId: "A1", events: [{ businessId: "WO-1", startTime: 32400, endTime: 36000, title: "x" }] },
          ],
        }).ok,
      ).toBe(true);

      expect(timeline.state.scrollY).toBe(0);
      const getViewport = requireMethod(timeline, "getViewport") as () => AnyRecord;
      const snapshot = getViewport();
      expect(snapshot.scrollY).toBe(0);
      expect(snapshot.visibleTrackRange).toEqual([0, 0]);
    });
  });
});
