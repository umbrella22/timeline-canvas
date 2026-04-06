import type {
  ContextMenuItem,
  TimelineConfig,
  TimelineI18nMessages,
  TimelineLocale,
  TimelineMessageParams,
} from "../types";

export type TimelineMessageKey = keyof TimelineI18nMessages;

type ResolvedTimelineLocale = Exclude<TimelineLocale, "zh">;

export const DEFAULT_TIMELINE_LOCALE: ResolvedTimelineLocale = "en";

const EN_MESSAGES: TimelineI18nMessages = {
  statusReady: "Ready",
  statusTrackAdded: "Track added ({count} total)",
  statusAtLeastOneTrackRequired: "At least one track is required",
  statusTrackRemoved: "Track removed ({count} remaining)",
  statusEmptyTrackRemoved: "Empty track removed ({count} remaining)",
  statusEventUpdated: "Event updated: {title}",
  statusEventDeleted: "Event deleted: {title}",
  statusDataLoaded: "Loaded {count} track(s)",
  statusTimeIndicatorMoved: "Time indicator moved to: {time}",
  statusZoomChanged: "Zoom: {percentage}%",
  statusAutoFit: "Auto fit: {percentage}%",
  statusAutoFitCappedWithPadding:
    "Auto fit capped at {percentage}%, added {seconds}s padding",
  statusAutoFitCappedContentShort:
    "Auto fit capped at {percentage}%, content does not fill canvas",
  statusEndTimeUpdated: "End time updated: {from} -> {to}",
  statusInvalidSplitPosition:
    "Invalid split position: resulting events too short",
  statusEventSplit: "Event split: {title}",
  statusReadOnlyModeEnabled: "Read-only mode enabled",
  statusReadOnlyModeDisabled: "Read-only mode disabled",
  statusEventHighlighted: "Event highlighted: {title}",
  statusHighlightCleared: "Highlight cleared",
  statusTimelineDestroyed: "Timeline destroyed",
  statusDragging: "Dragging: {title}",
  statusAutoTrackAdded: "Auto-added track {count}",
  statusEventPlaced: "Placed: {title} ({start} - {end})",
  statusEventSelected: "Selected: {title}",
  statusEventResizing: "Resizing: {start} - {end}",
  statusEventResized: "Event resized: {title}",
  statusReadOnlyEditDeleteBlocked:
    "Read-only events cannot be edited or deleted",
  statusReadOnlySplitBlocked: "Read-only events cannot be split",
  statusHoverEventTimeRange: "{title} ({start} - {end})",
  labelTrackName: "Track {index}",
  labelDurationPrefix: "Duration",
  contextMenuEdit: "Edit",
  contextMenuDelete: "Delete",
  contextMenuExport: "Export",
  overlayPerformanceMonitor: "Performance Monitor",
  overlayFps: "FPS: {value}",
  overlayLayerTimesMs: "Layer Times (ms):",
  overlayCollecting: "Collecting...",
  overlayLayerBackground: "Background",
  overlayLayerTracks: "Tracks",
  overlayLayerTimeline: "Timeline",
  overlayLayerGuideLines: "Guide Lines",
  overlayLayerIndicator: "Indicator",
  overlayLayerScrollbar: "Scrollbar",
  overlayLayerInteraction: "Interaction",
  overlayLayerOverlay: "Overlay",
  overlayLayerDragPreview: "Drag Preview",
  errorCanvasNotFound: 'Canvas element with id "{canvasId}" not found',
  errorCanvasContextUnavailable: "Failed to get 2D context from canvas",
  errorTimeIndicatorInvalid:
    "Time indicator position must be a number (seconds)",
  errorZoomLevelInvalid: "Zoom level must be a valid number",
  errorZoomLevelOutOfRange: "Zoom level out of valid range (1-1000)",
  errorEndTimeInvalid: "End time must be a valid number (seconds)",
  errorEndTimeNotAfterStart: "End time must be greater than start time",
  warningEventsExceedEndTime:
    "Warning: some events exceed the new end time",
  errorInvalidTrackIndex: "Invalid track index",
  errorInvalidTrackIndexWithValue: "Invalid track index: {trackIndex}",
  errorInvalidEventIndex: "Invalid event index",
  errorInvalidEventIndexWithValue: "Invalid event index: {eventIndex}",
  errorInvalidDataFormat: "Invalid data format",
  errorInvalidTimeRange:
    "Invalid time range: startTime={startTime}, endTime={endTime}",
  errorStartTimeBeforeMin:
    "Start time cannot enter left padding: startTime={startTime}, minAllowed={minAllowed}",
  errorRenderLayer: 'Error rendering layer "{layer}"',
  errorCoreLayerHook: 'Error in core layer hook "{hook}"',
  errorPluginDependenciesMissing: "Plugin dependencies missing: {pluginId}",
  errorPluginLoadFailed: "Plugin load failed: {pluginId}",
  errorPluginLifecycleFailed: "Plugin {step} failed: {pluginId}",
  errorPluginEventFailed: "Plugin event failed: {event}",
  errorPluginValidationFailed: "Plugin validation failed: {event}",
  warningInvalidDraggingState: "Invalid dragging state",
  warningDraggingEventMissing: "Dragging event not found, aborting operation",
  warningUnknownChangeType: "Unknown change type: {change}",
  warningAlreadyInBatchMode: "Already in batch mode",
  warningNotInBatchMode: "Not in batch mode",
  warningEmptyHtmlTemplateFallback:
    "htmlTemplate is empty, falling back to Canvas rendering",
  warningEmptyTooltipTemplateFallback:
    "htmlTemplate returned empty content, falling back to Canvas rendering",
};

