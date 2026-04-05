import { describe, expect, it, vi } from "vitest";

import { PluginManager } from "../src/core/managers/PluginManager";
import { StateManager } from "../src/core/managers/StateManager";
import type { Timeline } from "../src/core/Timeline";
import {
  PluginPriority,
  PluginType,
  type PluginContext,
  type TimelinePlugin,
} from "../src/plugins/types";
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

function getPluginId(plugin: TimelinePlugin): string {
  return `${plugin.metadata.name}@${plugin.metadata.version}`;
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

  it("保留插件私有数据存储并使用 unknown 边界", async () => {
    const manager = new PluginManager(createBaseContext(false));
    let storedValue: unknown;

    const result = await manager.loadPlugin(
      createPlugin({
        activate(context) {
          context.api.setData("value", {
            nested: true,
          });
          storedValue = context.api.getData("value");
        },
      })
    );

    expect(result).toBe(true);
    expect(storedValue).toEqual({ nested: true });
  });

  it("在事件处理器抛错时保持安全失败语义", async () => {
    const manager = new PluginManager(createBaseContext(true));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await manager.loadPlugin(
      createPlugin({
        activate(context) {
          context.api.registerEventHandler("test:event", () => {
            throw new Error("boom");
          });
        },
      })
    );

    expect(() => manager.emitEvent("test:event", { id: 1 })).not.toThrow();
    expect(manager.validateEvent("test:event", { id: 1 })).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("卸载插件时清理事件处理器、渲染层和核心层钩子", async () => {
    const baseContext = createBaseContext(false);
    const manager = new PluginManager(baseContext);
    const eventHandler = vi.fn();
    const backgroundRender = vi.fn();
    const overlayRender = vi.fn();
    const plugin = createPlugin({
      activate(context) {
        context.api.registerEventHandler("test:event", eventHandler);
        context.api.registerRenderLayer({
          name: "test-background",
          position: "background",
          render: backgroundRender,
        });
        context.api.registerRenderLayer({
          name: "test-overlay",
          position: "overlay",
          render: overlayRender,
        });
        context.api.registerCoreLayerHook({
          name: "test-hook",
          target: "tracks",
          handler(_ctx, _canvas, _config, _state, next) {
            next();
          },
        });
      },
    });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    expect(context).not.toBeNull();
    await manager.loadPlugin(plugin);
    manager.emitEvent("test:event", { id: 1 });
    manager.renderBackground(context!, canvas, baseContext.config, baseContext.state);
    manager.renderOverlay(context!, canvas, baseContext.config, baseContext.state);

    expect(eventHandler).toHaveBeenCalledTimes(1);
    expect(backgroundRender).toHaveBeenCalledTimes(1);
    expect(overlayRender).toHaveBeenCalledTimes(1);
    expect(manager.getCoreLayerHooks("tracks")).toHaveLength(1);

    await manager.unloadPlugin(getPluginId(plugin));

    manager.emitEvent("test:event", { id: 2 });
    manager.renderBackground(context!, canvas, baseContext.config, baseContext.state);
    manager.renderOverlay(context!, canvas, baseContext.config, baseContext.state);

    expect(eventHandler).toHaveBeenCalledTimes(1);
    expect(backgroundRender).toHaveBeenCalledTimes(1);
    expect(overlayRender).toHaveBeenCalledTimes(1);
    expect(manager.getCoreLayerHooks("tracks")).toHaveLength(0);
  });

  it("插件加载失败时回滚已注册资源并执行反向生命周期清理", async () => {
    const baseContext = createBaseContext(true);
    const manager = new PluginManager(baseContext);
    const eventHandler = vi.fn();
    const renderLayer = vi.fn();
    const deactivate = vi.fn();
    const destroy = vi.fn();
    const plugin = createPlugin({
      activate(context) {
        context.api.registerEventHandler("test:event", eventHandler);
        context.api.registerRenderLayer({
          name: "rollback-background",
          position: "background",
          render: renderLayer,
        });
        context.api.registerCoreLayerHook({
          name: "rollback-hook",
          target: "tracks",
          handler(_ctx, _canvas, _config, _state, next) {
            next();
          },
        });
        throw new Error("boom");
      },
      deactivate,
      destroy,
    });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    expect(context).not.toBeNull();
    await expect(manager.loadPlugin(plugin)).resolves.toBe(false);

    manager.emitEvent("test:event", { id: 1 });
    manager.renderBackground(context!, canvas, baseContext.config, baseContext.state);

    expect(eventHandler).not.toHaveBeenCalled();
    expect(renderLayer).not.toHaveBeenCalled();
    expect(manager.getCoreLayerHooks("tracks")).toHaveLength(0);
    expect(manager.getLoadedPlugins()).toHaveLength(0);
    expect(deactivate).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("按插件优先级调度事件处理器和渲染层", async () => {
    const baseContext = createBaseContext(false);
    const manager = new PluginManager(baseContext);
    const calls: string[] = [];
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    expect(context).not.toBeNull();

    const lowPriorityPlugin = createPlugin({
      metadata: {
        name: "low-priority",
        version: "1.0.0",
        description: "low priority plugin",
        type: PluginType.EXTENSION,
        priority: PluginPriority.LOW,
      },
      activate(ctx) {
        ctx.api.registerEventHandler("test:event", () => {
          calls.push("low:event");
        });
        ctx.api.registerRenderLayer({
          name: "low-layer",
          position: "background",
          render() {
            calls.push("low:layer");
          },
        });
        ctx.api.registerCoreLayerHook({
          name: "low-hook",
          target: "tracks",
          handler(_ctx, _canvas, _config, _state, next) {
            calls.push("low:hook");
            next();
          },
        });
      },
    });
    const highPriorityPlugin = createPlugin({
      metadata: {
        name: "high-priority",
        version: "1.0.0",
        description: "high priority plugin",
        type: PluginType.EXTENSION,
        priority: PluginPriority.CRITICAL,
      },
      activate(ctx) {
        ctx.api.registerEventHandler("test:event", () => {
          calls.push("high:event");
        });
        ctx.api.registerRenderLayer({
          name: "high-layer",
          position: "background",
          render() {
            calls.push("high:layer");
          },
        });
        ctx.api.registerCoreLayerHook({
          name: "high-hook",
          target: "tracks",
          handler(_ctx, _canvas, _config, _state, next) {
            calls.push("high:hook");
            next();
          },
        });
      },
    });

    await manager.loadPlugin(lowPriorityPlugin);
    await manager.loadPlugin(highPriorityPlugin);

    manager.emitEvent("test:event", { id: 1 });
    manager.renderBackground(context!, canvas, baseContext.config, baseContext.state);
    manager.getCoreLayerHooks("tracks").forEach((hook) => {
      hook.handler(context!, canvas, baseContext.config, baseContext.state, () => {
        calls.push("default:hook");
      });
    });

    expect(calls.slice(0, 2)).toEqual(["high:event", "low:event"]);
    expect(calls.slice(2, 4)).toEqual(["high:layer", "low:layer"]);
    expect(calls.slice(4)).toEqual([
      "high:hook",
      "default:hook",
      "low:hook",
      "default:hook",
    ]);
  });

  it("在依赖插件未加载时拒绝加载并在依赖满足后允许加载", async () => {
    const manager = new PluginManager(createBaseContext(true));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const dependencyPlugin = createPlugin({
      metadata: {
        name: "base-plugin",
        version: "1.0.0",
        description: "base plugin",
        type: PluginType.EXTENSION,
      },
    });
    const dependentPlugin = createPlugin({
      metadata: {
        name: "dependent-plugin",
        version: "1.0.0",
        description: "dependent plugin",
        type: PluginType.EXTENSION,
        dependencies: ["base-plugin"],
      },
    });

    await expect(manager.loadPlugin(dependentPlugin)).resolves.toBe(false);
    expect(manager.getLoadedPlugins()).toHaveLength(0);
    expect(consoleErrorSpy).toHaveBeenCalled();

    await expect(manager.loadPlugin(dependencyPlugin)).resolves.toBe(true);
    await expect(manager.loadPlugin(dependentPlugin)).resolves.toBe(true);
    expect(manager.getLoadedPlugins()).toHaveLength(2);
  });
});
