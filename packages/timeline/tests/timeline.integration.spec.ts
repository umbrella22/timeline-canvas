import { describe, expect, it, vi } from "vitest";

import { Timeline } from "../src";
import { PluginType, type TimelinePlugin } from "../src/plugins/types";
import { createMockCanvas } from "./helpers";

function createTimeline(
  options: ConstructorParameters<typeof Timeline>[1] = {}
): Timeline {
  createMockCanvas("timelineCanvas", 200, 120);
  return new Timeline("timelineCanvas", {
    autoFitOnInit: false,
    startTime: 0,
    endTime: 100,
    startPaddingTime: 0,
    secondWidth: 10,
    ...options,
  });
}

describe("Timeline integration", () => {
  it("通过公开 API 保持命中检测优先级", () => {
    const timeline = createTimeline({
      timelineHeight: 20,
      firstTrackTopMargin: 0,
      trackHeight: 40,
      trackMargin: 10,
      resizeHandleWidth: 8,
    });

    timeline.loadData({
      tracks: [
        {
          events: [
            { startTime: 10, endTime: 20, title: "底层事件" },
            { startTime: 15, endTime: 25, title: "顶层事件" },
          ],
        },
      ],
    });

    expect(timeline.getInteractionTarget(150, 30)).toEqual({
      trackIndex: 0,
      eventIndex: 1,
      resizeEdge: "left",
    });
    expect(timeline.getEventAtPosition(160, 30)).toEqual({
      trackIndex: 0,
      eventIndex: 1,
    });
  });

  it("默认边界滚动参数保持旧行为", () => {
    const timeline = createTimeline();

    vi.spyOn(performance, "now").mockReturnValue(1000);
    timeline.setTimeIndicatorDuringDrag(25);

    expect(timeline.state.scrollX).toBe(100);
  });

  it("支持自定义边界滚动参数", () => {
    const timeline = createTimeline({
      edgeScrollThrottle: 10,
      edgeScrollTriggerMargin: 20,
      edgeScrollViewportMargin: 60,
    });

    vi.spyOn(performance, "now").mockReturnValue(1000);
    timeline.setTimeIndicatorDuringDrag(25);

    expect(timeline.state.scrollX).toBe(110);
  });

  it("异常边界滚动参数回退到默认值", () => {
    const timeline = createTimeline({
      edgeScrollThrottle: Number.NaN,
      edgeScrollTriggerMargin: Number.NaN,
      edgeScrollViewportMargin: -10,
    });

    vi.spyOn(performance, "now").mockReturnValue(1000);
    timeline.setTimeIndicatorDuringDrag(25);

    expect(timeline.state.scrollX).toBe(100);
  });

  it("公开插件 API 保持失败返回语义", async () => {
    const timeline = createTimeline({ debug: true });
    const plugin: TimelinePlugin = {
      metadata: {
        name: "broken-plugin",
        version: "1.0.0",
        description: "broken plugin",
        type: PluginType.EXTENSION,
      },
      activate() {
        throw new Error("boom");
      },
    };

    await expect(timeline.usePlugin(plugin)).resolves.toBe(false);
    expect(timeline.getLoadedPlugins()).toHaveLength(0);
  });
});
