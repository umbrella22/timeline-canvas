import { describe, expect, it, vi } from "vite-plus/test";

import { Timeline } from "../src";
import { createMockCanvas } from "./helpers";

type AnyRecord = Record<string, unknown>;

const CANVAS_ID = "m2-schedule-commit-canvas";

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

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function loadSchedule(timeline: Timeline): void {
  timeline.loadData({
    tracks: [
      { businessId: "A1", events: [{ businessId: "WO-1", startTime: 32400, endTime: 36000, title: "工单 1" }] },
      { businessId: "A3", events: [{ businessId: "WO-2", startTime: 32400, endTime: 36000, title: "工单 2" }] },
    ],
  } as never);
}

function findEvent(timeline: Timeline, businessId: string): AnyRecord | undefined {
  for (const track of timeline.state.tracks) {
    for (const event of track.events as unknown as AnyRecord[]) {
      if (event.businessId === businessId) return event;
    }
  }
  return undefined;
}

/** 真实指针链：把 WO-1 拖到 A3 11:00–12:00（Δ360px = 7200s → 39600，行 1）并落点 */
async function dragMove(timeline: Timeline): Promise<void> {
  const canvas = timeline.getCanvas();
  const fire = (type: string, x: number, y: number): void => {
    canvas.dispatchEvent(
      new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }),
    );
  };
  fire("mousedown", 200, 40);
  fire("mousemove", 560, 90);
  // 等待 RAF 帧真正处理移动（候选/快照完成），再抬起
  await new Promise((resolve) => setTimeout(resolve, 30));
  fire("mouseup", 560, 90);
}

