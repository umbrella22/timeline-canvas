import type { TimelinePlugin } from "../../plugins/types";
import { PluginType } from "../../plugins/types";
import type { PluginManager } from "./PluginManager";

type PluginControllerManager = Pick<
  PluginManager,
  "loadPlugin" | "unloadPlugin" | "getLoadedPlugins" | "isPluginLoaded"
>;

export interface PluginControllerOptions {
  pluginManager: PluginControllerManager;
  builtinThemes: {
    light: TimelinePlugin;
    dark: TimelinePlugin;
  };
  onThemeChanged: () => void;
  onPluginVisualChange: () => void;
}

export class PluginController {
  private readonly pluginManager: PluginControllerManager;
  private readonly builtinThemes: PluginControllerOptions["builtinThemes"];
  private readonly onThemeChanged: () => void;
  private readonly onPluginVisualChange: () => void;
  private currentTheme: TimelinePlugin | null = null;
  private themeQueue: Promise<unknown> = Promise.resolve();
  private queuedThemeIds = new Map<string, number>();

  constructor(options: PluginControllerOptions) {
    this.pluginManager = options.pluginManager;
    this.builtinThemes = options.builtinThemes;
    this.onThemeChanged = options.onThemeChanged;
    this.onPluginVisualChange = options.onPluginVisualChange;
  }

  public loadInitialTheme(plugin: TimelinePlugin): void {
    void this.switchThemePlugin(plugin);
  }

  public async usePlugin(plugin: TimelinePlugin): Promise<boolean> {
    if (this.isThemePlugin(plugin)) {
      return this.switchThemePlugin(plugin);
    }

    const loaded = await this.pluginManager.loadPlugin(plugin);
    if (!loaded) {
      return false;
    }

    this.onPluginVisualChange();
    return true;
  }

  public getLoadedPlugins(): TimelinePlugin[] {
    return this.pluginManager.getLoadedPlugins();
  }

  public isPluginLoaded(pluginName: string): boolean {
    return this.pluginManager.isPluginLoaded(pluginName);
  }

  public async removePlugin(pluginId: string): Promise<boolean> {
    if (
      this.queuedThemeIds.has(pluginId) ||
      (this.currentTheme && this.getPluginId(this.currentTheme) === pluginId)
    ) {
      return this.enqueueTheme(pluginId, () => this.remove(pluginId));
    }
    return this.remove(pluginId);
  }

  private async remove(pluginId: string): Promise<boolean> {
    const removed = await this.pluginManager.unloadPlugin(pluginId);
    if (this.currentTheme && this.getPluginId(this.currentTheme) === pluginId) {
      // A dependency veto leaves the entry active. A failed teardown still detaches it.
      if (removed || !this.hasLoadedId(pluginId)) {
        this.currentTheme = null;
        this.onThemeChanged();
      }
    } else if (removed) {
      this.onPluginVisualChange();
    }
    return removed;
  }

  public setTheme(theme: "light" | "dark"): Promise<boolean> {
    return this.switchThemePlugin(this.builtinThemes[theme]);
  }

  private enqueueTheme(id: string, action: () => Promise<boolean>): Promise<boolean> {
    this.queuedThemeIds.set(id, (this.queuedThemeIds.get(id) ?? 0) + 1);
    const task = this.themeQueue.then(action).finally(() => {
      const remaining = this.queuedThemeIds.get(id)! - 1;
      if (remaining) this.queuedThemeIds.set(id, remaining);
      else this.queuedThemeIds.delete(id);
    });
    this.themeQueue = task.catch(() => false);
    return task;
  }

  private switchThemePlugin(plugin: TimelinePlugin): Promise<boolean> {
    const id = this.getPluginId(plugin);
    return this.enqueueTheme(id, async () => {
      const previous = this.currentTheme;
      if (previous) {
        const previousId = this.getPluginId(previous);
        if (previousId === id) return true;
        if (!(await this.pluginManager.unloadPlugin(previousId))) {
          if (!this.hasLoadedId(previousId)) await this.restoreTheme(previous);
          return false;
        }
      }
      this.currentTheme = null;
      if (!(await this.pluginManager.loadPlugin(plugin))) {
        await this.restoreTheme(previous);
        return false;
      }
      this.currentTheme = plugin;
      this.onThemeChanged();
      return true;
    });
  }

  private async restoreTheme(previous: TimelinePlugin | null): Promise<void> {
    this.currentTheme =
      previous && (await this.pluginManager.loadPlugin(previous)) ? previous : null;
    if (previous && !this.currentTheme) this.onThemeChanged();
    else this.onPluginVisualChange();
  }

  private hasLoadedId(id: string): boolean {
    return this.pluginManager.getLoadedPlugins().some((plugin) => this.getPluginId(plugin) === id);
  }

  private getPluginId(plugin: TimelinePlugin): string {
    return `${plugin.metadata.name}@${plugin.metadata.version}`;
  }

  private isThemePlugin(plugin: TimelinePlugin): boolean {
    return plugin.metadata.type === PluginType.THEME;
  }
}
