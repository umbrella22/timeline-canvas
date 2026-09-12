import { describe, expect, it, vi } from "vite-plus/test";

import { Timeline } from "../src";
import { createMockCanvas } from "./helpers";

type AnyRecord = Record<string, unknown>;

const CANVAS_ID = "m2-gesture-locks-canvas";

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

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function loadSchedule(timeline: Timeline): void {
  timeline.loadData({
    tracks: [
      { businessId: "A1", events: [{ businessId: "WO-1", startTime: 32400, endTime: 36000, title: "工单 1" }] },
      { businessId: "A3", events: [{ businessId: "WO-2", startTime: 32400, endTime: 36000, title: "工单 2" }] },
    ],
  } as never);
}

function fireMouse(timeline: Timeline, type: string, x: number, y: number): void {
  timeline.getCanvas().dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }),
  );
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function editStateOf(timeline: Timeline, businessId: string): AnyRecord {
  return (timeline.getScheduleEditState as unknown as (id: string) => AnyRecord)(businessId);
}

function findEvent(timeline: Timeline, businessId: string): AnyRecord | undefined {
  for (const track of timeline.state.tracks) {
    for (const event of track.events as unknown as AnyRecord[]) {
      if (event.businessId === businessId) return event;
    }
  }
  return undefined;
}

