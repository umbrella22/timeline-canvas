import { describe, expect, it, vi } from "vite-plus/test";

import { PluginType, Timeline } from "../src";
import type { TimelineConfig, TimelineState } from "../src/types";
import { drawEventContent } from "../src/renderers/core/EventContentRenderer";
import type { TimelinePlugin } from "../src/plugins/types";
import { createMockCanvas, createMockCanvasContext } from "./helpers";

type AnyRecord = Record<string, unknown>;

function createTimeline(
  options: ConstructorParameters<typeof Timeline>[1] = {},
): Timeline {
  createMockCanvas("event-content-canvas", 400, 120);
  return new Timeline("event-content-canvas", {
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

function loadOneEvent(timeline: Timeline): void {
  timeline.loadData({
    tracks: [{ events: [{ startTime: 10, endTime: 20, title: "WO-26091" }] }],
  });
}

function dragEvent(timeline: Timeline): Promise<void> {
  const canvas = timeline.getCanvas();
  const fire = (type: string, x: number, y: number): void => {
    canvas.dispatchEvent(
      new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }),
    );
  };
  fire("mousedown", 150, 40);
  fire("mousemove", 190, 40);
  // 等待 RAF 节流的拖动帧真正执行（此时 draggingEvent.isDragging 为 true），再抬起
  return new Promise((resolve) => setTimeout(resolve, 30)).then(() => {
    fire("mouseup", 190, 40);
  });
}

describe("M1 unified event content contracts", () => {
  describe("C-04 unified event content rendering (T-RENDER)", () => {
    it("invokes TimelineOptions.renderEventContent for normal draws", () => {
      const renderEventContent = vi.fn();
      const timeline = createTimeline({
        renderEventContent,
      } as unknown as ConstructorParameters<typeof Timeline>[1]);
      loadOneEvent(timeline);
      timeline.draw();
      expect(renderEventContent).toHaveBeenCalled();
      const context = renderEventContent.mock.calls[0][0] as AnyRecord;
      expect(context.phase).toBe("normal");
      expect((context.event as AnyRecord).title).toBe("WO-26091");
      expect(context.rect).toEqual(
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
          width: expect.any(Number),
          height: expect.any(Number),
        }),
      );
      expect(typeof context.drawDefaultContent).toBe("function");
    });

    it("routes drag preview content through the shared entry with phase 'drag'", async () => {
      const renderEventContent = vi.fn();
      const timeline = createTimeline({
        renderEventContent,
      } as unknown as ConstructorParameters<typeof Timeline>[1]);
      loadOneEvent(timeline);
      await dragEvent(timeline);
      const phases = renderEventContent.mock.calls.map(
        (call) => (call[0] as AnyRecord).phase,
      );
      expect(phases).toContain("drag");
    });

    it("emits the media hook during the drag frame where the source is skipped", async () => {
      // state 是活引用，必须在调用瞬间记录 isDragging
      const dragFrameEmissions: boolean[] = [];
      const mediaHook = vi.fn((...args: unknown[]) => {
        const state = args[3] as { draggingEvent?: { isDragging?: boolean } } | undefined;
        dragFrameEmissions.push(Boolean(state?.draggingEvent?.isDragging));
      });
      const timeline = createTimeline();
      const plugin: TimelinePlugin = {
        metadata: {
          name: "count-media-hook",
          version: "1.0.0",
          description: "count media hook",
          type: PluginType.EVENT_HANDLER,
        },
        activate: (context) => {
          context.api.registerEventHandler("render:event:media", mediaHook as never);
        },
      };
      await timeline.usePlugin(plugin);
      loadOneEvent(timeline);
      await dragEvent(timeline);
      // 拖动帧（isDragging 为 true）此前完全不发射媒体 hook
      expect(dragFrameEmissions.some(Boolean)).toBe(true);
    });

    it("falls back to default content when the custom renderer throws", async () => {
      const defaultContent = vi.fn();
      drawEventContent({
        ctx: createMockCanvasContext(),
        canvas: createMockCanvas("event-content-unit-canvas", 300, 120),
        config: { trackHeight: 40, timelineHeight: 20, readOnly: false, startPaddingTime: 0, endPaddingTime: 0, startTime: 0, endTime: 100, secondWidth: 10 } as unknown as TimelineConfig,
        state: { scrollX: 0, scrollY: 0, zoomLevel: 1 } as unknown as TimelineState,
        dpr: 1,
        event: { id: 0, startTime: 10, endTime: 20, duration: 10, title: "t", description: "", color: "#000" },
        track: { id: 0, events: [] },
        trackIndex: 0,
        eventIndex: 0,
        rect: { x: 100, y: 20, width: 100, height: 40 },
        phase: "normal",
        selected: false,
        highlighted: false,
        drawDefaultContent: defaultContent,
        renderEventContent: () => {
          throw new Error("renderer boom");
        },
      });
      expect(defaultContent).toHaveBeenCalledTimes(1);

      // Timeline 级别：自定义绘制抛异常不冒泡，绘制链可恢复
      const renderEventContent = vi.fn(() => {
        throw new Error("renderer boom");
      });
      const timeline = createTimeline({
        renderEventContent,
      } as unknown as ConstructorParameters<typeof Timeline>[1]);
      loadOneEvent(timeline);
      expect(() => timeline.draw()).not.toThrow();
      expect(renderEventContent).toHaveBeenCalled();
    });
  });
});
