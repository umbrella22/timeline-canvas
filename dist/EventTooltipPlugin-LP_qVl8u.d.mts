import { t as TimelinePlugin } from "./types-Bw8z85-n.mjs";

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
export { EventTooltipPlugin as t };