const ZH_CN_MESSAGES: TimelineI18nMessages = {
  statusReady: "就绪",
  statusTrackAdded: "已新增轨道（共 {count} 条）",
  statusAtLeastOneTrackRequired: "至少需要保留一条轨道",
  statusTrackRemoved: "已删除轨道（剩余 {count} 条）",
  statusEmptyTrackRemoved: "已移除空轨道（剩余 {count} 条）",
  statusEventUpdated: "已更新事件：{title}",
  statusEventDeleted: "已删除事件：{title}",
  statusDataLoaded: "已加载 {count} 条轨道",
  statusTimeIndicatorMoved: "时间指示器已移动到：{time}",
  statusZoomChanged: "缩放：{percentage}%",
  statusAutoFit: "自动适配：{percentage}%",
  statusAutoFitCappedWithPadding:
    "自动适配已限制为 {percentage}%，并补充了 {seconds} 秒留白",
  statusAutoFitCappedContentShort:
    "自动适配已限制为 {percentage}%，内容仍未铺满画布",
  statusEndTimeUpdated: "结束时间已更新：{from} -> {to}",
  statusInvalidSplitPosition: "分割位置无效：分割后的事件过短",
  statusEventSplit: "已分割事件：{title}",
  statusReadOnlyModeEnabled: "已启用只读模式",
  statusReadOnlyModeDisabled: "已关闭只读模式",
  statusEventHighlighted: "已高亮事件：{title}",
  statusHighlightCleared: "已清除高亮",
  statusTimelineDestroyed: "时间轴已销毁",
  statusDragging: "正在拖拽：{title}",
  statusAutoTrackAdded: "已自动新增轨道 {count}",
  statusEventPlaced: "已放置：{title}（{start} - {end}）",
  statusEventSelected: "已选中：{title}",
  statusEventResizing: "正在调整大小：{start} - {end}",
  statusEventResized: "已调整事件大小：{title}",
  statusReadOnlyEditDeleteBlocked: "只读事件不能编辑或删除",
  statusReadOnlySplitBlocked: "只读事件不能分割",
  statusHoverEventTimeRange: "{title}（{start} - {end}）",
  labelTrackName: "轨道 {index}",
  labelDurationPrefix: "时长",
  contextMenuEdit: "编辑",
  contextMenuDelete: "删除",
  contextMenuExport: "导出",
  overlayPerformanceMonitor: "性能监视器",
  overlayFps: "FPS：{value}",
  overlayLayerTimesMs: "图层耗时（ms）：",
  overlayCollecting: "采集中...",
  overlayLayerBackground: "背景",
  overlayLayerTracks: "轨道",
  overlayLayerTimeline: "时间轴",
  overlayLayerGuideLines: "辅助线",
  overlayLayerIndicator: "指示器",
  overlayLayerScrollbar: "滚动条",
  overlayLayerInteraction: "交互层",
  overlayLayerOverlay: "叠加层",
  overlayLayerDragPreview: "拖拽预览",
  errorCanvasNotFound: '未找到 id 为 "{canvasId}" 的 canvas 元素',
  errorCanvasContextUnavailable: "无法从 canvas 获取 2D 上下文",
  errorTimeIndicatorInvalid: "时间指示器位置必须是数值（秒）",
  errorZoomLevelInvalid: "缩放级别必须是有效数值",
  errorZoomLevelOutOfRange: "缩放级别超出有效范围（1-1000）",
  errorEndTimeInvalid: "结束时间必须是有效数值（秒）",
  errorEndTimeNotAfterStart: "结束时间必须大于开始时间",
  warningEventsExceedEndTime: "警告：部分事件超出了新的结束时间",
  errorInvalidTrackIndex: "无效的轨道索引",
  errorInvalidTrackIndexWithValue: "无效的轨道索引：{trackIndex}",
  errorInvalidEventIndex: "无效的事件索引",
  errorInvalidEventIndexWithValue: "无效的事件索引：{eventIndex}",
  errorInvalidDataFormat: "无效的数据格式",
  errorInvalidTimeRange:
    "无效的时间范围：startTime={startTime}, endTime={endTime}",
  errorStartTimeBeforeMin:
    "开始时间不能进入左侧留白区域：startTime={startTime}, minAllowed={minAllowed}",
  errorRenderLayer: '渲染图层 "{layer}" 时发生错误',
  errorCoreLayerHook: '执行核心图层钩子 "{hook}" 时发生错误',
  errorPluginDependenciesMissing: "插件依赖缺失：{pluginId}",
  errorPluginLoadFailed: "插件加载失败：{pluginId}",
  errorPluginLifecycleFailed: "插件 {step} 执行失败：{pluginId}",
  errorPluginEventFailed: "插件事件处理失败：{event}",
  errorPluginValidationFailed: "插件校验失败：{event}",
  warningInvalidDraggingState: "拖拽状态无效",
  warningDraggingEventMissing: "无法找到拖拽的事件，已放弃操作",
  warningUnknownChangeType: "未知的变更类型：{change}",
  warningAlreadyInBatchMode: "当前已处于批量模式",
  warningNotInBatchMode: "当前不在批量模式中",
  warningEmptyHtmlTemplateFallback:
    "htmlTemplate 为空，已回退到 Canvas 渲染",
  warningEmptyTooltipTemplateFallback:
    "htmlTemplate 返回空内容，已回退到 Canvas 渲染",
};

