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
  private currentThemePluginId: string | null = null;

  constructor(options: PluginControllerOptions) {
    this.pluginManager = options.pluginManager;
    this.builtinThemes = options.builtinThemes;
    this.onThemeChanged = options.onThemeChanged;
    this.onPluginVisualChange = options.onPluginVisualChange;
  }

  public loadInitialTheme(plugin: TimelinePlugin): void {
    const pluginId = this.getPluginId(plugin);
    void this.pluginManager.loadPlugin(plugin).then((ok) => {
      if (!ok) {
        return;
      }

      this.currentThemePluginId = pluginId;
      this.onThemeChanged();
    });
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
    const unloaded = await this.pluginManager.unloadPlugin(pluginId);
    if (!unloaded) {
      return false;
    }

    if (this.currentThemePluginId === pluginId) {
      this.currentThemePluginId = null;
      this.onThemeChanged();
      return true;
    }

    this.onPluginVisualChange();
    return true;
  }

  public async setTheme(theme: "light" | "dark"): Promise<boolean> {
    return this.switchThemePlugin(this.builtinThemes[theme]);
  }

  private async switchThemePlugin(plugin: TimelinePlugin): Promise<boolean> {
    const nextThemePluginId = this.getPluginId(plugin);
    if (this.currentThemePluginId === nextThemePluginId) {
      return true;
    }

    if (this.currentThemePluginId) {
      const unloaded = await this.pluginManager.unloadPlugin(
        this.currentThemePluginId
      );
      if (!unloaded) {
        return false;
      }
      this.currentThemePluginId = null;
    }

    const loaded = await this.pluginManager.loadPlugin(plugin);
    if (!loaded) {
      return false;
    }

    this.currentThemePluginId = nextThemePluginId;
    this.onThemeChanged();
    return true;
  }

  private getPluginId(plugin: TimelinePlugin): string {
    return `${plugin.metadata.name}@${plugin.metadata.version}`;
  }

  private isThemePlugin(plugin: TimelinePlugin): boolean {
    return plugin.metadata.type === PluginType.THEME;
  }
}
