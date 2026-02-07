---
title: 插件管理 API
---

## usePlugin

`usePlugin(plugin: any): Promise<boolean>`

使用插件。

```ts
// 某些内置插件是“工厂函数”（需要调用以传入配置）
await timeline.usePlugin(ContextMenuPlugin());

// 某些内置插件是“插件对象”（直接传入）
await timeline.usePlugin(PerformanceOverlayPlugin);
```

## removePlugin

`removePlugin(pluginId: string): Promise<boolean>`

移除插件。

```ts
await timeline.removePlugin("performance-overlay@1.0.0");
```

## setTheme

`setTheme(theme: 'light' | 'dark'): Promise<boolean>`

在运行时切换内置主题。

```ts
// 初始化时设置默认主题
const timeline = new Timeline("timelineCanvas", { theme: LightThemePlugin });

// 动态切换到暗色主题
await timeline.setTheme("dark");

// 切回亮色主题
await timeline.setTheme("light");
```

## getLoadedPlugins

`getLoadedPlugins(): any[]`

获取已加载的插件列表。

```ts
const plugins = timeline.getLoadedPlugins();
console.log("已加载插件:", plugins);
```

## isPluginLoaded

`isPluginLoaded(pluginName: string): boolean`

检查插件是否已加载。

```ts
if (timeline.isPluginLoaded("performance-overlay")) {
  console.log("性能监控插件已加载");
}
```
