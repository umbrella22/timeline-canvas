export enum PluginType {
  RENDER = "render",
  EVENT_HANDLER = "event_handler",
  DATA_SOURCE = "data_source",
  THEME = "theme",
  TOOL = "tool",
  EXTENSION = "extension",
}

export enum PluginPriority {
  LOW = 0,
  NORMAL = 50,
  HIGH = 100,
  CRITICAL = 200,
}

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  type: PluginType;
  priority?: PluginPriority;
  dependencies?: string[];
}

export type RenderLayerPosition = "background" | "overlay";

export interface RenderLayer {
  name: string;
  position: RenderLayerPosition;
  render: (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    config: any,
    state: any
  ) => void;
}

export interface PluginAPI {
  registerRenderLayer: (layer: RenderLayer) => void;
  unregisterRenderLayer: (name: string) => void;
  registerEventHandler: (event: string, handler: Function) => void;
  unregisterEventHandler: (event: string, handler: Function) => void;
  showNotification: (message: string, type?: "info" | "warning" | "error") => void;
  getData: (key: string) => any;
  setData: (key: string, value: any) => void;
  setPerformanceProvider: (provider: PerformanceProvider) => void;
  getPerformanceStats: () => Map<string, PerformanceStats>;
  getFPS: () => number;
}

import type { Timeline } from "../core/Timeline";

export interface PluginContext {
  timeline: Timeline;
  config: any;
  state: any;
  api: PluginAPI;
}

export interface TimelinePlugin {
  metadata: PluginMetadata;
  init?: (context: PluginContext) => Promise<void> | void;
  activate?: (context: PluginContext) => Promise<void> | void;
  deactivate?: (context: PluginContext) => Promise<void> | void;
  destroy?: (context: PluginContext) => Promise<void> | void;
}

import type { PerformanceStats } from "../utils/performanceMonitor";

export interface PerformanceProvider {
  startMeasurement: (name: string) => void;
  endMeasurement: (name: string) => void;
  getAllStats: () => Map<string, PerformanceStats>;
  getFPS: () => number;
}