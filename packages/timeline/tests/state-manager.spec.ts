import { describe, expect, it, vi } from "vitest";

import { StateManager } from "../src/core/managers/StateManager";
import type { TimelineConfig } from "../src/types";
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

describe("StateManager", () => {
  it("使用配置中的开始时间初始化时间指示器", () => {
    const manager = new StateManager(createConfig({ startTime: 42 }));

    expect(manager.state.timeIndicatorPosition).toBe(42);
    expect(manager.state.statusText).toBe("Ready");
  });

  it("更新状态文本并触发回调", () => {
    const manager = new StateManager(createConfig());
    const onStatusChange = vi.fn();

    manager.setStatus("处理中", onStatusChange);

    expect(manager.state.statusText).toBe("处理中");
    expect(onStatusChange).toHaveBeenCalledWith("处理中");
  });
});