describe("M2 schedule commit settle contracts", () => {
  describe("C-13 accept, reject and server correction (T-SETTLE)", () => {
    it("publishes once and fires legacy callback after acceptance", async () => {
      const hook = deferred<{ accepted: true }>();
      const onBeforeCommit = vi.fn(() => hook.promise);
      const onEventMove = vi.fn();
      const timeline = createTimeline({ scheduleEditing: { onBeforeCommit } } as never);
      loadSchedule(timeline);
      timeline.callbacks.onEventMove = onEventMove;

      await dragMove(timeline);
      expect(onBeforeCommit).toHaveBeenCalledTimes(1);
      hook.resolve({ accepted: true });
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 确认事实原子发布到 A3 39600–43200
      const moved = findEvent(timeline, "WO-1");
      expect(moved).toBeDefined();
      expect(
        (timeline.state.tracks[1].events as unknown as AnyRecord[]).some((e) => e.businessId === "WO-1"),
      ).toBe(true);
      expect(moved?.startTime).toBe(39600);
      expect(moved?.endTime).toBe(43200);
      // 旧成功回调仅在确认后发一次，并附 before
      expect(onEventMove).toHaveBeenCalledTimes(1);
      const payload = onEventMove.mock.calls[0][0] as AnyRecord;
      expect(payload.oldEvent).toBeDefined();
      expect((payload.oldEvent as AnyRecord).businessId).toBe("WO-1");
      expect(payload.fromResourceBusinessId).toBe("A1");
      expect(payload.toResourceBusinessId).toBe("A3");
    });

    it("restores original display on explicit rejection without touching other events", async () => {
      const hook = deferred<{ accepted: false; reason: string }>();
      const onBeforeCommit = vi.fn(() => hook.promise);
      const timeline = createTimeline({ scheduleEditing: { onBeforeCommit } } as never);
      loadSchedule(timeline);

      await dragMove(timeline);
      expect(onBeforeCommit).toHaveBeenCalledTimes(1);
      hook.resolve({ accepted: false, reason: "排产窗口已关闭" });
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 事实未变：WO-1 仍在 A1 原时间，WO-2 不受影响
      const kept = findEvent(timeline, "WO-1");
      expect(kept?.startTime).toBe(32400);
      expect(kept?.endTime).toBe(36000);
      const other = findEvent(timeline, "WO-2");
      expect(other?.startTime).toBe(32400);
    });

    it("publishes the server-corrected placement on accepted with correction", async () => {
      const hook = deferred<{
        accepted: true;
        placement?: { resourceBusinessId: string; startTime: number; endTime: number };
      }>();
      const onBeforeCommit = vi.fn(() => hook.promise);
      const timeline = createTimeline({ scheduleEditing: { onBeforeCommit } } as never);
      loadSchedule(timeline);

      await dragMove(timeline);
      expect(onBeforeCommit).toHaveBeenCalledTimes(1);
      // 服务器修正到 11:15–12:15
      hook.resolve({
        accepted: true,
        placement: { resourceBusinessId: "A3", startTime: 40500, endTime: 44100 },
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const moved = findEvent(timeline, "WO-1");
      expect(
        (timeline.state.tracks[1].events as unknown as AnyRecord[]).some((e) => e.businessId === "WO-1"),
      ).toBe(true);
      expect(moved?.startTime).toBe(40500);
      expect(moved?.endTime).toBe(44100);
      expect(moved?.duration).toBe(3600);
    });

    it("enters reconciliation_required on timeout, keeps the lock and ignores late responses", async () => {
      let lateResolve!: (value: { accepted: true }) => void;
      const onBeforeCommit = vi.fn(
        () =>
          new Promise<{ accepted: true }>((resolve) => {
            lateResolve = resolve;
          }),
      );
      const timeline = createTimeline({
        scheduleEditing: { onBeforeCommit, commitTimeoutMs: 50 },
      } as never);
      loadSchedule(timeline);

      await dragMove(timeline);
      expect(onBeforeCommit).toHaveBeenCalledTimes(1);
      // 等待超过 commitTimeoutMs：结果未知 → 待核对
      await new Promise((resolve) => setTimeout(resolve, 90));

      const state = (
        (timeline as unknown as AnyRecord).getScheduleEditState as (id: string) => AnyRecord
      )("WO-1");
      expect(state.state).toBe("reconciliation_required");

      // 晚到的原响应不得写回 unknown 状态
      lateResolve({ accepted: true });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const kept = findEvent(timeline, "WO-1");
      expect(kept?.startTime).toBe(32400);
      expect(
        ((timeline as unknown as AnyRecord).getScheduleEditState as (id: string) => AnyRecord)("WO-1").state,
      ).toBe("reconciliation_required");
    });

    it("treats an invalid commit result as unknown, never as rejection", async () => {
      const onBeforeCommit = vi.fn(() =>
        Promise.resolve({ accepted: "yes" } as unknown as { accepted: true }),
      );
      const timeline = createTimeline({
        scheduleEditing: { onBeforeCommit, commitTimeoutMs: 5000 },
      } as never);
      loadSchedule(timeline);

      await dragMove(timeline);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const state = (
        (timeline as unknown as AnyRecord).getScheduleEditState as (id: string) => AnyRecord
      )("WO-1");
      expect(state.state).toBe("reconciliation_required");
      const kept = findEvent(timeline, "WO-1");
      expect(kept?.startTime).toBe(32400);
    });

    it("treats a synchronous hook throw as unknown result", async () => {
      const onBeforeCommit = vi.fn(() => {
        throw new Error("adapter boom");
      });
      const timeline = createTimeline({
        scheduleEditing: { onBeforeCommit, commitTimeoutMs: 5000 },
      } as never);
      loadSchedule(timeline);

      await dragMove(timeline);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const state = (
        (timeline as unknown as AnyRecord).getScheduleEditState as (id: string) => AnyRecord
      )("WO-1");
      expect(state.state).toBe("reconciliation_required");
    });

    it("reject is not silently retried and commit hook is called exactly once per intent", async () => {
      const onBeforeCommit = vi.fn(() => Promise.resolve({ accepted: false, reason: "冲突" }));
      const timeline = createTimeline({
        scheduleEditing: { onBeforeCommit },
      } as never);
      loadSchedule(timeline);
      await dragMove(timeline);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(onBeforeCommit).toHaveBeenCalledTimes(1);
    });
  });
});
