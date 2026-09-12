import { describe, expect, it, vi } from "vite-plus/test";

import { Timeline } from "../src";
import { createMockCanvas } from "./helpers";

type AnyRecord = Record<string, unknown>;

const CANVAS_ID = "m2-schedule-edit-canvas";

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

function requireMethod(timeline: Timeline, name: string): (...args: unknown[]) => unknown {
  const method = (timeline as unknown as AnyRecord)[name];
  expect(
    typeof method,
    `M2 capability: Timeline.${name} must exist when scheduleEditing is configured (C-11)`,
  ).toBe("function");
  return method.bind(timeline) as (...args: unknown[]) => unknown;
}

/** 事件 WO-1 位于行 0（y 20–60）、x 180–360；行 1 为 y 70–110 */
function loadSchedule(timeline: Timeline): void {
  timeline.loadData({
    tracks: [
      { businessId: "A1", events: [{ businessId: "WO-1", startTime: 32400, endTime: 36000, title: "工单 1" }] },
      { businessId: "A3", events: [{ businessId: "WO-2", startTime: 32400, endTime: 36000, title: "工单 2" }] },
    ],
  } as never);
}

interface DragHandle {
  move(x: number, y: number): void;
  release(x: number, y: number): void;
  cancel(): void;
}

function beginDrag(timeline: Timeline, from: { x: number; y: number }): DragHandle {
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
    cancel: () => fire("pointercancel" as MouseEvent["type"], from.x, from.y),
  };
}

function editingOptions(overrides: AnyRecord = {}): AnyRecord {
  return {
    scheduleEditing: {
      onBeforeCommit: () => Promise.resolve({ accepted: true }),
      ...overrides,
    },
  };
}

describe("M2 schedule edit contracts", () => {
  describe("C-11 unified edit change and snapshots (T-CHANGE)", () => {
    it("exposes editing capabilities only when scheduleEditing is configured", () => {
      const timeline = createTimeline(editingOptions());
      requireMethod(timeline, "getScheduleEditState");
      requireMethod(timeline, "reconcileScheduleEvent");
    });

    it("keeps confirmed facts unchanged while a commit is in flight", async () => {
      const onBeforeCommit = vi.fn(() => new Promise<{ accepted: true }>(() => undefined));
      const timeline = createTimeline(editingOptions({ onBeforeCommit }));
      loadSchedule(timeline);
      const drag = beginDrag(timeline, { x: 200, y: 40 });
      drag.move(540, 90);
      drag.release(540, 90);
      await Promise.resolve();

      // onBeforeCommit 在落点被调用一次，携带 move change
      expect(onBeforeCommit).toHaveBeenCalledTimes(1);
      const change = onBeforeCommit.mock.calls[0][0] as AnyRecord;
      expect(change.action).toBe("move");
      expect(change.eventBusinessId).toBe("WO-1");
      expect(typeof change.operationId).toBe("string");

      // pending 期间：确认事实（export）仍是 before；候选只存在于 draft 投影
      const exported = (
        (timeline as unknown as AnyRecord).exportScheduleData as () => {
          ok: boolean;
          value?: AnyRecord;
        }
      )();
      expect(exported.ok).toBe(true);
      const trackA1 = (exported.value as AnyRecord).tracks as AnyRecord[];
      const kept = (trackA1[0].events as AnyRecord[])[0];
      expect(kept.startTime).toBe(32400);
      expect(kept.endTime).toBe(36000);
    });

    it("captures before snapshot at gesture start, detached from live tracks", async () => {
      const onBeforeCommit = vi.fn(() => Promise.resolve({ accepted: true }));
      const timeline = createTimeline(editingOptions({ onBeforeCommit }));
      loadSchedule(timeline);
      const drag = beginDrag(timeline, { x: 200, y: 40 });
      drag.move(210, 40);
      // 等待 RAF 帧真正处理本次移动（动作开始、before 快照完成）
      await new Promise((resolve) => setTimeout(resolve, 30));
      // 移动中途改写事件属性（模拟业务在编辑期间刷新 customData），
      // before 快照必须仍是动作开始时的事实
      const liveEvent = timeline.state.tracks[0].events[0] as unknown as AnyRecord;
      liveEvent.title = "中途改名";
      drag.release(250, 40);
      await Promise.resolve();

      expect(onBeforeCommit).toHaveBeenCalledTimes(1);
      const change = onBeforeCommit.mock.calls[0][0] as AnyRecord;
      const before = change.before as AnyRecord;
      const after = change.after as AnyRecord;
      expect((before.event as AnyRecord).title).toBe("工单 1");
      expect(before.resourceBusinessId).toBe("A1");
      expect(after.resourceBusinessId).toBe("A1");
      // after 与 before 的业务身份和内部 number id 一致
      expect((after.event as AnyRecord).businessId).toBe((before.event as AnyRecord).businessId);
      expect((after.event as AnyRecord).id).toBe((before.event as AnyRecord).id);
      expect((after.event as AnyRecord).duration).toBe(
        (after.event as AnyRecord).endTime as number - ((after.event as AnyRecord).startTime as number),
      );
      // 快照脱离引用：改动 payload 不影响内部事实对象
      ((before.event as AnyRecord).title as unknown as string) = "payload-tampered";
      expect(
        ((timeline as unknown as { state: { tracks: { events: AnyRecord[] }[] } }).state.tracks[0].events.find(
          (e) => e.businessId === "WO-1",
        ) as AnyRecord).title,
      ).toBe("中途改名");
    });

    it("reports cross-resource move with before resource and after resource", async () => {
      const onBeforeCommit = vi.fn(() => Promise.resolve({ accepted: true }));
      const timeline = createTimeline(editingOptions({ onBeforeCommit }));
      loadSchedule(timeline);
      const drag = beginDrag(timeline, { x: 200, y: 40 });
      drag.move(540, 90);
      drag.release(540, 90);
      await Promise.resolve();

      expect(onBeforeCommit).toHaveBeenCalledTimes(1);
      const change = onBeforeCommit.mock.calls[0][0] as AnyRecord;
      expect((change.before as AnyRecord).resourceBusinessId).toBe("A1");
      expect((change.after as AnyRecord).resourceBusinessId).toBe("A3");
    });

    it("does not create a commit for a click without movement", () => {
      const onBeforeCommit = vi.fn(() => Promise.resolve({ accepted: true }));
      const timeline = createTimeline(editingOptions({ onBeforeCommit }));
      loadSchedule(timeline);
      const drag = beginDrag(timeline, { x: 200, y: 40 });
      drag.release(201, 41);
      expect(onBeforeCommit).not.toHaveBeenCalled();
    });

    it("exposes per-event edit state and returns null for unknown ids", () => {
      const timeline = createTimeline(editingOptions());
      loadSchedule(timeline);
      const getScheduleEditState = requireMethod(timeline, "getScheduleEditState") as (
        id: unknown,
      ) => AnyRecord | null;
      expect(getScheduleEditState("WO-1")).toEqual({ state: "idle" });
      expect(getScheduleEditState("WO-404")).toBeNull();
    });
  });
});
