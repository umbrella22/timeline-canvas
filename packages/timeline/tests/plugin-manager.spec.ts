import { describe, expect, it, vi } from "vitest";

import { PluginManager } from "../src/core/managers/PluginManager";
import { StateManager } from "../src/core/managers/StateManager";
import type { Timeline } from "../src/core/Timeline";
import { PluginType, type PluginContext, type TimelinePlugin } from "../src/plugins/types";
import type { TimelineConfig } from "../src/types";
import {
  DEFAULT_COLORS,
  DEFAULT_CONFIG,
  DEFAULT_CONTEXT_MENU_ITEMS,
  DEFAULT_CONTEXT_MENU_STYLE,
  DEFAULT_EVENT_BLOCK_STYLE,
  DEFAULT_EVENT_TEXT_STYLE,
} from "../src/utils";

function createConfig(debug = false): TimelineConfig {
  return {
    ...DEFAULT_CONFIG,
    autoFitOnInit: false,
    debug,
    colors: DEFAULT_COLORS,
    eventTextStyle: DEFAULT_EVENT_TEXT_STYLE,
    eventBlockStyle: DEFAULT_EVENT_BLOCK_STYLE,
    contextMenuItems: DEFAULT_CONTEXT_MENU_ITEMS,
    contextMenuStyle: DEFAULT_CONTEXT_MENU_STYLE,
  };
}

function createBaseContext(debug = false): Omit<PluginContext, "api"> {
  const config = createConfig(debug);
  const state = new StateManager(config).state;

  return {
    timeline: {} as Timeline,
    config,
    state,
  };
}

function createPlugin(
  overrides: Partial<TimelinePlugin> = {}
): TimelinePlugin {
  return {
    metadata: {
      name: "test-plugin",
      version: "1.0.0",
      description: "test plugin",
      type: PluginType.EXTENSION,
    },
    ...overrides,
  };
}

describe("PluginManager", () => {
  it("在非 debug 模式下对加载失败保持安全失败", async () => {
    const manager = new PluginManager(createBaseContext(false));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await manager.loadPlugin(
      createPlugin({
        init() {
          throw new Error("boom");
        },
      })
    );

    expect(result).toBe(false);
    expect(manager.getLoadedPlugins()).toHaveLength(0);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("在 debug 模式下记录插件加载错误上下文", async () => {
    const manager = new PluginManager(createBaseContext(true));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await manager.loadPlugin(
      createPlugin({
        activate() {
          throw new Error("boom");
        },
      })
    );

    expect(result).toBe(false);
    expect(manager.getLoadedPlugins()).toHaveLength(0);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("在卸载失败后返回 false 并完成资源清理", async () => {
    const manager = new PluginManager(createBaseContext(true));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const plugin = createPlugin({
      deactivate() {
        throw new Error("boom");
      },
    });

    await manager.loadPlugin(plugin);
    const result = await manager.unloadPlugin("test-plugin@1.0.0");

    expect(result).toBe(false);
    expect(manager.getLoadedPlugins()).toHaveLength(0);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
