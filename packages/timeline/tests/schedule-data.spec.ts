import { describe, expect, it, vi } from "vite-plus/test";

import { Timeline } from "../src";
import { createMockCanvas } from "./helpers";

type AnyRecord = Record<string, unknown>;

function createTimeline(
  options: ConstructorParameters<typeof Timeline>[1] = {},
): Timeline {
  createMockCanvas("schedule-data-canvas", 300, 120);
  return new Timeline("schedule-data-canvas", {
    autoFitOnInit: false,
    startTime: 0,
    endTime: 800,
    startPaddingTime: 0,
    secondWidth: 10,
    trackHeight: 40,
    timelineHeight: 20,
    firstTrackTopMargin: 0,
    ...options,
  });
}

function api(timeline: Timeline): AnyRecord {
  return timeline as unknown as AnyRecord;
}

function requireMethod(timeline: Timeline, name: string): (...args: unknown[]) => unknown {
  const method = api(timeline)[name];
  expect(
    typeof method,
    `C-01 capability: Timeline.${name} must exist`,
  ).toBe("function");
  return method.bind(timeline) as (...args: unknown[]) => unknown;
}

function storedEvent(timeline: Timeline, trackIndex = 0, eventIndex = 0): AnyRecord {
  const tracks = (timeline as unknown as { state: { tracks: AnyRecord[] } }).state.tracks;
  return (tracks[trackIndex] as { events: AnyRecord[] }).events[eventIndex];
}

