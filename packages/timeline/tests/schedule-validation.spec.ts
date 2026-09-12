import { describe, expect, it, vi } from "vite-plus/test";

import { Timeline } from "../src";
import { createMockCanvas } from "./helpers";

type AnyRecord = Record<string, unknown>;

const CANVAS_ID = "m2-schedule-validation-canvas";

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

/** 行 0: WO-1（32400–36000）；行 1: WO-2（32400–36000）→ 行 1 拖到 180–360 与 WO-2 重叠 */
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

function editingOptions(overrides: AnyRecord = {}): AnyRecord {
  return {
    scheduleEditing: {
      onBeforeCommit: () => Promise.resolve({ accepted: true }),
      ...overrides,
    },
  };
}

describe("M2 schedule validation contracts", () => {
  describe("C-12 synchronous validation with typed reasons (T-VALIDATE)", () => {
    it("does not call commit when the final drop overlaps a confirmed event", () => {
      const onBeforeCommit = vi.fn(() => Promise.resolve({ accepted: true }));
      const timeline = createTimeline(editingOptions({ onBeforeCommit }));
      loadSchedule(timeline);
      // WO-1 从行 0 拖到行 1 的 180–360，与 WO-2 (32400–36000) 完全重叠
      const drag = beginDrag(timeline, { x: 200, y: 40 });
      drag.move(220, 90);
      drag.release(220, 90);
      expect(onBeforeCommit).not.toHaveBeenCalled();
    });

    it("lets business validator reject with code and reason before commit", () => {
      const onBeforeCommit = vi.fn(() => Promise.resolve({ accepted: true }));
      const validate = vi.fn(() => ({ allowed: false, code: "equipment_closed", reason: "产线已收班" }));
      const timeline = createTimeline(editingOptions({ onBeforeCommit, validate }));
      loadSchedule(timeline);
      const drag = beginDrag(timeline, { x: 200, y: 40 });
      drag.move(400, 90);
      drag.release(400, 90);
      expect(validate).toHaveBeenCalled();
      expect(onBeforeCommit).not.toHaveBeenCalled();
      // 事实未变：拒绝落点后事件仍在原资源原时间
      const event = timeline.state.tracks[0].events[0] as unknown as AnyRecord;
      expect(event.startTime).toBe(32400);
    });

    it("treats a Promise-returning validate as validation_error, never a pass", () => {
      const onBeforeCommit = vi.fn(() => Promise.resolve({ accepted: true }));
      const validate = vi.fn(() => Promise.resolve({ allowed: true }));
      const timeline = createTimeline(editingOptions({ onBeforeCommit, validate }));
      loadSchedule(timeline);
      const drag = beginDrag(timeline, { x: 200, y: 40 });
      drag.move(220, 90);
      drag.release(220, 90);
      expect(onBeforeCommit).not.toHaveBeenCalled();
    });

    it("does not allow business allowed:true to bypass core overlap rejection", () => {
      const onBeforeCommit = vi.fn(() => Promise.resolve({ accepted: true }));
      const validate = vi.fn(() => ({ allowed: true }));
      const timeline = createTimeline(editingOptions({ onBeforeCommit, validate }));
      loadSchedule(timeline);
      const drag = beginDrag(timeline, { x: 200, y: 40 });
      drag.move(220, 90);
      drag.release(220, 90);
      // 核心重叠检查不可被业务 allowed:true 覆盖
      expect(onBeforeCommit).not.toHaveBeenCalled();
    });

    it("keeps new-schedule mode from auto-adding tracks on drag beyond last row", () => {
      const onBeforeCommit = vi.fn(() => Promise.resolve({ accepted: true }));
      const timeline = createTimeline(editingOptions({ onBeforeCommit, autoAddTrack: true }));
      loadSchedule(timeline);
      const drag = beginDrag(timeline, { x: 200, y: 40 });
      drag.move(215, 190);
      drag.release(215, 190);
      // 编辑协议不自动创建业务产线
      expect(timeline.state.tracks.length).toBe(2);
      expect(onBeforeCommit).not.toHaveBeenCalled();
    });

    it("rejects readonly events with a typed code and zero commit", () => {
      const onBeforeCommit = vi.fn(() => Promise.resolve({ accepted: true }));
      const timeline = createTimeline(editingOptions({ onBeforeCommit }));
      timeline.loadData({
        tracks: [
          {
            businessId: "A1",
            events: [{ businessId: "WO-1", startTime: 32400, endTime: 36000, title: "锁", readonly: true }],
          },
        ],
      } as never);
      const drag = beginDrag(timeline, { x: 200, y: 40 });
      drag.move(220, 40);
      drag.release(220, 40);
      expect(onBeforeCommit).not.toHaveBeenCalled();
    });
  });
});
