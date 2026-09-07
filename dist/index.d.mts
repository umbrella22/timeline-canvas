import { A as LoadDataFormat, B as TimelineState, C as EventClickData, D as EventTextStyle, E as EventMoveData, F as TimelineEvent, H as ZoomData, I as TimelineI18nMessages, L as TimelineLocale, M as TimelineCallbacks, N as TimelineColors, O as EventUpdateData, P as TimelineConfig, R as TimelineMessageParams, S as EventAddData, T as EventEditData, V as Track, _ as translateTimelineConfig, a as PluginLocalizedText, b as ContextMenuItem, c as PluginType, d as TimelinePlugin, f as Timeline, g as normalizeTimelineLocale, h as createTimelineMessages, i as PluginContext, j as TimeIndicatorMoveData, k as InteractionTarget, l as RenderLayer, m as createDefaultContextMenuItems, n as CoreRenderTarget, o as PluginMetadata, p as ChangeType, r as PluginAPI, s as PluginPriority, t as CoreLayerHook, u as RenderLayerPosition, v as translateTimelineMessage, w as EventDeleteData, x as ContextMenuStyle, y as ContextMenuData, z as TimelineOptions } from "./types-Ch6RMCi9.mjs";
import { t as ContextMenuPlugin } from "./ContextMenuPlugin-C84Iiz8U.mjs";
import { t as DarkThemePlugin } from "./DarkThemePlugin-YD-fFNVt.mjs";
import { t as EventMediaPlugin } from "./EventMediaPlugin-BiG8wzdz.mjs";
import { t as EventTooltipPlugin } from "./EventTooltipPlugin-r1624PXo.mjs";
import { t as LightThemePlugin } from "./LightThemePlugin-CGDyxruq.mjs";
import { t as PerformanceOverlayPlugin } from "./PerformanceOverlayPlugin-DDmW-ils.mjs";
//#region src/utils/time.d.ts
declare function formatTime(seconds: number, showSeconds?: boolean): string;
declare function getCurrentTime(): number;
declare function formatTimeRange(startTime: number, endTime: number): string;
declare function formatDuration(duration: number, label?: string): string;
//#endregion
//#region src/plugins/metadata.d.ts
declare function getPluginMetadataDescription(metadata: PluginMetadata, locale?: string): string;
//#endregion
export { type ChangeType, type ContextMenuData, type ContextMenuItem, ContextMenuPlugin, type ContextMenuStyle, type CoreLayerHook, type CoreRenderTarget, DarkThemePlugin, type EventAddData, type EventClickData, type EventDeleteData, type EventEditData, EventMediaPlugin, type EventMoveData, type EventTextStyle, EventTooltipPlugin, type EventUpdateData, type InteractionTarget, LightThemePlugin, type LoadDataFormat, PerformanceOverlayPlugin, type PluginAPI, type PluginContext, type PluginLocalizedText, type PluginMetadata, PluginPriority, PluginType, type RenderLayer, type RenderLayerPosition, type TimeIndicatorMoveData, Timeline, type TimelineCallbacks, type TimelineColors, type TimelineConfig, type TimelineEvent, type TimelineI18nMessages, type TimelineLocale, type TimelineMessageParams, type TimelineOptions, type TimelinePlugin, type TimelineState, type Track, type ZoomData, createDefaultContextMenuItems, createTimelineMessages, formatDuration, formatTime, formatTimeRange, getCurrentTime, getPluginMetadataDescription, normalizeTimelineLocale, translateTimelineConfig, translateTimelineMessage };