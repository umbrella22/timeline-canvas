import { describe, expect, it } from "vitest";

import { EventIndexManager } from "../src/core/managers/EventIndexManager";
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

function toSortedSet(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

describe("EventIndexManager", () => {
  it("保留长事件候选并支持边距查询", () => {
    const stateManager = new StateManager(createConfig());
    stateManager.state.tracks = [
      {
        id: 0,
        events: [
          createEvent(0, 0, 100, "长事件"),
          createEvent(1, 40, 41, "短事件"),
          createEvent(2, 55, 60, "右侧事件"),
        ],
      },
    ];

    const manager = new EventIndexManager(stateManager.state);

    expect(toSortedSet(manager.getCandidatesByTime(0, 50))).toEqual([0]);
    expect(toSortedSet(manager.getCandidatesByTime(0, 54.5, 1))).toEqual([
      0, 2,
    ]);
  });

  it("在轨道失效后按最新事件顺序重建索引", () => {
    const stateManager = new StateManager(createConfig());
    stateManager.state.tracks = [
      {
        id: 0,
        events: [
          createEvent(0, 10, 12, "较晚事件"),
          createEvent(1, 3, 6, "较早事件"),
        ],
      },
    ];

    const manager = new EventIndexManager(stateManager.state);

    expect(toSortedSet(manager.getCandidatesByTime(0, 11))).toEqual([0]);

    stateManager.state.tracks[0].events[1] = createEvent(1, 8, 15, "更新事件");
    manager.invalidateTrack(0);

    expect(toSortedSet(manager.getCandidatesByTime(0, 11))).toEqual([0, 1]);

    stateManager.state.tracks[0].events[0] = createEvent(0, 20, 25, "移走事件");
    manager.invalidateAll();

    expect(toSortedSet(manager.getCandidatesByTime(0, 11))).toEqual([1]);
  });

  it("批量失效结束后统一刷新多个轨道", () => {
    const stateManager = new StateManager(createConfig());
    stateManager.state.tracks = [
      {
        id: 0,
        events: [createEvent(0, 10, 12, "轨道一事件")],
      },
      {
        id: 1,
        events: [createEvent(1, 20, 22, "轨道二事件")],
      },
    ];

    const manager = new EventIndexManager(stateManager.state);

    expect(manager.getCandidatesByTime(0, 10.5)).toEqual([0]);
    expect(manager.getCandidatesByTime(1, 20.5)).toEqual([0]);

    manager.beginBatch();
    stateManager.state.tracks[0].events[0] = createEvent(0, 2, 4, "轨道一事件");
    stateManager.state.tracks[1].events[0] = createEvent(1, 6, 8, "轨道二事件");
    manager.invalidateTrack(0);
    manager.invalidateTrack(1);
    manager.endBatch();

    expect(manager.getCandidatesByTime(0, 3)).toEqual([0]);
    expect(manager.getCandidatesByTime(1, 7)).toEqual([0]);
  });
});
