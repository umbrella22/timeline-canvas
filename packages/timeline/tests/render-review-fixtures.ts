import { vi } from "vite-plus/test";
import type { Timeline } from "../src/core/Timeline";
import { PluginManager } from "../src/core/managers/PluginManager";
import { StateManager } from "../src/core/managers/StateManager";
import { PluginType, type TimelinePlugin } from "../src/plugins/types";
import type { TimelineConfig } from "../src/types";
import {
  DEFAULT_CONFIG,
  DEFAULT_COLORS,
  DEFAULT_EVENT_BLOCK_STYLE,
  DEFAULT_EVENT_TEXT_STYLE,
  DEFAULT_CONTEXT_MENU_ITEMS,
  DEFAULT_CONTEXT_MENU_STYLE,
} from "../src/utils";
import { createMockCanvas, createMockCanvasContext } from "./helpers";

export function fixture(overrides: Partial<TimelineConfig> = {}) {
  const config: TimelineConfig = {
    ...DEFAULT_CONFIG,
    colors: { ...DEFAULT_COLORS },
    eventBlockStyle: { ...DEFAULT_EVENT_BLOCK_STYLE, borderRadius: 0 },
    eventTextStyle: DEFAULT_EVENT_TEXT_STYLE,
    contextMenuItems: DEFAULT_CONTEXT_MENU_ITEMS,
    contextMenuStyle: DEFAULT_CONTEXT_MENU_STYLE,
    trackHeight: 40,
    timelineHeight: 20,
    trackMargin: 5,
    firstTrackTopMargin: 0,
    startTime: 0,
    endTime: 300,
    startPaddingTime: 0,
    secondWidth: 1,
    ...overrides,
  };
  const state = new StateManager(config).state;
  const canvas = createMockCanvas("review", 400, 150);
  const timeline = {
    getCanvas: () => canvas,
    markDirty: vi.fn<Timeline["markDirty"]>(),
    draw: vi.fn<Timeline["draw"]>(),
    t: (s: string) => s,
    getEventAtPosition: vi.fn(() => ({ trackIndex: 0, eventIndex: 0 })),
  };
  const manager = new PluginManager({ config, state, timeline: timeline as unknown as Timeline });
  return { config, state, canvas, timeline, manager };
}

export function plugin(
  name: string,
  activate?: TimelinePlugin["activate"],
  metadata: Partial<TimelinePlugin["metadata"]> = {},
): TimelinePlugin {
  return {
    metadata: { name, version: "1", description: name, type: PluginType.EXTENSION, ...metadata },
    activate,
  };
}

export function event(title = "X") {
  return {
    id: 1,
    businessId: "X",
    startTime: 20,
    endTime: 80,
    duration: 60,
    title,
    description: "",
    color: "red",
  };
}

// Canvas mocks that count save/restore calls cannot tell which clip or transform survived.
export function stackContext() {
  const ctx = createMockCanvasContext();
  let current = { scale: 1, clips: 0 };
  const stack: (typeof current)[] = [];
  ctx.save = () => {
    stack.push({ ...current });
  };
  ctx.restore = () => {
    current = stack.pop() ?? current;
  };
  ctx.scale = (x) => {
    current.scale *= x;
  };
  ctx.clip = () => {
    current.clips++;
  };
  ctx.getTransform = () => ({ a: current.scale, b: 0, c: 0, d: current.scale }) as DOMMatrix;
  return { ctx, snapshot: () => ({ ...current, depth: stack.length }) };
}
