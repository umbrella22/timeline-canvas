import { S as ZoomData, _ as TimelineConfig, a as ContextMenuStyle, b as TimelineState, c as EventDeleteData, d as EventTextStyle, f as EventUpdateData, g as TimelineColors, h as TimelineCallbacks, i as ContextMenuItem, l as EventEditData, m as TimeIndicatorMoveData, n as Timeline, o as EventAddData, p as LoadDataFormat, r as ContextMenuData, s as EventClickData, t as TimelinePlugin, u as EventMoveData, v as TimelineEvent, x as Track, y as TimelineOptions } from "./types-CROJcXg0.mjs";
import { t as ContextMenuPlugin } from "./ContextMenuPlugin-Dxy1smdu.mjs";
import { t as DarkThemePlugin } from "./DarkThemePlugin-Dj18CJjw.mjs";
import { t as EventMediaPlugin } from "./EventMediaPlugin-po2TxS4j.mjs";
import { t as LightThemePlugin } from "./LightThemePlugin-C1whjJFh.mjs";
import { t as PerformanceOverlayPlugin } from "./PerformanceOverlayPlugin-CFqVg0kB.mjs";

//#region src/plugins/builtin/EventTooltipPlugin.d.ts
interface EventTooltipPluginOptions {
  /** 自定义 HTML 模板函数，接收事件标题，返回 HTML 字符串。传入此参数将自动启用 HTML 渲染模式 */
  htmlTemplate?: (title: string) => string;
  /** tooltip 显示延迟（毫秒），默认 300 */
  showDelay?: number;
  /** tooltip 最大宽度，默认 300 */
  maxWidth?: number;
  /** tooltip 内边距，默认 8 */
  padding?: number;
  /** tooltip 圆角，默认 4 */
  borderRadius?: number;
  /** tooltip 背景色，默认 '#333' */
  backgroundColor?: string;
  /** tooltip 文字颜色，默认 '#fff' */
  textColor?: string;
  /** tooltip 边框颜色，默认 '#555' */
  borderColor?: string;
  /** tooltip 字体大小，默认 12 */
  fontSize?: number;
  /** tooltip 字体，默认 'Arial, sans-serif' */
  fontFamily?: string;
}
declare function EventTooltipPlugin(options?: EventTooltipPluginOptions): TimelinePlugin;
//#endregion
//#region src/utils/time.d.ts
declare function formatTime(seconds: number, showSeconds?: boolean): string;
declare function getCurrentTime(): number;
//#endregion
export { type ContextMenuData, type ContextMenuItem, ContextMenuPlugin, type ContextMenuStyle, DarkThemePlugin, type EventAddData, type EventClickData, type EventDeleteData, type EventEditData, EventMediaPlugin, type EventMoveData, type EventTextStyle, EventTooltipPlugin, type EventUpdateData, LightThemePlugin, type LoadDataFormat, PerformanceOverlayPlugin, type TimeIndicatorMoveData, Timeline, type TimelineCallbacks, type TimelineColors, type TimelineConfig, type TimelineEvent, type TimelineOptions, type TimelineState, type Track, type ZoomData, formatTime, getCurrentTime };