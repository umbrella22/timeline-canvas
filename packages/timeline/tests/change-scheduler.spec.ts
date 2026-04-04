import { describe, expect, it, vi } from "vitest";

import { ChangeScheduler } from "../src/core/managers/ChangeScheduler";
import { StateManager } from "../src/core/managers/StateManager";
import type { EventIndexManager } from "../src/core/managers/EventIndexManager";
import type { RenderManager } from "../src/core/managers/RenderManager";
import type {
  TimeIndicatorHighlightData,
  TimelineCallbacks,
  TimelineConfig,
  TimelineEvent,
} from "../src/types";
import {
  DEFAULT_COLORS,
  DEFAULT_CONFIG,
  DEFAULT_CONTEXT_MENU_ITEMS,
  DEFAULT_CONTEXT_MENU_STYLE,
  DEFAULT_EVENT_BLOCK_STYLE,
  DEFAULT_EVENT_TEXT_STYLE,
} from "../src/utils";

function createConfig(
  overrides: Partial<TimelineConfig> = {}
): TimelineConfig {
  return {
    ...DEFAULT_CONFIG,
    colors: DEFAULT_COLORS,
    eventTextStyle: DEFAULT_EVENT_TEXT_STYLE,
    eventBlockStyle: DEFAULT_EVENT_BLOCK_STYLE,
    contextMenuItems: DEFAULT_CONTEXT_MENU_ITEMS,
    contextMenuStyle: DEFAULT_CONTEXT_MENU_STYLE,
    ...overrides,
  };
}

function createEvent(
  id: number,
  startTime: number,
  endTime: number,
  title: string
): TimelineEvent {
  return {
    id,
    startTime,
    endTime,
    duration: endTime - startTime,
    title,
    description: "",
    color: "#fff",
    customData: { source: title },
  };
}

function createScheduler(
  overrides: Partial<TimelineConfig> = {},
  callbacks: TimelineCallbacks = {}
) {
  const config = createConfig(overrides);
  const stateManager = new StateManager(config);
  const scheduler = new ChangeScheduler(stateManager.state, config, callbacks);
  const markDirty = vi.fn();
  const draw = vi.fn();

  scheduler.setRenderManager(
    { markDirty } as unknown as RenderManager
  );
  scheduler.setDrawFunction(draw);

  return {
    scheduler,
    state: stateManager.state,
    config,
    callbacks,
    markDirty,
    draw,
  };
}

function toSortedPairs(
  values: Array<{ trackIndex: number; eventIndex: number }>
): Array<{ trackIndex: number; eventIndex: number }> {
  return [...values].sort((a, b) =>
    a.trackIndex === b.trackIndex
      ? a.eventIndex - b.eventIndex
      : a.trackIndex - b.trackIndex
  );
}

describe("ChangeScheduler", () => {
  it("使用索引管理器更新高亮并只在变化时触发回调", () => {
    const onTimeIndicatorHighlight = vi.fn<
      (data: TimeIndicatorHighlightData) => void
    >();
    const { scheduler, state, markDirty, draw } = createScheduler(
      {},
      { onTimeIndicatorHighlight }
    );

    state.tracks = [
      {
        id: 0,
        events: [
          createEvent(0, 10, 20, "事件一"),
          createEvent(1, 20, 30, "事件二"),
        ],
      },
    ];
    state.timeIndicatorPosition = 15;

    const getCandidatesByTime = vi.fn().mockReturnValue([0, 1]);
    scheduler.setEventIndexManager(
      { getCandidatesByTime } as unknown as EventIndexManager
    );

    scheduler.notify("timeIndicator:move");

    expect(getCandidatesByTime).toHaveBeenCalledWith(0, 15, 0);
    expect(state.timeIndicatorHighlightedEvents).toEqual([
      { trackIndex: 0, eventIndex: 0 },
    ]);
    expect(markDirty).toHaveBeenCalledWith([
      "indicator",
      "tracks",
      "timeline",
      "interaction",
    ]);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(onTimeIndicatorHighlight).toHaveBeenCalledTimes(1);

    const payload = onTimeIndicatorHighlight.mock.calls[0][0];
    expect(payload.position).toBe(15);
    expect(payload.highlightedEvents[0].event).toEqual(
      expect.objectContaining({
        id: 0,
        title: "事件一",
        customData: { source: "事件一" },
      })
    );
    expect(payload.highlightedEvents[0].event).not.toBe(
      state.tracks[0].events[0]
    );

    scheduler.notify("timeIndicator:move");

    expect(onTimeIndicatorHighlight).toHaveBeenCalledTimes(1);
  });

  it("批量通知时合并脏层并去重回调", () => {
    const onTimeIndicatorHighlight = vi.fn();
    const { scheduler, state, markDirty, draw } = createScheduler(
      {},
      { onTimeIndicatorHighlight }
    );

    state.tracks = [
      {
        id: 0,
        events: [createEvent(0, 10, 20, "事件一")],
      },
    ];
    state.timeIndicatorPosition = 15;

    scheduler.notifyMultiple([
      "timeIndicator:move",
      "timeIndicator:move",
      "scroll:x",
    ]);

    expect(draw).toHaveBeenCalledTimes(1);
    expect(markDirty).toHaveBeenCalledTimes(1);
    expect(new Set(markDirty.mock.calls[0][0])).toEqual(
      new Set([
        "indicator",
        "tracks",
        "timeline",
        "interaction",
        "guideLines",
        "scrollbar",
      ])
    );
    expect(onTimeIndicatorHighlight).toHaveBeenCalledTimes(1);
  });

  it("在无索引管理器时回退为全量扫描并支持更新回调", () => {
    const initialCallback = vi.fn();
    const nextCallback = vi.fn();
    const { scheduler, state, config } = createScheduler(
      { enableTimeIndicator: true },
      { onTimeIndicatorHighlight: initialCallback }
    );

    state.tracks = [
      {
        id: 0,
        events: [createEvent(0, 5, 15, "事件一"), createEvent(1, 15, 25, "事件二")],
      },
      {
        id: 1,
        events: [createEvent(2, 8, 12, "事件三")],
      },
    ];
    state.timeIndicatorPosition = 10;

    scheduler.notify("events:add");

    expect(toSortedPairs(state.timeIndicatorHighlightedEvents)).toEqual([
      { trackIndex: 0, eventIndex: 0 },
      { trackIndex: 1, eventIndex: 0 },
    ]);

    scheduler.updateCallbacks({ onTimeIndicatorHighlight: nextCallback });
    state.timeIndicatorPosition = 20;
    scheduler.notify("timeIndicator:move");

    expect(initialCallback).not.toHaveBeenCalled();
    expect(nextCallback).toHaveBeenCalledTimes(1);

    state.timeIndicatorPosition = 15;
    config.enableTimeIndicator = false;
    scheduler.notify("config:timeIndicator");
    expect(state.timeIndicatorHighlightedEvents).toEqual([]);

    scheduler.registerHandler("highlight:change", {
      layers: ["overlay"],
      derive: () => {
        state.statusText = "derived";
      },
      notify: () => {
        state.lastDrawTime = 1;
      },
      needsDraw: true,
    });
    scheduler.notify("highlight:change");

    expect(scheduler.getLayersForChange("highlight:change")).toEqual(["overlay"]);
    expect(state.statusText).toBe("derived");
    expect(state.lastDrawTime).toBe(1);
  });
});
