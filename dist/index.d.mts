import { C as ZoomData, S as Track, _ as TimelineColors, a as ContextMenuItem, b as TimelineOptions, c as EventClickData, d as EventMoveData, f as EventTextStyle, g as TimelineCallbacks, h as TimeIndicatorMoveData, i as ContextMenuData, l as EventDeleteData, m as LoadDataFormat, n as Timeline, o as ContextMenuStyle, p as EventUpdateData, r as ChangeType, s as EventAddData, u as EventEditData, v as TimelineConfig, x as TimelineState, y as TimelineEvent } from "./types-D5-4YwEP.mjs";
import { t as ContextMenuPlugin } from "./ContextMenuPlugin-Crk3ma0O.mjs";
import { t as DarkThemePlugin } from "./DarkThemePlugin-IbJNx65n.mjs";
import { t as EventMediaPlugin } from "./EventMediaPlugin-daiUXxsT.mjs";
import { t as EventTooltipPlugin } from "./EventTooltipPlugin-b5fqBb8j.mjs";
import { t as LightThemePlugin } from "./LightThemePlugin-DrdhIHgA.mjs";
import { t as PerformanceOverlayPlugin } from "./PerformanceOverlayPlugin-BFU4Le2k.mjs";

//#region src/utils/time.d.ts
declare function formatTime(seconds: number, showSeconds?: boolean): string;
declare function getCurrentTime(): number;
//#endregion
export { type ChangeType, type ContextMenuData, type ContextMenuItem, ContextMenuPlugin, type ContextMenuStyle, DarkThemePlugin, type EventAddData, type EventClickData, type EventDeleteData, type EventEditData, EventMediaPlugin, type EventMoveData, type EventTextStyle, EventTooltipPlugin, type EventUpdateData, LightThemePlugin, type LoadDataFormat, PerformanceOverlayPlugin, type TimeIndicatorMoveData, Timeline, type TimelineCallbacks, type TimelineColors, type TimelineConfig, type TimelineEvent, type TimelineOptions, type TimelineState, type Track, type ZoomData, formatTime, getCurrentTime };