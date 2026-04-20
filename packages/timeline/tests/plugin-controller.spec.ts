import { describe, expect, it, vi } from "vitest";

import {
  PluginController,
  type PluginControllerOptions,
} from "../src/core/managers/PluginController";
import { PluginType, type TimelinePlugin } from "../src/plugins/types";

function createPlugin(
  name: string,
  type: PluginType = PluginType.EXTENSION
): TimelinePlugin {
  return {
    metadata: {
      name,
      version: "1.0.0",
      description: `${name} plugin`,
      type,
    },
  };
}

function createController() {
  const lightTheme = createPlugin("theme-light", PluginType.THEME);
  const darkTheme = createPlugin("theme-dark", PluginType.THEME);
  const loadPlugin = vi.fn(async (_plugin: TimelinePlugin) => true);
  const unloadPlugin = vi.fn(async (_pluginId: string) => true);
  const getLoadedPlugins = vi.fn((): TimelinePlugin[] => []);
  const isPluginLoaded = vi.fn((_pluginName: string) => false);
  const pluginManager: PluginControllerOptions["pluginManager"] = {
    loadPlugin,
    unloadPlugin,
    getLoadedPlugins,
    isPluginLoaded,
  };
  const onThemeChanged = vi.fn();
  const onPluginVisualChange = vi.fn();

  return {
    lightTheme,
    darkTheme,
    pluginManager,
    loadPlugin,
    unloadPlugin,
    onThemeChanged,
    onPluginVisualChange,
    controller: new PluginController({
      pluginManager,
      builtinThemes: {
        light: lightTheme,
        dark: darkTheme,
      },
      onThemeChanged,
      onPluginVisualChange,
    }),
  };
}

describe("PluginController", () => {
  it("普通插件加载与卸载后触发视觉刷新回调", async () => {
    const {
      controller,
      loadPlugin,
      unloadPlugin,
      onThemeChanged,
      onPluginVisualChange,
    } = createController();
    const plugin = createPlugin("overlay");

    await expect(controller.usePlugin(plugin)).resolves.toBe(true);
    await expect(controller.removePlugin("overlay@1.0.0")).resolves.toBe(true);

    expect(loadPlugin).toHaveBeenCalledWith(plugin);
    expect(unloadPlugin).toHaveBeenCalledWith("overlay@1.0.0");
    expect(onPluginVisualChange).toHaveBeenCalledTimes(2);
    expect(onThemeChanged).not.toHaveBeenCalled();
  });

  it("主题切换只触发主题变更回调，不触发普通重绘回调", async () => {
    const {
      controller,
      lightTheme,
      loadPlugin,
      unloadPlugin,
      onThemeChanged,
      onPluginVisualChange,
    } = createController();

    await expect(controller.usePlugin(lightTheme)).resolves.toBe(true);
    await expect(controller.setTheme("dark")).resolves.toBe(true);

    expect(loadPlugin).toHaveBeenCalledTimes(2);
    expect(unloadPlugin).toHaveBeenCalledWith("theme-light@1.0.0");
    expect(onThemeChanged).toHaveBeenCalledTimes(2);
    expect(onPluginVisualChange).not.toHaveBeenCalled();
  });

  it("移除当前主题后会清空主题状态，后续切换不再重复卸载旧主题", async () => {
    const {
      controller,
      lightTheme,
      loadPlugin,
      unloadPlugin,
      onThemeChanged,
      onPluginVisualChange,
    } = createController();

    await expect(controller.usePlugin(lightTheme)).resolves.toBe(true);
    loadPlugin.mockClear();
    unloadPlugin.mockClear();
    onThemeChanged.mockClear();

    await expect(controller.removePlugin("theme-light@1.0.0")).resolves.toBe(
      true
    );
    await expect(controller.setTheme("dark")).resolves.toBe(true);

    expect(unloadPlugin).toHaveBeenCalledTimes(1);
    expect(unloadPlugin).toHaveBeenCalledWith("theme-light@1.0.0");
    expect(loadPlugin).toHaveBeenCalledTimes(1);
    expect(onThemeChanged).toHaveBeenCalledTimes(2);
    expect(onPluginVisualChange).not.toHaveBeenCalled();
  });

  it("初始主题加载完成后会记录主题状态，供后续主题切换复用", async () => {
    const { controller, lightTheme, loadPlugin, unloadPlugin, onThemeChanged } =
      createController();

    controller.loadInitialTheme(lightTheme);
    await Promise.resolve();

    await expect(controller.setTheme("dark")).resolves.toBe(true);

    expect(loadPlugin).toHaveBeenNthCalledWith(1, lightTheme);
    expect(unloadPlugin).toHaveBeenCalledWith("theme-light@1.0.0");
    expect(onThemeChanged).toHaveBeenCalledTimes(2);
  });
});
