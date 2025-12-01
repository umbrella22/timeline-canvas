import { S as ZoomData, _ as TimelineConfig, a as ContextMenuStyle, b as TimelineState, c as EventDeleteData, d as EventTextStyle, f as EventUpdateData, g as TimelineColors, h as TimelineCallbacks, i as ContextMenuItem, l as EventEditData, m as TimeIndicatorMoveData, n as Timeline, o as EventAddData, p as LoadDataFormat, r as ContextMenuData, s as EventClickData, u as EventMoveData, v as TimelineEvent, x as Track, y as TimelineOptions } from "./types-Bw8z85-n.mjs";
import { t as ContextMenuPlugin } from "./ContextMenuPlugin-CT5bL4e6.mjs";
import { t as DarkThemePlugin } from "./DarkThemePlugin-d90ZIg-m.mjs";
import { t as EventMediaPlugin } from "./EventMediaPlugin-CvHSgRft.mjs";
import { t as EventTooltipPlugin } from "./EventTooltipPlugin-LP_qVl8u.mjs";
import { t as LightThemePlugin } from "./LightThemePlugin-Dlw80Vui.mjs";
import { t as PerformanceOverlayPlugin } from "./PerformanceOverlayPlugin-C1YkaT56.mjs";

//#region src/utils/time.d.ts
declare function formatTime(seconds: number, showSeconds?: boolean): string;
declare function getCurrentTime(): number;
//#endregion
export { type ContextMenuData, type ContextMenuItem, ContextMenuPlugin, type ContextMenuStyle, DarkThemePlugin, type EventAddData, type EventClickData, type EventDeleteData, type EventEditData, EventMediaPlugin, type EventMoveData, type EventTextStyle, EventTooltipPlugin, type EventUpdateData, LightThemePlugin, type LoadDataFormat, PerformanceOverlayPlugin, type TimeIndicatorMoveData, Timeline, type TimelineCallbacks, type TimelineColors, type TimelineConfig, type TimelineEvent, type TimelineOptions, type TimelineState, type Track, type ZoomData, formatTime, getCurrentTime };