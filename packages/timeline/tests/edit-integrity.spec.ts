import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Timeline, PluginType, type TimelineOptions, type ScheduleEventInput } from "../src";
import { MutexGuardPlugin } from "../src/plugins/builtin/MutexGuardPlugin";
import { createMockCanvas } from "./helpers";

const timelines: Timeline[] = [];
const item = (businessId: string, startTime: number, endTime: number): ScheduleEventInput => ({
  businessId,
  title: `title-${businessId}`,
  startTime,
  endTime,
});
const pending = () => new Promise<never>(() => {});
function fixture(options: TimelineOptions = {}) {
  const id = `edit-${timelines.length}`;
  createMockCanvas(id, 400, 178);
  const timeline = new Timeline(id, {
    autoFitOnInit: false,
    autoRemoveEmptyLastTrack: false,
    startTime: 0,
    endTime: 600,
    secondWidth: 1,
    startPaddingTime: 0,
    timelineHeight: 20,
    firstTrackTopMargin: 0,
    trackHeight: 40,
    trackMargin: 10,
    ...options,
  });
  timelines.push(timeline);
  return timeline;
}
function load(t: Timeline, rows: ScheduleEventInput[][]) {
  expect(
    t.loadScheduleData({ tracks: rows.map((events, i) => ({ businessId: `R${i}`, events })) }).ok,
  ).toBe(true);
}
function preview(t: Timeline, id: string, target: number, startTime: number) {
  const location = t.getEventByBusinessId(id)!;
  const { trackIndex, eventIndex } = location;
  const event = t.state.tracks[trackIndex].events[eventIndex];
  expect(t.editTransactions.tryBegin({ event, trackIndex, eventIndex, action: "move" }).ok).toBe(
    true,
  );
  t.editTransactions.updateDraft(
    id,
    { resourceBusinessId: `R${target}`, startTime, endTime: startTime + event.duration },
    target,
  );
}
afterEach(async () => {
  await Promise.all(timelines.splice(0).map((t) => t.destroy()));
});

