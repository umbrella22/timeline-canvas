import { describe, expect, it, vi } from "vite-plus/test";

import { Timeline } from "../src";
import { createMockCanvas } from "./helpers";

type AnyRecord = Record<string, unknown>;

const CANVAS_ID = "m2-schedule-recovery-canvas";

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

describe("M2 schedule recovery contracts", () => {
  describe("C-16 lifecycle and authoritative recovery (T-RECOVER)", () => {
    it("invalidates a pending operation when loadScheduleData replaces the dataset", async () => {
      const onBeforeCommit = vi.fn(
        () => new Promise<{ accepted: true }>(() => undefined),
      );
      const timeline = createTimeline({
        scheduleEditing: { onBeforeCommit },
      } as never);
      loadSchedule(timeline);
      const drag = beginDrag(timeline, { x: 200, y: 40 });
      drag.move(540, 90);
      drag.release(540, 90);
      expect(onBeforeCommit).toHaveBeenCalledTimes(1);

      // 整批权威导入：旧 operation 失效
      const loadScheduleData = (
        (timeline as unknown as AnyRecord).loadScheduleData as (this: Timeline, data: unknown) => { ok: boolean }
      ).bind(timeline);
      expect(
        loadScheduleData({
          tracks: [
            { businessId: "A1", events: [{ businessId: "WO-1", startTime: 32400, endTime: 36000, title: "权威" }] },
          ],
        }).ok,
      ).toBe(true);

      // 晚到的原响应不得写回新数据集
      (onBeforeCommit.mock.results[0].value as Promise<{ accepted: true }>).catch(() => undefined);
      const moved = timeline.state.tracks[0].events[0] as unknown as AnyRecord;
      expect(moved.startTime).toBe(32400);
    });

    it("never writes a late accepted response back after destroy", async () => {
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

      timeline.destroy();
      resolveCommit({ accepted: true });
      await Promise.resolve();
      await Promise.resolve();

      // 销毁后晚响应：不抛错、不写回、不发回调
      const moved = timeline.state.tracks[0].events[0] as unknown as AnyRecord;
      expect(moved.startTime).toBe(32400);
    });

    it("exposes reconcileScheduleEvent as the authoritative single-event entry", () => {
      const timeline = createTimeline({
        scheduleEditing: { onBeforeCommit: () => Promise.resolve({ accepted: true }) },
      } as never);
      loadSchedule(timeline);
      const reconcileScheduleEvent = (timeline as unknown as AnyRecord)
        .reconcileScheduleEvent as unknown;
      expect(
        typeof reconcileScheduleEvent,
        "M2 capability: Timeline.reconcileScheduleEvent must exist (C-16)",
      ).toBe("function");
    });

    it("never writes a late accepted response back after load replaces the dataset", async () => {
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

      // 整批替换后旧事务已作废；晚到 accepted 不得写回
      const loadScheduleData = (
        (timeline as unknown as AnyRecord).loadScheduleData as (this: Timeline, data: unknown) => { ok: boolean }
      ).bind(timeline);
      expect(
        loadScheduleData({
          tracks: [
            { businessId: "A1", events: [{ businessId: "WO-1", startTime: 32400, endTime: 36000, title: "权威" }] },
          ],
        }).ok,
      ).toBe(true);
      resolveCommit({ accepted: true });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const kept = timeline.state.tracks[0].events[0] as unknown as AnyRecord;
      expect(kept.startTime).toBe(32400);
      expect(kept.title).toBe("权威");
    });

    it("applies an authoritative snapshot via reconcileScheduleEvent and unlocks the event", async () => {
      // hook 永不结算：等待 commitTimeoutMs 触发待核对
      const onBeforeCommit = vi.fn(() => new Promise<{ accepted: true }>(() => undefined));
      const timeline = createTimeline({
        scheduleEditing: { onBeforeCommit, commitTimeoutMs: 60 },
      } as never);
      loadSchedule(timeline);
      const drag = beginDrag(timeline, { x: 200, y: 40 });
      drag.move(220, 40);
      drag.release(220, 40);
      // 超时 → 待核对
      await new Promise((resolve) => setTimeout(resolve, 100));
      const reconcileScheduleEvent = (
        (timeline as unknown as AnyRecord).reconcileScheduleEvent as (
          this: Timeline,
          id: unknown,
          snapshot: unknown,
          options: unknown,
        ) => { ok: boolean; error?: { code: string } }
      ).bind(timeline);
      const operationId = (
        (timeline as unknown as AnyRecord).getScheduleEditState as (id: string) => { operationId?: string }
      )("WO-1").operationId as string;

      // 权威快照：服务器实际落到了 A3 39600–43200
      expect(
        reconcileScheduleEvent(
          "WO-1",
          { resourceBusinessId: "A3", event: { businessId: "WO-1", startTime: 39600, endTime: 43200, title: "权威" } },
          { operationId },
        ).ok,
      ).toBe(true);

      const moved = timeline.state.tracks[1].events.find(
        (e) => (e as unknown as AnyRecord).businessId === "WO-1",
      ) as unknown as AnyRecord;
      expect(moved.startTime).toBe(39600);
      // 锁已解除：状态回到 idle，可再次提交
      expect(
        ((timeline as unknown as AnyRecord).getScheduleEditState as (id: string) => { state: string })("WO-1").state,
      ).toBe("idle");
      // 旧 operationId 已作废：重放返回 stale_operation 且零写入
      const replay = reconcileScheduleEvent(
        "WO-1",
        { resourceBusinessId: "A3", event: { businessId: "WO-1", startTime: 40000, endTime: 43600, title: "x" } },
        { operationId },
      );
      expect(replay.ok).toBe(false);
      expect(replay.error?.code).toBe("stale_operation");
      expect(moved.startTime).toBe(39600);
    });

    it("applies authoritative deletion via reconcileScheduleEvent(id, null)", async () => {
      const onBeforeCommit = vi.fn(() => new Promise<{ accepted: true }>(() => undefined));
      const timeline = createTimeline({
        scheduleEditing: { onBeforeCommit, commitTimeoutMs: 60 },
      } as never);
      loadSchedule(timeline);
      const drag = beginDrag(timeline, { x: 200, y: 40 });
      drag.move(220, 40);
      drag.release(220, 40);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const operationId = (
        (timeline as unknown as AnyRecord).getScheduleEditState as (id: string) => { operationId?: string }
      )("WO-1").operationId as string;
      const reconcileScheduleEvent = (
        (timeline as unknown as AnyRecord).reconcileScheduleEvent as (
          this: Timeline,
          id: unknown,
          snapshot: unknown,
          options: unknown,
        ) => { ok: boolean }
      ).bind(timeline);

      expect(reconcileScheduleEvent("WO-1", null, { operationId }).ok).toBe(true);
      expect(
        (timeline.state.tracks[0].events as unknown as AnyRecord[]).some((e) => e.businessId === "WO-1"),
      ).toBe(false);
      expect(
        ((timeline as unknown as AnyRecord).getScheduleEditState as (id: string) => { state: string } | null)("WO-1"),
      ).toBeNull();
    });

    it("keeps a new pending transaction when the previous operation's timeout fires after reconcile", async () => {
      const hooks: Array<Promise<{ accepted: boolean; reason?: string }>> = [];
      const resolvers: Array<(value: { accepted: boolean; reason?: string }) => void> = [];
      const onBeforeCommit = vi.fn(() => {
        const promise = new Promise<{ accepted: boolean; reason?: string }>((resolve) => {
          resolvers.push(resolve);
        });
        hooks.push(promise);
        return promise;
      });
      const timeline = createTimeline({
        scheduleEditing: { onBeforeCommit, commitTimeoutMs: 300 },
      } as never);
      loadSchedule(timeline);

      // 第一次编辑（A1 行内位移）→ pending；等待 200ms（< 300ms 超时）后权威恢复
      // （使 op1 的原始 timer 触发点落在 op2 pending 窗口中部，断言余量 ≥150ms）
      const first = beginDrag(timeline, { x: 200, y: 40 });
      first.move(220, 40);
      first.release(220, 40);
      expect(onBeforeCommit).toHaveBeenCalledTimes(1);
      await new Promise((resolve) => setTimeout(resolve, 200));
      const reconcileScheduleEvent = (
        (timeline as unknown as AnyRecord).reconcileScheduleEvent as (
          this: Timeline,
          id: unknown,
          snapshot: unknown,
          options: unknown,
        ) => { ok: boolean }
      ).bind(timeline);
      const firstOperationId = (
        (timeline as unknown as AnyRecord).getScheduleEditState as (id: string) => { operationId?: string }
      )("WO-1").operationId as string;
      expect(
        reconcileScheduleEvent(
          "WO-1",
          { resourceBusinessId: "A1", event: { businessId: "WO-1", startTime: 32400, endTime: 36000, title: "权威" } },
          { operationId: firstOperationId },
        ).ok,
      ).toBe(true);

      // 第二次编辑 → 新 pending
      const second = beginDrag(timeline, { x: 200, y: 40 });
      second.move(230, 40);
      second.release(230, 40);
      expect(onBeforeCommit).toHaveBeenCalledTimes(2);

      // 越过第一次操作的原始 timeout 触发点（reconcile 后 100ms 处）：
      // 旧 timer 已被 invalidateOperations 取消，不得把新 pending 打成待核对
      const stateProbe = (
        (timeline as unknown as AnyRecord).getScheduleEditState as (this: Timeline, id: string) => {
          state: string;
        }
      ).bind(timeline);
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(stateProbe("WO-1").state).toBe("pending");

      // 新事务的明确拒绝仍能正常解除锁定
      resolvers[1]?.({ accepted: false, reason: "冲突" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const state = (
        (timeline as unknown as AnyRecord).getScheduleEditState as (id: string) => { state: string }
      )("WO-1");
      expect(state.state).toBe("idle");
      void hooks;
    });

    it("cancels the gesture transaction when a host delete shifts the dragged event's index mid-drag", async () => {
      const onBeforeCommit = vi.fn(() => new Promise<{ accepted: true }>(() => undefined));
      const timeline = createTimeline({
        scheduleEditing: { onBeforeCommit },
      } as never);
      timeline.loadData({
        tracks: [
          {
            businessId: "A1",
            events: [
              { businessId: "WO-A", startTime: 32400, endTime: 33600, title: "A" },
              { businessId: "WO-B", startTime: 33600, endTime: 34800, title: "B" },
              { businessId: "WO-C", startTime: 34800, endTime: 36000, title: "C" },
            ],
          },
        ],
      } as never);
      // 拖动中间事件 WO-B（行 0；x：B 起点 33600 → (33600-28800)*0.05=240）
      const drag = beginDrag(timeline, { x: 242, y: 40 });
      drag.move(252, 40);
      // 等待 RAF 帧处理本次移动（WO-B 的 preview 事务已建立）
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(onBeforeCommit).not.toHaveBeenCalled();

      // 宿主删除同轨前序事件 WO-A：WO-B 下标漂移到 0，idx1 变为 WO-C
      timeline.deleteEvent(0, 0);
      drag.move(262, 40);
      drag.release(262, 40);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 原事务被取消（无孤儿锁）；没有对错误事件（WO-C）的提交；事实未变
      expect(onBeforeCommit).not.toHaveBeenCalled();
      expect(
        ((timeline as unknown as AnyRecord).getScheduleEditState as (id: string) => { state: string } | null)("WO-B"),
      ).toEqual({ state: "idle" });
      const keptB = timeline.state.tracks[0].events.find(
        (e) => (e as unknown as AnyRecord).businessId === "WO-B",
      ) as unknown as AnyRecord;
      expect(keptB.startTime).toBe(33600);
    });

    it("cancels the gesture when a host delete lands between the last move and mouseup", async () => {
      const onBeforeCommit = vi.fn(() => new Promise<{ accepted: true }>(() => undefined));
      const timeline = createTimeline({
        scheduleEditing: { onBeforeCommit },
      } as never);
      timeline.loadData({
        tracks: [
          {
            businessId: "A1",
            events: [
              { businessId: "WO-A", startTime: 32400, endTime: 33600, title: "A" },
              { businessId: "WO-B", startTime: 33600, endTime: 34800, title: "B" },
              { businessId: "WO-C", startTime: 34800, endTime: 36000, title: "C" },
            ],
          },
        ],
      } as never);
      const canvas = timeline.getCanvas();
      const fire = (type: string, x: number, y: number): void => {
        canvas.dispatchEvent(
          new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }),
        );
      };
      // 拖动 WO-B（idx1）；RAF 帧处理移动后 preview 事务已建立
      fire("mousedown", 242, 40);
      fire("mousemove", 252, 40);
      await new Promise((resolve) => setTimeout(resolve, 30));
      // 宿主删除在前事件 → 下标漂移；最后一条 move 已处理完，mouseup 前无 move 再处理
      timeline.deleteEvent(0, 0);
      fire("mouseup", 262, 40);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // mouseup 身份校验：取消原事务（无孤儿锁），不提交错误事件
      expect(onBeforeCommit).not.toHaveBeenCalled();
      expect(
        ((timeline as unknown as AnyRecord).getScheduleEditState as (id: string) => { state: string } | null)("WO-B"),
      ).toEqual({ state: "idle" });
      const keptC = timeline.state.tracks[0].events.find(
        (e) => (e as unknown as AnyRecord).businessId === "WO-C",
      ) as unknown as AnyRecord;
      expect(keptC.startTime).toBe(34800);
      expect(timeline.state.editDrafts.size).toBe(0);
    });

    it("returns not_found when reconciling an event that does not exist", () => {
      const timeline = createTimeline({
        scheduleEditing: { onBeforeCommit: () => Promise.resolve({ accepted: true }) },
      } as never);
      loadSchedule(timeline);
      const reconcileScheduleEvent = (
        (timeline as unknown as AnyRecord).reconcileScheduleEvent as (
          this: Timeline,
          id: unknown,
          snapshot: unknown,
          options: unknown,
        ) => { ok: boolean; error?: { code: string } }
      ).bind(timeline);
      const result = reconcileScheduleEvent(
        "WO-404",
        { resourceBusinessId: "A1", event: { businessId: "WO-404", startTime: 32400, endTime: 36000, title: "x" } },
        { operationId: "op-1" },
      );
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("not_found");
    });
  });
});
