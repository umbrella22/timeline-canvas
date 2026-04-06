import { d as TimelinePlugin } from "./types-BovVI9wC.mjs";

//#region src/plugins/builtin/ContextMenuPlugin.d.ts
interface ContextMenuPluginOptions {
  /** 自定义 HTML 模板字符串。传入此参数将自动启用 HTML 渲染模式 */
  htmlTemplate?: string;
}
declare function ContextMenuPlugin(options?: ContextMenuPluginOptions): TimelinePlugin;
//#endregion
export { ContextMenuPlugin as t };