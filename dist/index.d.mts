import { C as Track, S as TimelineState, _ as TimelineCallbacks, a as ContextMenuItem, b as TimelineEvent, c as EventClickData, d as EventMoveData, f as EventTextStyle, g as TimeIndicatorMoveData, h as LoadDataFormat, i as ContextMenuData, l as EventDeleteData, m as InteractionTarget, n as Timeline, o as ContextMenuStyle, p as EventUpdateData, r as ChangeType, s as EventAddData, u as EventEditData, v as TimelineColors, w as ZoomData, x as TimelineOptions, y as TimelineConfig } from "./types-CutIkjn4.mjs";
import { t as ContextMenuPlugin } from "./ContextMenuPlugin-HeXhKHl7.mjs";
import { t as DarkThemePlugin } from "./DarkThemePlugin-Dy3wNEsj.mjs";
import { t as EventMediaPlugin } from "./EventMediaPlugin-oiYZdX1E.mjs";
import { t as EventTooltipPlugin } from "./EventTooltipPlugin-BVStLFz2.mjs";
import { t as LightThemePlugin } from "./LightThemePlugin-ChMBy0bg.mjs";
import { t as PerformanceOverlayPlugin } from "./PerformanceOverlayPlugin-DFK_Clxo.mjs";

//#region src/utils/time.d.ts
declare function formatTime(seconds: number, showSeconds?: boolean): string;
declare function getCurrentTime(): number;
//#endregion
export { type ChangeType, type ContextMenuData, type ContextMenuItem, ContextMenuPlugin, type ContextMenuStyle, DarkThemePlugin, type EventAddData, type EventClickData, type EventDeleteData, type EventEditData, EventMediaPlugin, type EventMoveData, type EventTextStyle, EventTooltipPlugin, type EventUpdateData, type InteractionTarget, LightThemePlugin, type LoadDataFormat, PerformanceOverlayPlugin, type TimeIndicatorMoveData, Timeline, type TimelineCallbacks, type TimelineColors, type TimelineConfig, type TimelineEvent, type TimelineOptions, type TimelineState, type Track, type ZoomData, formatTime, getCurrentTime };