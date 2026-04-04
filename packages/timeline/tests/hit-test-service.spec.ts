import { describe, expect, it } from "vitest";

import { EventIndexManager } from "../src/core/managers/EventIndexManager";
import { HitTestService } from "../src/core/managers/HitTestService";
import { StateManager } from "../src/core/managers/StateManager";
import type { TimelineConfig, TimelineEvent } from "../src/types";
import {
  DEFAULT_COLORS,
  DEFAULT_CONFIG,
  DEFAULT_CONTEXT_MENU_ITEMS,
  DEFAULT_CONTEXT_MENU_STYLE,
  DEFAULT_EVENT_BLOCK_STYLE,
  DEFAULT_EVENT_TEXT_STYLE,
} from "../src/utils";

function createConfig(): TimelineConfig {
  return {
    ...DEFAULT_CONFIG,
    startPaddingTime: 0,
    timelineHeight: 20,
    firstTrackTopMargin: 0,
    trackHeight: 40,
    trackMargin: 10,
    secondWidth: 10,
    resizeHandleWidth: 8,
    autoFitOnInit: false,
    colors: DEFAULT_COLORS,
    eventTextStyle: DEFAULT_EVENT_TEXT_STYLE,
    eventBlockStyle: DEFAULT_EVENT_BLOCK_STYLE,
    contextMenuItems: DEFAULT_CONTEXT_MENU_ITEMS,
    contextMenuStyle: DEFAULT_CONTEXT_MENU_STYLE,
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
  };
}

function createService() {
  const config = createConfig();
  const stateManager = new StateManager(config);
  stateManager.state.tracks = [
    {
      id: 0,
      events: [
        createEvent(0, 10, 20, "底层事件"),
        createEvent(1, 15, 25, "顶层事件"),
      ],
    },
  ];
  const eventIndexManager = new EventIndexManager(stateManager.state);
  const service = new HitTestService(config, stateManager.state, eventIndexManager);

  return { service };
}

describe("HitTestService", () => {
  it("在重叠事件上返回最高 z-order 的事件体", () => {
    const { service } = createService();

    expect(service.getInteractionTarget(160, 30)).toEqual({
      trackIndex: 0,
      eventIndex: 1,
      resizeEdge: null,
    });
    expect(service.getEventAtPosition(160, 30)).toEqual({
      trackIndex: 0,
      eventIndex: 1,
    });
  });

  it("在 resize handle 与事件体重叠时优先返回 handle", () => {
    const { service } = createService();

    expect(service.getInteractionTarget(150, 30)).toEqual({
      trackIndex: 0,
      eventIndex: 1,
      resizeEdge: "left",
    });
    expect(service.getResizeHandle(150, 30)).toEqual({
      trackIndex: 0,
      eventIndex: 1,
      edge: "left",
    });
  });

  it("在轨道空白与非事件垂直区域保持兼容行为", () => {
    const { service } = createService();

    expect(service.getInteractionTarget(160, 22)).toEqual({
      trackIndex: 0,
      eventIndex: null,
      resizeEdge: null,
    });
    expect(service.getEventAtPosition(160, 22)).toBeNull();
    expect(service.getResizeHandle(160, 5)).toBeNull();
  });
});