describe("M2 gesture termination under locked/invalidated transactions (Round 6)", () => {
  it("mouseup on a locked (pending) event after a real drag terminates defensively: no legacy onEventMove, busy feedback, settlement still lands once", async () => {
    const hook = deferred<{ accepted: true }>();
    const onBeforeCommit = vi.fn(() => hook.promise);
    const onEventMove = vi.fn();
    const timeline = createTimeline({ scheduleEditing: { onBeforeCommit } } as never);
    loadSchedule(timeline);
    timeline.callbacks.onEventMove = onEventMove;

    // 真实拖拽进入 preview，随后宿主在手势中途提交（preview → pending）
    fireMouse(timeline, "mousedown", 200, 40);
    fireMouse(timeline, "mousemove", 560, 90);
    await wait(30);
    expect(timeline.commitScheduleEdit("WO-1")).toBe(true);
    expect(editStateOf(timeline, "WO-1").state).toBe("pending");

    fireMouse(timeline, "mouseup", 560, 90);

    // 锁定拖拽必须防御性终止：无 busy 之外的虚假成功回调
    expect(onEventMove).not.toHaveBeenCalled();
    expect(timeline.getStatus()).toContain("busy");
    expect(timeline.state.draggingEvent).toBeNull();

    // 协议结算不受手势终止影响：accept 恰好发布一次，legacy 回调由结算方发出
    hook.resolve({ accepted: true });
    await wait(10);
    expect(onEventMove).toHaveBeenCalledTimes(1);
    const moved = findEvent(timeline, "WO-1");
    expect(moved?.startTime).toBe(39600);
  });

  it("mouseup after mid-gesture transaction invalidation never falls back to legacy settlement", async () => {
    const onBeforeCommit = vi.fn(() => deferred<{ accepted: true }>().promise);
    const onEventMove = vi.fn();
    const timeline = createTimeline({ scheduleEditing: { onBeforeCommit } } as never);
    loadSchedule(timeline);
    timeline.callbacks.onEventMove = onEventMove;

    fireMouse(timeline, "mousedown", 200, 40);
    fireMouse(timeline, "mousemove", 560, 90);
    await wait(30);
    timeline.editTransactions.invalidateTransaction("WO-1", "host invalidated mid-gesture");

    fireMouse(timeline, "mouseup", 560, 90);

    expect(onEventMove).not.toHaveBeenCalled();
    expect(timeline.getStatus()).toContain("cancelled");
    expect(timeline.state.draggingEvent).toBeNull();
    // 事实未被 legacy 路径改写
    expect(findEvent(timeline, "WO-1")?.startTime).toBe(32400);
  });

  it("a click (no drag) on a locked event keeps onEventClick and the busy feedback is not overwritten", () => {
    const hook = deferred<{ accepted: true }>();
    const onBeforeCommit = vi.fn(() => hook.promise);
    const onEventClick = vi.fn();
    const timeline = createTimeline({ scheduleEditing: { onBeforeCommit } } as never);
    loadSchedule(timeline);
    timeline.callbacks.onEventClick = onEventClick;

    // 手势外构造 pending 事务（模拟另一交互流/宿主提交后的锁定）
    const event = (timeline.state.tracks[0].events as unknown as AnyRecord[])[0];
    const begin = (timeline.editTransactions as unknown as AnyRecord).tryBegin({
      event,
      trackIndex: 0,
      eventIndex: 0,
      action: "move",
    }) as AnyRecord;
    expect(begin.ok).toBe(true);
    expect(timeline.commitScheduleEdit("WO-1")).toBe(true);

    fireMouse(timeline, "mousedown", 200, 40);
    fireMouse(timeline, "mouseup", 200, 40);

    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(timeline.getStatus()).toContain("busy");
  });

  it("resizing mouseup on a locked event clears the resizing phase and gives busy feedback without onEventUpdate", async () => {
    const hook = deferred<{ accepted: true }>();
    const onBeforeCommit = vi.fn(() => hook.promise);
    const onEventUpdate = vi.fn();
    const timeline = createTimeline({ scheduleEditing: { onBeforeCommit } } as never);
    loadSchedule(timeline);
    timeline.callbacks.onEventUpdate = onEventUpdate;

    // WO-1 右缘 ≈ x360（32400–36000 @0.05px/s），从右缘向左拉伸
    fireMouse(timeline, "mousedown", 358, 40);
    fireMouse(timeline, "mousemove", 340, 40);
    await wait(30);
    expect(timeline.commitScheduleEdit("WO-1")).toBe(true);

    fireMouse(timeline, "mouseup", 340, 40);

    expect(onEventUpdate).not.toHaveBeenCalled();
    expect(timeline.getStatus()).toContain("busy");
    // 渲染相位不得停留在 resize（否则把手高亮/split 提示被无限期抑制）
    expect((timeline.state as unknown as AnyRecord).resizingEvent).toBeNull();

    hook.resolve({ accepted: true });
    await wait(10);
    expect(findEvent(timeline, "WO-1")?.endTime).toBe(35640);
  });

  it("resizing mouseup after mid-gesture invalidation with movement terminates without legacy onEventUpdate", async () => {
    const onBeforeCommit = vi.fn(() => deferred<{ accepted: true }>().promise);
    const onEventUpdate = vi.fn();
    const timeline = createTimeline({ scheduleEditing: { onBeforeCommit } } as never);
    loadSchedule(timeline);
    timeline.callbacks.onEventUpdate = onEventUpdate;

    fireMouse(timeline, "mousedown", 358, 40);
    fireMouse(timeline, "mousemove", 340, 40);
    await wait(30);
    timeline.editTransactions.invalidateTransaction("WO-1", "host invalidated mid-gesture");

    fireMouse(timeline, "mouseup", 340, 40);

    expect(onEventUpdate).not.toHaveBeenCalled();
    expect(timeline.getStatus()).toContain("cancelled");
    expect((timeline.state as unknown as AnyRecord).resizingEvent).toBeNull();
    expect(findEvent(timeline, "WO-1")?.endTime).toBe(36000);
  });
});