describe("schedule and UI identity", () => {
  it("invalidates the reused track slot before drawing or notifying the host", () => {
    const t = fixture();
    load(t, [[], [item("X", 20, 80)]]);
    expect(t.getEventAtPosition(30, 90)).toEqual({ trackIndex: 1, eventIndex: 0 });
    t.removeTrack();
    const seen: unknown[] = [];
    t.callbacks.onTrackAdd = () => seen.push(t.getEventAtPosition(30, 90));
    t.addTrack();
    expect(seen).toEqual([null]);
  });

  it.each(["upsert", "accept"])(
    "%s keeps every pointer attached to its event after a cross-track splice",
    async (kind) => {
      const t = fixture({ scheduleEditing: { onBeforeCommit: async () => ({ accepted: true }) } });
      const x = item("X", 20, 80),
        y = item("Y", 90, 100),
        z = item("Z", 110, 120);
      load(t, [[x, y, z], []]);
      if (kind === "accept") preview(t, "X", 1, 70);
      const oldY = { trackIndex: 0, eventIndex: 1 };
      const state = t.state;
      state.selectedEvent = oldY;
      state.contextMenuEvent = oldY;
      state.contextMenuVisible = true;
      state.highlightedEvent = { trackIndex: 0, eventIndex: 0 };
      state.lastClickEvent = oldY;
      state.hoveredResizeHandle = { ...oldY, edge: "right" };
      state.hoveredSplitLine = { ...oldY, splitTime: 95 };
      if (kind === "upsert")
        expect(t.upsertScheduleEvents([{ resourceBusinessId: "R1", event: x }]).ok).toBe(true);
      else {
        expect(t.commitScheduleEdit("X")).toBe(true);
        await Promise.resolve();
      }
      const newY = { trackIndex: 0, eventIndex: 0 };
      expect(state.selectedEvent).toEqual(newY);
      expect(state.contextMenuEvent).toEqual(newY);
      expect(state.lastClickEvent).toEqual(newY);
      expect(state.hoveredResizeHandle).toEqual({ ...newY, edge: "right" });
      expect(state.hoveredSplitLine).toEqual({ ...newY, splitTime: 95 });
      expect(state.highlightedEvent).toEqual({ trackIndex: 1, eventIndex: 0 });
      const menu = state.contextMenuEvent!;
      expect(t.deleteEvent(menu.trackIndex, menu.eventIndex)).toBe(true);
      expect(state.tracks[0].events.map((e) => e.businessId)).toEqual(["Z"]);
      expect(t.getEventByBusinessId("X")?.resourceBusinessId).toBe("R1");
    },
  );

  it.each(["plugin", "business"])(
    "halts the original edit if a %s validator removes the event preceding X",
    async (which) => {
      const hook = vi.fn(pending);
      const t = fixture({
        scheduleEditing: {
          onBeforeCommit: hook,
          validate: () => {
            if (which === "business") t.deleteEventByBusinessId("P");
            return { allowed: true };
          },
        },
      });
      load(t, [[item("P", 0, 10), item("X", 20, 80), item("Y", 120, 140)], []]);
      if (which === "plugin")
        await t.usePlugin({
          metadata: { name: "delete-previous", version: "1", type: PluginType.EXTENSION },
          activate(ctx) {
            ctx.api.registerEventHandler("validate:event:move", () => {
              t.deleteEventByBusinessId("P");
              return true;
            });
          },
        });
      preview(t, "X", 1, 70);
      expect(t.commitScheduleEdit("X")).toBe(false);
      expect(hook).not.toHaveBeenCalled();
      expect(t.getScheduleEditState("X")).toEqual({ state: "idle" });
      expect(t.getEventByBusinessId("Y")?.event.title).toBe("title-Y");
    },
  );

  it("rechecks target occupancy after business validation without dispatching twice", () => {
    const hook = vi.fn(pending);
    let nested: boolean | undefined;
    const t = fixture({
      scheduleEditing: {
        onBeforeCommit: hook,
        validate() {
          nested = t.commitScheduleEdit("X");
          t.upsertScheduleEvents([{ resourceBusinessId: "R1", event: item("block", 70, 130) }]);
          return { allowed: true };
        },
      },
    });
    load(t, [[item("X", 20, 80)], []]);
    preview(t, "X", 1, 70);
    expect(t.commitScheduleEdit("X")).toBe(false);
    expect(nested).toBe(false);
    expect(hook).not.toHaveBeenCalled();
    expect(t.getEventByBusinessId("X")?.resourceBusinessId).toBe("R0");
  });

  it.each(["destroy", "reload"])(
    "a pending notification can %s before the save hook is called",
    (operation) => {
      const hook = vi.fn(pending);
      const t = fixture({
        scheduleEditing: { onBeforeCommit: hook },
        onScheduleCommitStateChange(data) {
          if (data.state === "pending") {
            if (operation === "reload") load(t, [[item("X", 300, 350)]]);
            else void t.destroy();
          }
        },
      });
      load(t, [[item("X", 20, 80)], []]);
      preview(t, "X", 1, 70);
      expect(t.commitScheduleEdit("X")).toBe(false);
      expect(hook).not.toHaveBeenCalled();
    },
  );

  it.each(["deletion", "replacement"])(
    "does not apply an old authoritative %s across a synchronous reload",
    (kind) => {
      const t = fixture({
        scheduleEditing: { onBeforeCommit: pending },
        onScheduleCommitStateChange(data) {
          if (data.state === "invalidated") load(t, [[item("X", 300, 350)]]);
        },
      });
      load(t, [[item("X", 20, 80)], []]);
      preview(t, "X", 1, 70);
      t.commitScheduleEdit("X");
      const { operationId } = t.editTransactions.getTransaction("X")!;
      const snapshot =
        kind === "deletion" ? null : { resourceBusinessId: "R0", event: item("X", 6, 12) };
      expect(t.reconcileScheduleEvent("X", snapshot, { operationId })).toMatchObject({
        ok: false,
        error: { code: "stale_operation" },
      });
      expect(t.getEventByBusinessId("X")?.event.startTime).toBe(300);
    },
  );

  it("retains an empty reserved track while trimming trailing tracks", () => {
    const t = fixture({
      autoRemoveEmptyLastTrack: true,
      scheduleEditing: { onBeforeCommit: pending },
    });
    load(t, [[item("X", 20, 80)], [], []]);
    preview(t, "X", 1, 70);
    t.commitScheduleEdit("X");
    t.autoRemoveEmptyLastTrack();
    expect(t.state.tracks.map((r) => r.businessId)).toEqual(["R0", "R1"]);
    expect(t.getScheduleEditState("X")?.state).toBe("pending");
  });

  it("retains cross-resource mutex reservations while a save is pending", async () => {
    const hook = vi.fn(pending);
    const t = fixture({ scheduleEditing: { onBeforeCommit: hook } });
    const tags = { mutex: ["operator"] };
    load(t, [
      [{ ...item("X", 0, 40), customData: tags }],
      [{ ...item("Y", 70, 110), customData: tags }],
    ]);
    await t.usePlugin(MutexGuardPlugin());
    preview(t, "X", 0, 180);
    expect(t.commitScheduleEdit("X")).toBe(true);
    preview(t, "Y", 1, 180);
    expect(t.commitScheduleEdit("Y")).toBe(false);
    expect(hook).toHaveBeenCalledTimes(1);
  });

  it("returns the path of a duplicate legacy ID before producing a strict export", () => {
    const t = fixture();
    const track = { businessId: "R0", events: [item("X", 20, 80)] };
    for (const [second, path] of [
      [{ ...track, events: [] }, "tracks[1].businessId"],
      [{ ...track, businessId: "R1" }, "tracks[1].events[0].businessId"],
    ] as const) {
      expect(t.loadData({ tracks: [track, second] })).toBe(true);
      expect(t.exportScheduleData()).toMatchObject({
        ok: false,
        error: { code: "duplicate_business_id", path },
      });
    }
  });
});