describe("M1 schedule data contracts", () => {
  describe("C-01 business identity and legacy compatibility (T-ID)", () => {
    it("exposes the strict schedule data entry points", () => {
      const timeline = createTimeline();
      for (const name of [
        "loadScheduleData",
        "exportScheduleData",
        "getEventByBusinessId",
        "getTrackByBusinessId",
        "updateEventByBusinessId",
        "upsertScheduleEvents",
        "deleteEventByBusinessId",
        "highlightEventByBusinessId",
        "updateTrackByBusinessId",
      ]) {
        expect(typeof api(timeline)[name], `Timeline.${name}`).toBe("function");
      }
    });

    it("keeps businessId supplied through legacy loadData on the stored event", () => {
      const timeline = createTimeline();
      const ok = timeline.loadData({
        tracks: [
          {
            businessId: "LINE-A1",
            events: [
              { startTime: 10, endTime: 20, title: "WO-26091", businessId: "WO-26091" },
            ],
          },
        ],
      } as never);
      expect(ok).toBe(true);
      expect(storedEvent(timeline).businessId).toBe("WO-26091");
      expect(
        (timeline.state.tracks[0] as unknown as AnyRecord).businessId,
      ).toBe("LINE-A1");
    });

    it("preserves businessId in clones delivered to update callbacks", () => {
      const timeline = createTimeline();
      timeline.loadData({
        tracks: [{ events: [{ startTime: 10, endTime: 20, title: "WO-26091" }] }],
      });
      (storedEvent(timeline) as { businessId?: unknown }).businessId = "WO-26091";
      const onEventUpdate = vi.fn();
      timeline.callbacks.onEventUpdate = onEventUpdate;
      timeline.updateEvent(0, 0, { title: "updated" });
      expect(onEventUpdate).toHaveBeenCalledTimes(1);
      const payload = onEventUpdate.mock.calls[0][0] as { event: AnyRecord; oldEvent?: AnyRecord };
      expect(payload.event.businessId).toBe("WO-26091");
      expect(payload.oldEvent?.businessId).toBe("WO-26091");
    });

    it("keeps business identity through split callbacks for the first segment", () => {
      const timeline = createTimeline();
      timeline.loadData({
        tracks: [{ events: [{ startTime: 10, endTime: 30, title: "WO-26091" }] }],
      });
      (storedEvent(timeline) as { businessId?: unknown }).businessId = "WO-26091";
      const onEventUpdate = vi.fn();
      timeline.callbacks.onEventUpdate = onEventUpdate;
      expect(timeline.splitEvent(0, 0, 20)).toBe(true);
      const payload = onEventUpdate.mock.calls[0][0] as {
        firstEvent: AnyRecord;
        secondEvent: AnyRecord;
      };
      expect(payload.firstEvent.businessId).toBe("WO-26091");
      expect(payload.secondEvent.businessId).toBeUndefined();
      expect(storedEvent(timeline, 0, 0).businessId).toBe("WO-26091");
      expect(storedEvent(timeline, 0, 1).businessId).toBeUndefined();
    });

    it("does not treat 1 and \"1\" as the same business id", () => {
      const timeline = createTimeline();
      const loadScheduleData = requireMethod(timeline, "loadScheduleData") as (
        data: unknown,
      ) => { ok: boolean };
      const getEventByBusinessId = requireMethod(timeline, "getEventByBusinessId") as (
        id: unknown,
      ) => unknown;
      expect(
        loadScheduleData({
          tracks: [
            { businessId: "A1", events: [{ businessId: 1, startTime: 1, endTime: 2, title: "n" }] },
          ],
        }).ok,
      ).toBe(true);
      expect(getEventByBusinessId("1")).toBeNull();
      expect(getEventByBusinessId(1)).not.toBeNull();
    });
  });

  describe("C-02 atomic import, export and metadata (T-DATA)", () => {
    function buildSchedule(): unknown {
      return {
        tracks: ["A1", "A2", "A3", "A4"].map((line, index) => ({
          businessId: line,
          customData: { name: `产线 ${line}`, status: "running", utilization: index * 10 },
          events: Array.from({ length: 40 }, (_, i) => ({
            businessId: `${line}-WO-${(i + 1).toString().padStart(5, "0")}`,
            startTime: 28800 + i * 450,
            endTime: 28800 + i * 450 + 300,
            title: `${line} 工单 ${i + 1}`,
            customData: { quantity: i + 1, progress: 0 },
          })),
        })),
      };
    }

    it("round-trips business ids, event content and track customData", () => {
      const timeline = createTimeline({ startTime: 28800, endTime: 64800 });
      const loadScheduleData = requireMethod(timeline, "loadScheduleData") as (
        data: unknown,
      ) => { ok: boolean };
      const exportScheduleData = requireMethod(timeline, "exportScheduleData") as () => {
        ok: boolean;
        value?: unknown;
      };
      expect(loadScheduleData(buildSchedule()).ok).toBe(true);
      const exported = exportScheduleData();
      expect(exported.ok).toBe(true);
      // 导出包含当前指示器位置（输入未提供时为初值 startTime）
      const expected = {
        ...buildSchedule(),
        timeIndicatorPosition: timeline.state.timeIndicatorPosition,
      };
      expect(exported.value).toEqual(expected);

      const second = createTimeline({ startTime: 28800, endTime: 64800 });
      const reload = requireMethod(second, "loadScheduleData") as (data: unknown) => { ok: boolean };
      expect(reload(exported.value).ok).toBe(true);
      expect(requireMethod(second, "exportScheduleData") as () => unknown).not.toThrow();
      expect(
        (requireMethod(second, "exportScheduleData") as () => { value?: unknown })().value,
      ).toEqual(expected);
    });

    it("rejects invalid batches without mutating previous state", () => {
      const timeline = createTimeline({ startTime: 28800, endTime: 64800 });
      const loadScheduleData = requireMethod(timeline, "loadScheduleData") as (
        data: unknown,
      ) => { ok: boolean; error?: { code: string; path?: string } };
      expect(loadScheduleData(buildSchedule()).ok).toBe(true);
      const before = JSON.stringify(timeline.state.tracks.length);

      const duplicate = loadScheduleData({
        tracks: [
          { businessId: "B1", events: [{ businessId: "X", startTime: 32400, endTime: 36000, title: "a" }] },
          { businessId: "B2", events: [{ businessId: "X", startTime: 39600, endTime: 43200, title: "b" }] },
        ],
      });
      expect(duplicate.ok).toBe(false);
      expect(duplicate.error?.code).toBe("duplicate_business_id");

      const outOfWindow = loadScheduleData({
        tracks: [
          { businessId: "B1", events: [{ businessId: "X", startTime: 28800, endTime: 99999, title: "a" }] },
        ],
      });
      expect(outOfWindow.ok).toBe(false);
      expect(outOfWindow.error?.code).toBe("invalid_input");

      expect(JSON.stringify(timeline.state.tracks.length)).toBe(before);
      expect((requireMethod(timeline, "getTrackByBusinessId") as (id: unknown) => unknown)("B1")).toBeNull();
    });

    it("refuses to export legacy events without business identity", () => {
      const timeline = createTimeline();
      timeline.loadData({ tracks: [{ events: [{ startTime: 1, endTime: 2, title: "legacy" }] }] });
      const exportScheduleData = requireMethod(timeline, "exportScheduleData") as () => {
        ok: boolean;
        error?: { code: string };
      };
      const result = exportScheduleData();
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("missing_business_id");
    });

    it("rejects circular or malformed media with typed errors and zero writes", () => {
      const timeline = createTimeline({ startTime: 28800, endTime: 64800 });
      const loadScheduleData = requireMethod(timeline, "loadScheduleData") as (
        data: unknown,
      ) => { ok: boolean; error?: { code: string; path?: string } };
      expect(loadScheduleData(buildSchedule()).ok).toBe(true);
      // 整树快照：内容突变但数量不变的回归也要被捕获
      const tracksBefore = JSON.stringify(timeline.state.tracks);

      const circular: Record<string, unknown> = {
        businessId: "M1",
        startTime: 30000,
        endTime: 30100,
        title: "circular media",
        media: { images: [{ src: "x" }] },
      };
      (circular.media as { images: Array<Record<string, unknown>> }).images[0].loop =
        (circular.media as { images: Array<unknown> }).images[0];
      const badLoad = loadScheduleData({
        tracks: [{ businessId: "M", events: [circular] }],
      });
      expect(badLoad.ok).toBe(false);
      expect(badLoad.error?.code).toBe("invalid_input");
      expect(badLoad.error?.path).toContain("media");

      const updateEventByBusinessId = requireMethod(timeline, "updateEventByBusinessId") as (
        id: unknown,
        patch: unknown,
      ) => { ok: boolean; error?: { code: string } };
      const badPatch = updateEventByBusinessId("A1-WO-00001", {
        media: { waveform: { data: [Number.NaN] } },
      });
      expect(badPatch.ok).toBe(false);
      expect(badPatch.error?.code).toBe("invalid_input");
      // patch 失败后事件内容保持原状（原子性）
      const location = (requireMethod(timeline, "getEventByBusinessId") as (id: unknown) => {
        event: { media?: unknown };
      })("A1-WO-00001");
      expect(location.event.media).toBeUndefined();

      expect(JSON.stringify(timeline.state.tracks)).toBe(tracksBefore);
    });

    it("does not serialize selection or runtime state into exports", () => {
      const timeline = createTimeline({ startTime: 28800, endTime: 64800 });
      const loadScheduleData = requireMethod(timeline, "loadScheduleData") as (
        data: unknown,
      ) => { ok: boolean };
      expect(loadScheduleData(buildSchedule()).ok).toBe(true);
      timeline.state.selectedTrack = 0;
      timeline.state.selectedEvent = { trackIndex: 0, eventIndex: 0 };
      timeline.state.scrollY = 33;
      const exported = (requireMethod(timeline, "exportScheduleData") as () => {
        value?: unknown;
      })().value as AnyRecord;
      expect(JSON.stringify(exported)).not.toContain("selectedEvent");
      expect(JSON.stringify(exported)).not.toContain("scrollY");
    });
  });

  describe("C-03 incremental update by business id (T-UPSERT)", () => {
    function loadTwo(timeline: Timeline): void {
      const loadScheduleData = requireMethod(timeline, "loadScheduleData") as (
        data: unknown,
      ) => { ok: boolean };
      expect(
        loadScheduleData({
          tracks: [
            {
              businessId: "A1",
              events: [
                { businessId: "WO-26091", startTime: 32400, endTime: 36000, title: "工单 91" },
                { businessId: "WO-26092", startTime: 39600, endTime: 43200, title: "工单 92" },
              ],
            },
            {
              businessId: "A3",
              events: [{ businessId: "WO-26093", startTime: 32400, endTime: 36000, title: "工单 93" }],
            },
          ],
        }).ok,
      ).toBe(true);
    }

    it("upserts the same business id twice without duplicating events", () => {
      const timeline = createTimeline({ startTime: 28800, endTime: 64800 });
      loadTwo(timeline);
      const upsertScheduleEvents = requireMethod(timeline, "upsertScheduleEvents") as (
        items: unknown,
      ) => { ok: boolean };
      const upsert = {
        resourceBusinessId: "A3",
        event: { businessId: "WO-26091", startTime: 39600, endTime: 43200, title: "工单 91" },
      };
      expect(upsertScheduleEvents([upsert]).ok).toBe(true);
      expect(upsertScheduleEvents([upsert]).ok).toBe(true);
      const location = (requireMethod(timeline, "getEventByBusinessId") as (id: unknown) => {
        trackIndex: number;
        eventIndex: number;
      })("WO-26091");
      expect(location.trackIndex).toBe(1);
      const count = timeline.state.tracks
        .map((track) => track.events.length)
        .reduce((sum, n) => sum + n, 0);
      expect(count).toBe(3);
    });

    it("deleting a neighbour keeps selection stable; deleting the selected event clears it", () => {
      const timeline = createTimeline({ startTime: 28800, endTime: 64800 });
      loadTwo(timeline);
      timeline.state.selectedTrack = 0;
      timeline.state.selectedEvent = { trackIndex: 0, eventIndex: 0 };
      const deleteEventByBusinessId = requireMethod(timeline, "deleteEventByBusinessId") as (
        id: unknown,
      ) => { ok: boolean };
      expect(deleteEventByBusinessId("WO-26092").ok).toBe(true);
      expect(timeline.state.selectedEvent).toEqual({ trackIndex: 0, eventIndex: 0 });
      expect(deleteEventByBusinessId("WO-26091").ok).toBe(true);
      expect(timeline.state.selectedEvent).toBeNull();
    });

    it("patches placement with merged validation and reports not_found for unknown ids", () => {
      const timeline = createTimeline({ startTime: 28800, endTime: 64800 });
      loadTwo(timeline);
      const updateEventByBusinessId = requireMethod(timeline, "updateEventByBusinessId") as (
        id: unknown,
        patch: unknown,
      ) => { ok: boolean; error?: { code: string } };
      expect(updateEventByBusinessId("WO-26091", { customData: { progress: 50 } }).ok).toBe(true);
      expect((storedEvent(timeline).customData as AnyRecord).progress).toBe(50);
      const missing = updateEventByBusinessId("WO-404", { title: "x" });
      expect(missing.ok).toBe(false);
      expect(missing.error?.code).toBe("not_found");
    });

    it("highlights events by business identity", () => {
      const timeline = createTimeline({ startTime: 28800, endTime: 64800 });
      loadTwo(timeline);
      const highlightEventByBusinessId = requireMethod(timeline, "highlightEventByBusinessId") as (
        id: unknown,
      ) => { ok: boolean };
      expect(highlightEventByBusinessId("WO-26091").ok).toBe(true);
      expect(timeline.state.highlightedEvent).toEqual({ trackIndex: 0, eventIndex: 0 });
    });

    it("rejects batches referencing unknown resources without partial writes", () => {
      const timeline = createTimeline({ startTime: 28800, endTime: 64800 });
      loadTwo(timeline);
      const upsertScheduleEvents = requireMethod(timeline, "upsertScheduleEvents") as (
        items: unknown,
      ) => { ok: boolean; error?: { code: string } };
      const result = upsertScheduleEvents([
        { resourceBusinessId: "A3", event: { businessId: "WO-1", startTime: 40000, endTime: 40100, title: "ok" } },
        { resourceBusinessId: "GHOST", event: { businessId: "WO-2", startTime: 40000, endTime: 40100, title: "x" } },
      ]);
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("not_found");
      expect(
        (requireMethod(timeline, "getEventByBusinessId") as (id: unknown) => unknown)("WO-1"),
      ).toBeNull();
    });
  });

  describe("review round 2 regressions", () => {
    function loadSmallSchedule(timeline: Timeline): { ok: boolean } {
      const loadScheduleData = requireMethod(timeline, "loadScheduleData") as (
        data: unknown,
      ) => { ok: boolean };
      return loadScheduleData({
        tracks: [
          { businessId: "A1", events: [{ businessId: "WO-26091", startTime: 32400, endTime: 36000, title: "工单 91" }] },
          { businessId: "A3", events: [{ businessId: "WO-26093", startTime: 32400, endTime: 36000, title: "工单 93" }] },
        ],
      });
    }

    function loadWaveformFixture(timeline: Timeline, waveform: Float32Array): { ok: boolean; error?: { code: string } } {
      const loadScheduleData = requireMethod(timeline, "loadScheduleData") as (
        data: unknown,
      ) => { ok: boolean; error?: { code: string } };
      return loadScheduleData({
        tracks: [
          {
            businessId: "M",
            events: [
              {
                businessId: "M-WO-1",
                startTime: 30000,
                endTime: 30100,
                title: "wave",
                media: { waveform: { data: waveform, sampleRate: 60 } },
              },
            ],
          },
        ],
      });
    }

    it("imports Float32Array waveform leaves at nested media depth with isolated buffers", () => {
      const timeline = createTimeline({ startTime: 28800, endTime: 64800 });
      const waveform = new Float32Array([0.5, 1.5, -2]);
      expect(loadWaveformFixture(timeline, waveform).ok).toBe(true);
      const media = storedEvent(timeline).media as {
        waveform: { data: Float32Array; sampleRate: number };
      };
      expect(media.waveform.data).toBeInstanceOf(Float32Array);
      expect(Array.from(media.waveform.data)).toEqual([0.5, 1.5, -2]);
      // validateMedia 允许的 plain 附加字段在查询侧克隆中对称保留
      expect(media.waveform.sampleRate).toBe(60);
      // 运行时状态不得与调用方共享波形缓冲
      expect(media.waveform.data).not.toBe(waveform);
      waveform[0] = 9;
      expect(media.waveform.data[0]).toBe(0.5);
      const found = (requireMethod(timeline, "getEventByBusinessId") as (id: unknown) => {
        event: { media?: { waveform?: { sampleRate?: number } } };
      })("M-WO-1");
      expect(found.event.media?.waveform?.sampleRate).toBe(60);
    });

    it("accepts shared non-circular sub-references in media", () => {
      const timeline = createTimeline({ startTime: 28800, endTime: 64800 });
      const loadScheduleData = requireMethod(timeline, "loadScheduleData") as (
        data: unknown,
      ) => { ok: boolean; error?: { code: string } };
      const sharedMeta = { renderer: "v2" };
      const result = loadScheduleData({
        tracks: [
          {
            businessId: "M",
            events: [
              {
                businessId: "M-WO-2",
                startTime: 30000,
                endTime: 30100,
                title: "dag",
                media: {
                  images: [
                    { src: "a", meta: sharedMeta },
                    { src: "b", meta: sharedMeta },
                  ],
                },
              },
            ],
          },
        ],
      });
      expect(result.ok).toBe(true);
    });

    it("rejects non-finite timeIndicatorPosition with zero writes", () => {
      const timeline = createTimeline({ startTime: 28800, endTime: 64800 });
      expect(loadSmallSchedule(timeline).ok).toBe(true);
      const before = JSON.stringify(timeline.state.tracks);
      const loadScheduleData = requireMethod(timeline, "loadScheduleData") as (
        data: unknown,
      ) => { ok: boolean; error?: { code: string; path?: string } };
      const bad = loadScheduleData({
        timeIndicatorPosition: Number.NaN,
        tracks: [
          { businessId: "A1", events: [{ businessId: "WO-26091", startTime: 32400, endTime: 36000, title: "x" }] },
          { businessId: "A3", events: [{ businessId: "WO-26093", startTime: 32400, endTime: 36000, title: "y" }] },
        ],
      });
      expect(bad.ok).toBe(false);
      expect(bad.error?.code).toBe("invalid_input");
      expect(bad.error?.path).toBe("timeIndicatorPosition");
      expect(JSON.stringify(timeline.state.tracks)).toBe(before);
    });

    it("clears drag and resize interaction state on strict import", () => {
      const timeline = createTimeline({ startTime: 28800, endTime: 64800 });
      timeline.state.draggingEvent = {
        trackIndex: 0,
        eventIndex: 0,
      } as unknown as typeof timeline.state.draggingEvent;
      timeline.state.resizingEvent = {
        trackIndex: 0,
        eventIndex: 0,
      } as unknown as typeof timeline.state.resizingEvent;
      expect(loadSmallSchedule(timeline).ok).toBe(true);
      expect(timeline.state.draggingEvent).toBeNull();
      expect(timeline.state.resizingEvent).toBeNull();
    });

    it("treats explicit undefined legacy updates as no-op instead of erasing business identity", () => {
      const timeline = createTimeline({ startTime: 28800, endTime: 64800 });
      expect(loadSmallSchedule(timeline).ok).toBe(true);
      timeline.updateEvent(0, 0, { title: "renamed", businessId: undefined } as never);
      expect(storedEvent(timeline).businessId).toBe("WO-26091");
      expect(storedEvent(timeline).title).toBe("renamed");
      const exportScheduleData = requireMethod(timeline, "exportScheduleData") as () => {
        ok: boolean;
      };
      expect(exportScheduleData().ok).toBe(true);
    });

    it("exports customData as deep copies isolated from runtime state", () => {
      const timeline = createTimeline({ startTime: 28800, endTime: 64800 });
      expect(loadSmallSchedule(timeline).ok).toBe(true);
      const updateEventByBusinessId = requireMethod(timeline, "updateEventByBusinessId") as (
        id: unknown,
        patch: unknown,
      ) => { ok: boolean };
      expect(
        updateEventByBusinessId("WO-26091", { customData: { progress: 50, meta: { tag: "a" } } }).ok,
      ).toBe(true);
      const updateTrackByBusinessId = requireMethod(timeline, "updateTrackByBusinessId") as (
        id: unknown,
        patch: unknown,
      ) => { ok: boolean };
      expect(updateTrackByBusinessId("A1", { customData: { line: { name: "一号線" } } }).ok).toBe(true);

      const exportScheduleData = requireMethod(timeline, "exportScheduleData") as () => {
        ok: boolean;
        value?: AnyRecord;
      };
      const exported = exportScheduleData();
      expect(exported.ok).toBe(true);
      const exportedTrack = ((exported.value as AnyRecord).tracks as AnyRecord[])[0];
      const exportedEvent = (exportedTrack.events as AnyRecord[])[0];

      // 引用隔离：导出结果与运行时状态不得共享嵌套对象（toEqual 测不出别名）
      const internalEventMeta = ((storedEvent(timeline).customData as AnyRecord).meta) as AnyRecord;
      const exportedEventMeta = ((exportedEvent.customData as AnyRecord).meta) as AnyRecord;
      expect(exportedEventMeta).not.toBe(internalEventMeta);
      exportedEventMeta.tag = "mutated";
      expect(internalEventMeta.tag).toBe("a");

      const internalLine = (((timeline.state.tracks[0] as unknown as AnyRecord).customData as AnyRecord).line) as AnyRecord;
      const exportedLine = ((exportedTrack.customData as AnyRecord).line) as AnyRecord;
      expect(exportedLine).not.toBe(internalLine);
      exportedLine.name = "污染";
      expect(internalLine.name).toBe("一号線");
    });

    it("exports imported waveform buffers as JSON-safe number arrays", () => {
      const timeline = createTimeline({ startTime: 28800, endTime: 64800 });
      const waveform = new Float32Array([0.5, 1.5]);
      expect(loadWaveformFixture(timeline, waveform).ok).toBe(true);
      const exportScheduleData = requireMethod(timeline, "exportScheduleData") as () => {
        ok: boolean;
        value?: AnyRecord;
      };
      const exported = exportScheduleData();
      expect(exported.ok).toBe(true);
      const exportedEvent = (((exported.value as AnyRecord).tracks as AnyRecord[])[0].events as AnyRecord[])[0];
      const exportedData = ((exportedEvent.media as AnyRecord).waveform as AnyRecord).data;
      expect(Array.isArray(exportedData)).toBe(true);
      expect(exportedData).toEqual([0.5, 1.5]);
      // 导出结果不得与内部缓冲共享引用
      expect(exportedData).not.toBe(waveform);
    });

    it("returns a typed error instead of throwing when legacy-loaded media is circular", () => {
      const timeline = createTimeline();
      const media: Record<string, unknown> = { images: [{ src: "x" }] };
      (media.images as Array<Record<string, unknown>>)[0].loop = (media.images as Array<unknown>)[0];
      // legacy loadData 对 media 按引用直通入库（无 strict 验证）
      expect(() =>
        timeline.loadData({
          tracks: [
            { businessId: "T1", events: [{ startTime: 10, endTime: 20, title: "legacy", businessId: "E1", media }] },
          ],
        } as never),
      ).not.toThrow();
      const exportScheduleData = requireMethod(timeline, "exportScheduleData") as () => {
        ok: boolean;
        error?: { code: string; path?: string };
      };
      let exported: ReturnType<typeof exportScheduleData>;
      expect(() => {
        exported = exportScheduleData();
      }).not.toThrow(RangeError);
      expect(exported!.ok).toBe(false);
      expect(exported!.error?.code).toBe("invalid_input");
      expect(exported!.error?.path).toContain("media");
    });

    it("rejects legacy-loaded waveform buffers containing non-finite values on export", () => {
      const timeline = createTimeline();
      const badWaveform = new Float32Array([Number.NaN]);
      timeline.loadData({
        tracks: [
          {
            businessId: "T1",
            events: [
              { startTime: 10, endTime: 20, title: "x", businessId: "E1", media: { waveform: { data: badWaveform } } },
            ],
          },
        ],
      } as never);
      const exportScheduleData = requireMethod(timeline, "exportScheduleData") as () => {
        ok: boolean;
        error?: { code: string; path?: string };
      };
      const exported = exportScheduleData();
      expect(exported.ok).toBe(false);
      expect(exported.error?.code).toBe("invalid_input");
      expect(exported.error?.path).toContain("waveform");
    });
  });
});
