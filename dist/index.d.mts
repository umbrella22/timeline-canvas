import { S as ZoomData, _ as TimelineConfig, a as ContextMenuStyle, b as TimelineState, c as EventDeleteData, d as EventTextStyle, f as EventUpdateData, g as TimelineColors, h as TimelineCallbacks, i as ContextMenuItem, l as EventEditData, m as TimeIndicatorMoveData, n as Timeline, o as EventAddData, p as LoadDataFormat, r as ContextMenuData, s as EventClickData, u as EventMoveData, v as TimelineEvent, x as Track, y as TimelineOptions } from "./types-CPmgMeTy.mjs";
import { t as ContextMenuPlugin } from "./ContextMenuPlugin-C3uMd4va.mjs";
import { t as DarkThemePlugin } from "./DarkThemePlugin-D-cvAIEz.mjs";
import { t as EventMediaPlugin } from "./EventMediaPlugin-Bcp0hJL7.mjs";
import { t as LightThemePlugin } from "./LightThemePlugin-CaP2v-1S.mjs";
import { t as PerformanceOverlayPlugin } from "./PerformanceOverlayPlugin-BwYrJLXL.mjs";

//#region src/utils/time.d.ts
declare function formatTime(seconds: number, showSeconds?: boolean): string;
declare function getCurrentTime(): number;
//#endregion
export { type ContextMenuData, type ContextMenuItem, ContextMenuPlugin, type ContextMenuStyle, DarkThemePlugin, type EventAddData, type EventClickData, type EventDeleteData, type EventEditData, EventMediaPlugin, type EventMoveData, type EventTextStyle, type EventUpdateData, LightThemePlugin, type LoadDataFormat, PerformanceOverlayPlugin, type TimeIndicatorMoveData, Timeline, type TimelineCallbacks, type TimelineColors, type TimelineConfig, type TimelineEvent, type TimelineOptions, type TimelineState, type Track, type ZoomData, formatTime, getCurrentTime };