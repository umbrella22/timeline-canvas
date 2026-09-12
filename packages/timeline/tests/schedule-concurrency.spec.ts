import { describe, expect, it, vi } from "vite-plus/test";

import { Timeline } from "../src";
import { createMockCanvas } from "./helpers";

type AnyRecord = Record<string, unknown>;

const CANVAS_ID = "m2-schedule-concurrency-canvas";

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

/**
 * 行 0（y 20–60）: WO-1 x 180–360（32400–36000）
 * 行 1（y 70–110）: WO-2 x 180–360（32400–36000）
 */
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

describe("M2 schedule concurrency contracts", () => {
  describe("C-14 same-event mutual exclusion and cross-event reservations (T-CONCURRENCY)", () => {
    it("exposes pending state for a locked event and idle for others", () => {
      const timeline = createTimeline();
      loadSchedule(timeline);
      const getScheduleEditState = (
        timeline as unknown as AnyRecord
      ).getScheduleEditState as unknown as (id: unknown) => AnyRecord | null;
      expect(
        typeof getScheduleEditState,
        "M2 capability: Timeline.getScheduleEditState must exist (C-14)",
      ).toBe("function");
    });

    it("rejects re-editing the same event while its commit is pending", () => {
      const onBeforeCommit = vi.fn(
        () => new Promise<{ accepted: true }>(() => undefined),
      );
      const timeline = createTimeline({
        scheduleEditing: { onBeforeCommit },
      } as never);
      loadSchedule(timeline);
      // 第一次编辑挂起
      const first = beginDrag(timeline, { x: 200, y: 40 });
      first.move(220, 40);
      first.release(220, 40);
      expect(onBeforeCommit).toHaveBeenCalledTimes(1);

      // 同一任务在 pending 期间再次拖动：必须被 busy 拒绝，第二次提交不发生
      const second = beginDrag(timeline, { x: 220, y: 40 });
      second.move(240, 40);
      second.release(240, 40);
      expect(onBeforeCommit).toHaveBeenCalledTimes(1);
    });

    it("does not let another event take the candidate slot of a pending event", () => {
      const onBeforeCommit = vi.fn(
        () => new Promise<{ accepted: true }>(() => undefined),
      );
      const timeline = createTimeline({
        scheduleEditing: { onBeforeCommit },
      } as never);
      loadSchedule(timeline);
      // WO-1 挂起，候选落点为 A3 39600–43200（11:00–12:00，x 540）
      const first = beginDrag(timeline, { x: 200, y: 40 });
      first.move(540, 90);
      first.release(540, 90);
      expect(onBeforeCommit).toHaveBeenCalledTimes(1);

      // WO-2 拖向 WO-1 的候选时段（A3 39600 起）；即使本地不重叠判定放行，
      // 预约检查也必须拒绝提交
      const second = beginDrag(timeline, { x: 200, y: 90 });
      second.move(540, 90);
      second.release(540, 90);
      const calls = onBeforeCommit.mock.calls.filter((call) => {
        const change = call[0] as AnyRecord;
        return change.eventBusinessId === "WO-2";
      });
      expect(calls.length).toBe(0);
    });

    it("still allows another event to move to a genuinely free slot", () => {
      const onBeforeCommit = vi.fn(
        () => new Promise<{ accepted: true }>(() => undefined),
      );
      const timeline = createTimeline({
        scheduleEditing: { onBeforeCommit },
      } as never);
      timeline.loadData({
        tracks: [
          { businessId: "A1", events: [{ businessId: "WO-1", startTime: 32400, endTime: 36000, title: "工单 1" }] },
          {
            businessId: "A3",
            events: [
              { businessId: "WO-2", startTime: 32400, endTime: 36000, title: "工单 2" },
              { businessId: "WO-3", startTime: 46800, endTime: 50400, title: "工单 3" },
            ],
          },
        ],
      } as never);
      // WO-1 挂起（仍在其原位置 A1 32400–36000）
      const first = beginDrag(timeline, { x: 200, y: 40 });
      first.move(220, 40);
      first.release(220, 40);
      expect(onBeforeCommit).toHaveBeenCalledTimes(1);

      // WO-2 移到 A1 的 39600（11:00–12:00）：不与 WO-1 原占用/候选占用冲突
      const second = beginDrag(timeline, { x: 200, y: 90 });
      second.move(540, 40);
      second.release(540, 40);
      const calls = onBeforeCommit.mock.calls.filter((call) => {
        const change = call[0] as AnyRecord;
        return change.eventBusinessId === "WO-2";
      });
      expect(calls.length).toBe(1);
    });
  });
});
