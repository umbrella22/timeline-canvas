import { describe, expect, it, vi } from "vitest";

import {
  LightThemePlugin,
  Timeline,
  DarkThemePlugin,
  getPluginMetadataDescription,
} from "../src";
import { PluginType, type TimelinePlugin } from "../src/plugins/types";
import { MutexGuardPlugin } from "../src/plugins/builtin/MutexGuardPlugin";
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
  it("内置插件 metadata 描述支持按 locale 解析", () => {
    expect(getPluginMetadataDescription(DarkThemePlugin.metadata, "zh-CN")).toBe(
      "时间轴暗色主题"
    );
    expect(getPluginMetadataDescription(LightThemePlugin.metadata, "en")).toBe(
      "Light theme for timeline"
    );
  });

  it("支持通过 locale 切换默认运行时文案", () => {
    const timeline = createTimeline({ locale: "zh-CN" });

    expect(timeline.getStatus()).toBe("就绪");
    expect(timeline.config.eventDurationPrefix).toBe("时长");
    expect(timeline.config.contextMenuItems.map((item) => item.name)).toEqual([
      "编辑",
      "删除",
      "导出",
    ]);
    expect(timeline.t("labelTrackName", { index: 2 })).toBe("轨道 2");
  });

  it("支持通过 messages 覆盖默认翻译", () => {
    const timeline = createTimeline({
      locale: "zh-CN",
      messages: {
        statusReady: "已准备",
        contextMenuEdit: "修改",
      },
    });

    expect(timeline.getStatus()).toBe("已准备");
    expect(timeline.config.contextMenuItems[0].name).toBe("修改");
  });

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

  it("usePlugin 和 removePlugin 在普通插件变更后触发重绘", async () => {
    const timeline = createTimeline();
    const drawSpy = vi.spyOn(timeline, "draw");
    const plugin: TimelinePlugin = {
      metadata: {
        name: "redraw-plugin",
        version: "1.0.0",
        description: "redraw plugin",
        type: PluginType.EXTENSION,
      },
    };

    await expect(timeline.usePlugin(plugin)).resolves.toBe(true);
    await expect(timeline.removePlugin("redraw-plugin@1.0.0")).resolves.toBe(true);

    expect(drawSpy).toHaveBeenCalledTimes(2);
  });

  it("移除当前主题后 setTheme 仍可正常切换主题", async () => {
    const timeline = createTimeline();

    await expect(timeline.usePlugin(LightThemePlugin)).resolves.toBe(true);
    await expect(timeline.removePlugin("theme-light@1.0.0")).resolves.toBe(true);
    await expect(timeline.setTheme("dark")).resolves.toBe(true);

    expect(timeline.isPluginLoaded("theme-light")).toBe(false);
    expect(timeline.isPluginLoaded("theme-dark")).toBe(true);
    expect(timeline.config.colors.canvasBackground).toBe("#1E1E2E");
  });

  it("usePlugin 加载主题插件时替换旧主题并同步主题状态", async () => {
    const timeline = createTimeline();

    await expect(timeline.usePlugin(LightThemePlugin)).resolves.toBe(true);
    await expect(timeline.setTheme("dark")).resolves.toBe(true);
    await expect(timeline.usePlugin(LightThemePlugin)).resolves.toBe(true);

    expect(timeline.isPluginLoaded("theme-dark")).toBe(false);
    expect(timeline.isPluginLoaded("theme-light")).toBe(true);
    expect(timeline.config.colors.canvasBackground).toBe("#FFFFFF");
    expect(timeline.config.colors.eventColors[0]).toBe("rgba(63, 118, 252, 0.16)");
    expect(timeline.config.colors.eventText).toBe("#FFFFFF");
    expect(timeline.config.colors.eventOverlay).toBe("rgba(63, 118, 252, 0.12)");
  });

  it("MutexGuardPlugin 卸载后注销校验处理器", async () => {
    const timeline = createTimeline();
    const plugin = MutexGuardPlugin();

    timeline.loadData({
      tracks: [
        {
          events: [
            {
              startTime: 0,
              endTime: 10,
              title: "事件 A",
              customData: { mutex: ["group-1"] },
            },
          ],
        },
        {
          events: [
            {
              startTime: 20,
              endTime: 30,
              title: "事件 B",
              customData: { mutex: ["group-1"] },
            },
          ],
        },
      ],
    });

    await expect(timeline.usePlugin(plugin)).resolves.toBe(true);

    expect(timeline.canMoveEvent(0, 0, 0, 22, 10)).toBe(false);

    await expect(
      timeline.removePlugin(`${plugin.metadata.name}@${plugin.metadata.version}`)
    ).resolves.toBe(true);

    expect(timeline.canMoveEvent(0, 0, 0, 22, 10)).toBe(true);
  });

  it("事件 CRUD 保持回调语义并深拷贝 customData", () => {
    const onEventAdd = vi.fn();
    const onEventUpdate = vi.fn();
    const onEventDelete = vi.fn();
    const timeline = createTimeline({
      onEventAdd,
      onEventUpdate,
      onEventDelete,
    });

    timeline.loadData({
      tracks: [{ events: [] }],
    });
    timeline.addEvent(0, 10, 20, "新事件", "说明", {
      nested: { enabled: true },
    });

    const addedEvent = onEventAdd.mock.calls[0][0].event as {
      customData: { nested: { enabled: boolean } };
    };
    addedEvent.customData.nested.enabled = false;

    expect(
      timeline.state.tracks[0].events[0].customData as {
        nested: { enabled: boolean };
      }
    ).toEqual({
      nested: { enabled: true },
    });

    expect(
      timeline.updateEventData(0, 0, {
        title: "已更新事件",
        duration: 15,
      })
    ).toBe(true);
    expect(timeline.deleteEvent(0, 0)).toBe(true);
    expect(onEventUpdate).toHaveBeenCalledTimes(1);
    expect(onEventDelete).toHaveBeenCalledTimes(1);
  });

  it("辅助线计算在服务拆分后保持结果兼容", () => {
    const timeline = createTimeline();

    timeline.loadData({
      tracks: [
        {
          events: [{ startTime: 10, endTime: 20, title: "事件 A" }],
        },
        {
          events: [{ startTime: 30, endTime: 40, title: "事件 B" }],
        },
      ],
    });

    expect(timeline.calculateGuideLines(0, 0, 1, 30, 10)).toEqual([
      {
        time: 30,
        type: "start",
        trackIndices: [1],
      },
      {
        time: 40,
        type: "end",
        trackIndices: [1],
      },
    ]);

    timeline.updateEventData(1, 0, { startTime: 35 });

    expect(timeline.calculateGuideLines(0, 0, 1, 35, 10)).toEqual([
      {
        time: 35,
        type: "start",
        trackIndices: [1],
      },
      {
        time: 45,
        type: "end",
        trackIndices: [1],
      },
    ]);
  });
});