const BUILTIN_TIMELINE_MESSAGES: Record<ResolvedTimelineLocale, TimelineI18nMessages> = {
  en: EN_MESSAGES,
  "zh-CN": ZH_CN_MESSAGES,
};

export function normalizeTimelineLocale(locale?: string): ResolvedTimelineLocale {
  if (!locale) {
    return DEFAULT_TIMELINE_LOCALE;
  }

  return locale.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

export function createTimelineMessages(
  locale: string = DEFAULT_TIMELINE_LOCALE,
  overrides: Partial<TimelineI18nMessages> = {}
): TimelineI18nMessages {
  const normalizedLocale = normalizeTimelineLocale(locale);
  return {
    ...BUILTIN_TIMELINE_MESSAGES[normalizedLocale],
    ...overrides,
  };
}

export function translateTimelineMessage(
  messages: TimelineI18nMessages,
  key: TimelineMessageKey,
  params: TimelineMessageParams = {}
): string {
  return messages[key].replace(/\{(\w+)\}/g, (match, token) => {
    if (!(token in params)) {
      return match;
    }
    return String(params[token]);
  });
}

export function translateTimelineConfig(
  config: Pick<TimelineConfig, "locale" | "messages">,
  key: TimelineMessageKey,
  params: TimelineMessageParams = {}
): string {
  return translateTimelineMessage(
    config.messages || createTimelineMessages(config.locale),
    key,
    params
  );
}

export function createDefaultContextMenuItems(
  localeOrMessages: string | TimelineI18nMessages = DEFAULT_TIMELINE_LOCALE,
  overrides: Partial<TimelineI18nMessages> = {}
): ContextMenuItem[] {
  const messages =
    typeof localeOrMessages === "string"
      ? createTimelineMessages(localeOrMessages, overrides)
      : localeOrMessages;

  return [
    { type: "edit", name: messages.contextMenuEdit },
    { type: "delete", name: messages.contextMenuDelete },
    { type: "export", name: messages.contextMenuExport },
  ];
}