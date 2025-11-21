import { t as TimelinePlugin } from "./types-CPmgMeTy.mjs";

//#region src/plugins/builtin/ContextMenuPlugin.d.ts
interface ContextMenuPluginOptions {
  useHtml?: boolean;
  htmlTemplate?: string;
}
declare function ContextMenuPlugin(options?: ContextMenuPluginOptions): TimelinePlugin;
//#endregion
export { ContextMenuPlugin as t };