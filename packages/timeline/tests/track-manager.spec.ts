import { describe, expect, it } from "vitest";

import { TrackManager } from "../src/core/managers/TrackManager";
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

function createEvent(id: number, title: string): TimelineEvent {
  return {
    id,
    startTime: 0,
    endTime: 10,
    duration: 10,
    title,
    description: "",
    color: "#fff",
  };
}

describe("TrackManager", () => {
  it("追加空轨道并按当前长度分配 id", () => {
    const state = new StateManager(createConfig()).state;
    const manager = new TrackManager(state);

    expect(manager.addTrack()).toEqual({ id: 0, events: [] });
    expect(manager.addTrack()).toEqual({ id: 1, events: [] });
    expect(state.tracks.map((track) => track.id)).toEqual([0, 1]);
  });

  it("删除轨道时同步修正 selectedTrack，并保留最后一条轨道", () => {
    const state = new StateManager(createConfig()).state;
    const manager = new TrackManager(state);

    manager.addTrack();
    manager.addTrack();
    manager.addTrack();
    state.selectedTrack = 2;

    expect(manager.removeTrack()?.id).toBe(2);
    expect(state.selectedTrack).toBe(1);
    expect(manager.removeTrack()?.id).toBe(1);
    expect(state.selectedTrack).toBe(0);
    expect(manager.removeTrack()).toBeNull();
    expect(state.tracks).toHaveLength(1);
  });

  it("只移除尾部空轨道，保留最后一个非空轨道", () => {
    const state = new StateManager(createConfig()).state;
    const manager = new TrackManager(state);

    manager.addTrack();
    manager.addTrack();
    state.tracks[1].events.push(createEvent(0, "已占用轨道"));
    manager.addTrack();

    expect(manager.removeEmptyLastTrack()?.id).toBe(2);
    expect(manager.removeEmptyLastTrack()).toBeNull();
    expect(state.tracks.map((track) => track.id)).toEqual([0, 1]);
    expect(state.tracks[1].events[0].title).toBe("已占用轨道");
  });
});