describe("Round 6 data-safety contracts", () => {
  it("reconcile prevalidates the authoritative snapshot: typed failure keeps the transaction pending and retryable", async () => {
    const hook = deferred<{ accepted: true }>();
    const onBeforeCommit = vi.fn(() => hook.promise);
    const timeline = createTimeline({ scheduleEditing: { onBeforeCommit } } as never);
    loadSchedule(timeline);

    fireMouse(timeline, "mousedown", 200, 40);
    fireMouse(timeline, "mousemove", 560, 90);
    await wait(30);
    expect(timeline.commitScheduleEdit("WO-1")).toBe(true);
    const operationId = editStateOf(timeline, "WO-1").operationId as string;

    // 非法快照（空标题）：必须零写入返回 typed 错误，事务保持锁定可重试
    const bad = timeline.reconcileScheduleEvent(
      "WO-1",
      { resourceBusinessId: "A1", event: { businessId: "WO-1", startTime: 32400, endTime: 36000, title: "" } },
      { operationId },
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("invalid_input");
    expect(editStateOf(timeline, "WO-1").state).toBe("pending");

    // 同一 operationId 用合法快照重试成功（未进入不可重入的 stale_operation）
    const retry = timeline.reconcileScheduleEvent(
      "WO-1",
      { resourceBusinessId: "A1", event: { businessId: "WO-1", startTime: 32400, endTime: 36000, title: "权威标题" } },
      { operationId },
    );
    expect(retry.ok).toBe(true);
    expect(findEvent(timeline, "WO-1")?.title).toBe("权威标题");
    expect(editStateOf(timeline, "WO-1").state).toBe("idle");
  });

  it("legacy loadData clears drag/resize/hover pointers like the strict import", async () => {
    const timeline = createTimeline();
    loadSchedule(timeline);

    fireMouse(timeline, "mousedown", 200, 40);
    fireMouse(timeline, "mousemove", 300, 40);
    await wait(30);
    expect((timeline.state as unknown as AnyRecord).draggingEvent).not.toBeNull();

    timeline.loadData({
      tracks: [{ businessId: "B9", events: [{ businessId: "WO-9", startTime: 32400, endTime: 36000, title: "新" }] }],
    } as never);

    const state = timeline.state as unknown as AnyRecord;
    expect(state.draggingEvent).toBeNull();
    expect(state.resizingEvent).toBeNull();
    expect(state.highlightedEvent).toBeNull();
    expect(state.hoveredResizeHandle).toBeNull();
    expect(state.hoveredSplitLine).toBeNull();
    expect(state.lastClickEvent).toBeNull();
  });

  it("publish refuses to apply an accepted placement when the located event diverges from the edit snapshot (duplicate business ids)", async () => {
    const hook = deferred<{ accepted: true }>();
    const onBeforeCommit = vi.fn(() => hook.promise);
    const onEventMove = vi.fn();
    const timeline = createTimeline({ scheduleEditing: { onBeforeCommit } } as never);
    // legacy 容错装载可产生重复业务身份：索引定位会命中后遍历的重复事件
    timeline.loadData({
      tracks: [
        { businessId: "A1", events: [{ businessId: "DUP", startTime: 32400, endTime: 36000, title: "first" }] },
        { businessId: "A3", events: [{ businessId: "DUP", startTime: 46800, endTime: 50400, title: "second" }] },
      ],
    } as never);
    timeline.callbacks.onEventMove = onEventMove;

    fireMouse(timeline, "mousedown", 200, 40);
    fireMouse(timeline, "mousemove", 560, 90);
    await wait(30);
    fireMouse(timeline, "mouseup", 560, 90);
    hook.resolve({ accepted: true });
    await wait(10);

    // 身份不一致 → 进入待核对，绝不把服务器确认的 placement 落到未被编辑的事件上
    expect(editStateOf(timeline, "DUP").state).toBe("reconciliation_required");
    expect(onEventMove).not.toHaveBeenCalled();
    const tracks = timeline.state.tracks;
    expect((tracks[0].events as unknown as AnyRecord[])[0].startTime).toBe(32400);
    expect((tracks[1].events as unknown as AnyRecord[])[0].startTime).toBe(46800);
    expect((tracks[1].events as unknown as AnyRecord[]).some((e) => e.startTime === 39600)).toBe(false);
  });
});

describe("Round 7 callback-reentry and snapshot contracts", () => {
  it("accepted branch host reload inside onScheduleCommitStateChange suppresses the stale legacy success callback", async () => {
    const hook = deferred<{ accepted: true }>();
    const onBeforeCommit = vi.fn(() => hook.promise);
    const onEventMove = vi.fn();
    const commitStates: string[] = [];
    const timeline = createTimeline({
      scheduleEditing: { onBeforeCommit },
      onScheduleCommitStateChange: (data: AnyRecord) => {
        commitStates.push(String(data.state));
        // 宿主在 accepted 分支按常规模式整批刷新权威数据
        if (data.state === "accepted") {
          timeline.loadScheduleData({
            tracks: [
              { businessId: "A1", events: [{ businessId: "WO-1", startTime: 32400, endTime: 36000, title: "reload" }] },
            ],
          } as never);
        }
      },
    } as never);
    loadSchedule(timeline);
    timeline.callbacks.onEventMove = onEventMove;

    fireMouse(timeline, "mousedown", 200, 40);
    fireMouse(timeline, "mousemove", 560, 90);
    await wait(30);
    fireMouse(timeline, "mouseup", 560, 90);
    hook.resolve({ accepted: true });
    await wait(10);

    expect(commitStates).toContain("accepted");
    // 数据集已被宿主替换：携带旧数据集事件/下标的旧成功回调必须被抑制
    expect(onEventMove).not.toHaveBeenCalled();
    expect(findEvent(timeline, "WO-1")?.startTime).toBe(32400);
  });

  it("accepted branch host destroy inside onScheduleCommitStateChange suppresses the stale legacy success callback", async () => {
    const hook = deferred<{ accepted: true }>();
    const onBeforeCommit = vi.fn(() => hook.promise);
    const onEventMove = vi.fn();
    const timeline = createTimeline({
      scheduleEditing: { onBeforeCommit },
      onScheduleCommitStateChange: (data: AnyRecord) => {
        if (data.state === "accepted") void timeline.destroy();
      },
    } as never);
    loadSchedule(timeline);
    timeline.callbacks.onEventMove = onEventMove;

    fireMouse(timeline, "mousedown", 200, 40);
    fireMouse(timeline, "mousemove", 560, 90);
    await wait(30);
    fireMouse(timeline, "mouseup", 560, 90);
    hook.resolve({ accepted: true });
    await wait(10);

    expect(onEventMove).not.toHaveBeenCalled();
  });

  it("legacy drag oldEvent keeps the gesture-start snapshot across multiple mousemove frames", async () => {
    const onEventMove = vi.fn();
    const timeline = createTimeline();
    loadSchedule(timeline);
    timeline.callbacks.onEventMove = onEventMove;

    // RAF 节流下每帧 mousemove 需真实执行：帧一捕获原始位置并把事件移到 34400，
    // 帧二从 34400 继续移到 36400——oldEvent 必须始终是动作开始位置
    fireMouse(timeline, "mousedown", 200, 40);
    fireMouse(timeline, "mousemove", 300, 40);
    await wait(30);
    fireMouse(timeline, "mousemove", 400, 40);
    await wait(30);
    fireMouse(timeline, "mouseup", 400, 40);

    expect(onEventMove).toHaveBeenCalledTimes(1);
    const payload = onEventMove.mock.calls[0][0] as AnyRecord;
    expect((payload.oldEvent as AnyRecord | undefined)?.startTime).toBe(32400);
    expect((payload.event as AnyRecord).startTime).toBe(36400);
  });

  it("host loadData reentered from onStatusChange busy feedback terminates the drag without legacy settlement", async () => {
    const hook = deferred<{ accepted: true }>();
    const onBeforeCommit = vi.fn(() => hook.promise);
    const onEventMove = vi.fn();
    const timeline = createTimeline({
      scheduleEditing: { onBeforeCommit },
      onStatusChange: (text: string) => {
        // 宿主在 busy 反馈回调中按常规模式整批刷新
        if (text.startsWith("busy:")) {
          timeline.loadData({
            tracks: [
              { businessId: "A1", events: [{ businessId: "WO-1", startTime: 32400, endTime: 36000, title: "reload during busy" }] },
            ],
          } as never);
        }
      },
    } as never);
    loadSchedule(timeline);
    timeline.callbacks.onEventMove = onEventMove;

    fireMouse(timeline, "mousedown", 200, 40);
    fireMouse(timeline, "mousemove", 560, 90);
    await wait(30);
    expect(timeline.commitScheduleEdit("WO-1")).toBe(true);
    fireMouse(timeline, "mousemove", 570, 90);
    await wait(30);

    expect(onEventMove).not.toHaveBeenCalled();
    expect(timeline.state.draggingEvent).toBeNull();
    expect(findEvent(timeline, "WO-1")?.startTime).toBe(32400);
  });
});
