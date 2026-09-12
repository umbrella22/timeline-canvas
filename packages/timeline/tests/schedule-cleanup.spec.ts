import { describe, expect, it, vi } from "vite-plus/test";

import { Timeline } from "../src";
import { createMockCanvas } from "./helpers";

type AnyRecord = Record<string, unknown>;

const CANVAS_ID = "m2-schedule-cleanup-canvas";

function createTimeline(options: AnyRecord = {}): Timeline {
  createMockCanvas(CANVAS_ID, 400, 120);
  return new Timeline(CANVAS_ID, {
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
  } as never);
}

function loadSchedule(timeline: Timeline): void {
  timeline.loadData({
    tracks: [
      { businessId: "A1", events: [{ businessId: "WO-1", startTime: 32400, endTime: 36000, title: "工单 1" }] },
      { businessId: "A3", events: [{ businessId: "WO-2", startTime: 32400, endTime: 36000, title: "工单 2" }] },
    ],
  } as never);
}

function beginDrag(timeline: Timeline, from: { x: number; y: number }): {
  move(x: number, y: number): void;
  release(x: number, y: number): void;
} {
  const canvas = timeline.getCanvas();
  const fire = (type: string, x: number, y: number): void => {
    canvas.dispatchEvent(
      new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }),
    );
  };
  fire("mousedown", from.x, from.y);
  return {
    move: (x, y) => fire("mousemove", x, y),
    release: (x, y) => fire("mouseup", x, y),
  };
}

describe("M2 schedule cleanup contracts", () => {
  describe("C-19 transaction release and runtime cost (T-CLEANUP)", () => {
    it("returns to idle and allows fresh edits after a terminal settle", async () => {
      let resolveCommit!: (value: { accepted: true }) => void;
      const onBeforeCommit = vi.fn(
        () =>
          new Promise<{ accepted: true }>((resolve) => {
            resolveCommit = resolve;
          }),
      );
      const timeline = createTimeline({
        scheduleEditing: { onBeforeCommit },
      } as never);
      loadSchedule(timeline);
      const drag = beginDrag(timeline, { x: 200, y: 40 });
      drag.move(220, 40);
      drag.release(220, 40);
      expect(onBeforeCommit).toHaveBeenCalledTimes(1);
      resolveCommit({ accepted: true });
      await Promise.resolve();
      await Promise.resolve();

      // 终态后事件回到可编辑：同任务锁已释放
      const second = beginDrag(timeline, { x: 220, y: 40 });
      second.move(240, 40);
      second.release(240, 40);
      expect(onBeforeCommit).toHaveBeenCalledTimes(2);
    });

    it("survives repeated mount/unmount cycles with unresolved commits", () => {
      const onBeforeCommit = vi.fn(
        () => new Promise<{ accepted: true }>(() => undefined),
      );
      for (let cycle = 0; cycle < 20; cycle++) {
        const timeline = createTimeline({
          scheduleEditing: { onBeforeCommit },
        } as never);
        loadSchedule(timeline);
        const drag = beginDrag(timeline, { x: 200, y: 40 });
        drag.move(220, 40);
        drag.release(220, 40);
        // 销毁时提交仍挂起：不等待、不抛错
        expect(() => timeline.destroy()).not.toThrow();
      }
      expect(onBeforeCommit).toHaveBeenCalledTimes(20);
    });

    it("does not fire legacy success callbacks after destroy settled a pending commit", async () => {
      let resolveCommit!: (value: { accepted: true }) => void;
      const onBeforeCommit = vi.fn(
        () =>
          new Promise<{ accepted: true }>((resolve) => {
            resolveCommit = resolve;
          }),
      );
      const onEventMove = vi.fn();
      const timeline = createTimeline({
        scheduleEditing: { onBeforeCommit },
      } as never);
      loadSchedule(timeline);
      timeline.callbacks.onEventMove = onEventMove;
      const drag = beginDrag(timeline, { x: 200, y: 40 });
      drag.move(220, 40);
      drag.release(220, 40);
      timeline.destroy();
      resolveCommit({ accepted: true });
      await Promise.resolve();
      await Promise.resolve();
      expect(onEventMove).not.toHaveBeenCalled();
    });
  });
});
