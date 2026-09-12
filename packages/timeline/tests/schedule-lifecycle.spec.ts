import { describe, expect, it, vi } from "vite-plus/test";

import { EventMediaPlugin, Timeline } from "../src";
import { createMockCanvas } from "./helpers";

type AnyRecord = Record<string, unknown>;

function createTimeline(
  options: ConstructorParameters<typeof Timeline>[1] = {},
): Timeline {
  createMockCanvas("schedule-lifecycle-canvas", 400, 120);
  return new Timeline("schedule-lifecycle-canvas", {
    autoFitOnInit: false,
    startTime: 28800,
    endTime: 64800,
    startPaddingTime: 0,
    secondWidth: 0.05,
    trackHeight: 40,
    timelineHeight: 20,
    firstTrackTopMargin: 0,
    ...options,
  });
}

function requireMethod(timeline: Timeline, name: string): (...args: unknown[]) => unknown {
  const method = (timeline as unknown as AnyRecord)[name];
  expect(
    typeof method,
    `C-08 capability: Timeline.${name} must exist`,
  ).toBe("function");
  return method.bind(timeline) as (...args: unknown[]) => unknown;
}

describe("M1 schedule lifecycle contracts", () => {
  describe("C-10 legacy behavior anchors (T-LEGACY)", () => {
    it("loadData replaces tracks and clears selection", () => {
      const timeline = createTimeline();
      timeline.loadData({ tracks: [{ events: [{ startTime: 32400, endTime: 36000, title: "a" }] }] });
      timeline.state.selectedTrack = 0;
      timeline.state.selectedEvent = { trackIndex: 0, eventIndex: 0 };
      timeline.loadData({ tracks: [{ events: [] }, { events: [] }] });
      expect(timeline.state.tracks).toHaveLength(2);
      expect(timeline.state.selectedEvent).toBeNull();
      expect(timeline.state.selectedTrack).toBeNull();
    });

    it("removeTrack keeps at least one track", () => {
      const timeline = createTimeline();
      timeline.loadData({ tracks: [{ events: [] }] });
      timeline.removeTrack();
      expect(timeline.state.tracks).toHaveLength(1);
    });

    it("destroy is idempotent and releases plugins once", async () => {
      const timeline = createTimeline();
      await timeline.usePlugin(EventMediaPlugin());
      const disposal = timeline.destroy();
      expect(timeline.destroy()).toBe(disposal);
      await disposal;
      expect(timeline.getLoadedPlugins()).toEqual([]);
      expect(() => timeline.draw()).not.toThrow();
    });
  });

  describe("C-08 subscription and unmount cleanup (T-LIFECYCLE)", () => {
    it("keeps viewport subscriptions isolated across 20 mount/unmount cycles", () => {
      const listeners: Array<ReturnType<typeof vi.fn>> = [];
      for (let cycle = 0; cycle < 20; cycle += 1) {
        const timeline = createTimeline();
        timeline.loadData({
          tracks: [{ businessId: "A1", events: [] }],
        } as never);
        const listener = vi.fn();
        listeners.push(listener);
        const subscribeViewport = requireMethod(timeline, "subscribeViewport") as (
          l: unknown,
        ) => () => void;
        const unsubscribe = subscribeViewport(listener);
        expect(listener).toHaveBeenCalledTimes(1);
        unsubscribe();
        const disposal = timeline.destroy();
        expect(timeline.destroy()).toBe(disposal);
      }
      for (const listener of listeners) {
        expect(listener).toHaveBeenCalledTimes(1);
      }
    });

    it("destroys pending viewport notifications so late frames cannot fire", () => {
      const timeline = createTimeline();
      timeline.loadData({ tracks: [{ businessId: "A1", events: [] }] } as never);
      const listener = vi.fn();
      const subscribeViewport = requireMethod(timeline, "subscribeViewport") as (
        l: unknown,
      ) => () => void;
      subscribeViewport(listener);
      expect(listener).toHaveBeenCalledTimes(1);
      return timeline.destroy().then(() => {
        timeline.state.scrollY += 20;
        expect(() => timeline.notifyChange("scroll:y")).not.toThrow();
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });
  });
});
