import { useCallback, useEffect, useMemo, useRef, useState, CSSProperties, FormEvent } from "react";
import {
  Timeline,
  createTimelineMessages,
  formatTime,
  getPluginMetadataDescription,
  type TimelineEvent,
} from "../../../packages/timeline/src/index";
import { LightThemePlugin } from "../../../packages/timeline/src/plugins/builtin/LightThemePlugin";
import { DarkThemePlugin } from "../../../packages/timeline/src/plugins/builtin/DarkThemePlugin";
import { ContextMenuPlugin } from "../../../packages/timeline/src/plugins/builtin/ContextMenuPlugin";
import { PerformanceOverlayPlugin } from "../../../packages/timeline/src/plugins/builtin/PerformanceOverlayPlugin";
import { EventMediaPlugin } from "../../../packages/timeline/src/plugins/builtin/EventMediaPlugin";
import { MutexGuardPlugin } from "../../../packages/timeline/src/plugins/builtin/MutexGuardPlugin";
import { EventTooltipPlugin } from "../../../packages/timeline/src/plugins/builtin/EventTooltipPlugin";

// Inline styles
const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "clamp(10px, 2vw, 20px)",
    background: "#1e1e2e",
    borderRadius: "8px",
    color: "#cdd6f4",
    fontFamily: "system-ui, -apple-system, sans-serif",
    WebkitFontSmoothing: "antialiased",
  },
  canvasContainer: {
    position: "relative",
    background: "#181825",
    borderRadius: "8px",
    overflow: "hidden",
    border: "1px solid #313244",
    height: "clamp(280px, 38vh, 440px)",
    minWidth: 0,
  },
  canvas: {
    display: "block",
    width: "100%",
    height: "100%",
  },
  controls: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
    gap: "10px 16px",
    padding: "12px",
    background: "#313244",
    borderRadius: "8px",
  },
  controlGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: 0,
  },
  groupTitle: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#89b4fa",
    margin: 0,
    marginBottom: "2px",
  },
  buttonGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  button: {
    minHeight: "40px",
    padding: "7px 11px",
    background: "#45475a",
    border: "none",
    borderRadius: "4px",
    color: "#cdd6f4",
    cursor: "pointer",
    fontSize: "13px",
    transition:
      "transform 0.15s cubic-bezier(0.2, 0, 0, 1), background-color 0.15s cubic-bezier(0.2, 0, 0, 1)",
  },
  buttonPrimary: {
    minHeight: "40px",
    padding: "7px 11px",
    background: "#89b4fa",
    border: "none",
    borderRadius: "4px",
    color: "#1e1e2e",
    cursor: "pointer",
    fontSize: "13px",
    transition:
      "transform 0.15s cubic-bezier(0.2, 0, 0, 1), background-color 0.15s cubic-bezier(0.2, 0, 0, 1)",
  },
  buttonDanger: {
    minHeight: "40px",
    padding: "7px 11px",
    background: "#f38ba8",
    border: "none",
    borderRadius: "4px",
    color: "#1e1e2e",
    cursor: "pointer",
    fontSize: "13px",
    transition:
      "transform 0.15s cubic-bezier(0.2, 0, 0, 1), background-color 0.15s cubic-bezier(0.2, 0, 0, 1)",
  },
  toggle: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    cursor: "pointer",
    minHeight: "40px",
  },
  toggleGroup: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: "4px 16px",
  },
  status: {
    fontSize: "13px",
    color: "#a6adc8",
    padding: "8px",
    background: "#313244",
    borderRadius: "4px",
  },
  sliderContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
  },
  slider: {
    flex: "1",
    minHeight: "40px",
    minWidth: "96px",
  },
  pluginList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  pluginItem: {
    padding: "10px 12px",
    background: "#45475a",
    borderRadius: "6px",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  pluginName: {
    display: "block",
    fontWeight: "600",
    color: "#f9e2af",
    marginBottom: "4px",
  },
  pluginDescription: {
    color: "#bac2de",
  },
  pluginSummary: {
    minHeight: "40px",
    display: "flex",
    alignItems: "center",
    color: "#89b4fa",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
  },
  eventSection: {
    padding: "12px 0 0",
    borderTop: "1px solid #45475a",
  },
  eventList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: 0,
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  eventItem: {
    padding: "8px 0",
    borderBottom: "1px solid #313244",
  },
  eventSelect: {
    width: "100%",
    minHeight: "40px",
    padding: "7px 9px",
    border: "none",
    borderRadius: "4px",
    background: "transparent",
    color: "#f5f7ff",
    cursor: "pointer",
    textAlign: "left",
    transition:
      "transform 0.15s cubic-bezier(0.2, 0, 0, 1), background-color 0.15s cubic-bezier(0.2, 0, 0, 1)",
  },
  eventMeta: {
    display: "block",
    marginTop: "3px",
    color: "#bac2de",
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
  },
  editSummary: {
    minHeight: "40px",
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    color: "#a6adc8",
    fontSize: "13px",
  },
  editDisclosure: {
    marginTop: "4px",
    padding: "0 8px 8px",
    background: "#252536",
    borderRadius: "4px",
    color: "#cdd6f4",
  },
  editForm: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
    color: "#bac2de",
    fontSize: "12px",
  },
  input: {
    width: "100%",
    minWidth: 0,
    minHeight: "40px",
    boxSizing: "border-box",
    border: "1px solid #585b70",
    borderRadius: "4px",
    background: "#181825",
    color: "#f5f7ff",
    padding: "7px 8px",
    font: "inherit",
  },
};

type AccessibleEvent = {
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
};

export const advancePlaybackPosition = (
  currentTime: number,
  elapsedMs: number,
  speed: number,
  startTime: number,
  endTime: number,
) => {
  const duration = endTime - startTime;
  if (duration <= 0) return startTime;
  const nextTime = currentTime + (Math.max(0, elapsedMs) / 1000) * speed;
  return nextTime < endTime ? nextTime : startTime + ((nextTime - startTime) % duration);
};

export const getInitialSecondWidth = (hostWidth: number) => Math.max(80, hostWidth - 32) / 3600;

type TimelinePlaygroundLang = "zh" | "en";

const getText = (
  lang: TimelinePlaygroundLang,
  timelineMessages: ReturnType<typeof createTimelineMessages>,
) => {
  if (lang === "en") {
    return {
      ready: timelineMessages.statusReady,
      status: "Status",
      basicActions: "Basic Actions",
      viewControls: "View Controls",
      playback: "Playback",
      toggles: "Toggles",
      builtInPlugins: "Built-in Plugins",
      events: "Timeline events",
      selectEvent: "Select event",
      edit: "Edit",
      save: "Save changes",
      title: "Title",
      start: "Start (seconds)",
      end: "End (seconds)",
      track: "Track",
      noEvents: "No events",
      invalidEvent: "Enter a title and an end time after the start time",
      timelineCanvas: "Interactive timeline canvas. Use the event list below for keyboard access.",
      addTrack: "Add Track",
      removeTrack: "Remove Track",
      addEvent: "Add Event",
      zoomIn: "Zoom In",
      zoomOut: "Zoom Out",
      resetTime: "Reset Time",
      play: "Play",
      pause: "Pause",
      stop: "Stop",
      speed: "Speed",
      enableResize: "Enable resizing",
      enableSplit: "Enable splitting",
      showTimeIndicator: "Show time indicator",
      snapToSeconds: "Snap to seconds",
      showDurationLabel: "Show duration label",
      debug: "Debug mode",
      readOnly: "Read-only mode",
      trackAdded: "Added a new track",
      trackRemoved: "Removed the last track",
      eventAdded: "Added a new event",
      eventSelected: (title: string, trackName: string) =>
        `Selected event: ${title} (track: ${trackName})`,
      confirmDelete: (title: string) => `Are you sure you want to delete "${title}"?`,
      editEvent: (title: string) => `Edit event: ${title}`,
      newEventTitle: "New Event",
      newEventDesc: "Added manually",
      shiftMorning: "Day Shift",
      shiftMorningDesc: "Morning work block",
      shiftNight: "Night Shift",
      shiftNightDesc: "Night work block",
      readonlyEvent: "Read-only Event - Media Event",
      mutexExample: "Mutex Example",
      menuEdit: `✏️ ${timelineMessages.contextMenuEdit}`,
      menuDuplicate: "📋 Duplicate",
      menuDelete: `🗑️ ${timelineMessages.contextMenuDelete}`,
      menuExport: `📤 ${timelineMessages.contextMenuExport}`,
      duplicateSuffix: " (Copy)",
    };
  }

  return {
    ready: timelineMessages.statusReady,
    status: "状态",
    basicActions: "基础操作",
    viewControls: "视图控制",
    playback: "播放控制",
    toggles: "功能开关",
    builtInPlugins: "内置插件",
    events: "时间轴事件",
    selectEvent: "选择事件",
    edit: "编辑",
    save: "保存更改",
    title: "标题",
    start: "开始（秒）",
    end: "结束（秒）",
    track: "轨道",
    noEvents: "暂无事件",
    invalidEvent: "请输入标题，并确保结束时间晚于开始时间",
    timelineCanvas: "交互式时间轴画布。键盘操作请使用下方事件列表。",
    addTrack: "添加轨道",
    removeTrack: "删除轨道",
    addEvent: "添加事件",
    zoomIn: "放大",
    zoomOut: "缩小",
    resetTime: "重置时间",
    play: "播放",
    pause: "暂停",
    stop: "停止",
    speed: "速度",
    enableResize: "允许调整大小",
    enableSplit: "允许切割事件",
    showTimeIndicator: "显示时间指示器",
    snapToSeconds: "秒级吸附",
    showDurationLabel: "显示时长标签",
    debug: "调试模式",
    readOnly: "只读模式",
    trackAdded: "添加了新轨道",
    trackRemoved: "删除了最后一个轨道",
    eventAdded: "添加了新事件",
    eventSelected: (title: string, trackName: string) => `选中事件: ${title} (轨道: ${trackName})`,
    confirmDelete: (title: string) => `确定要删除事件 "${title}" 吗？`,
    editEvent: (title: string) => `编辑事件: ${title}`,
    newEventTitle: "新事件",
    newEventDesc: "手动添加",
    shiftMorning: "早班",
    shiftMorningDesc: "上午工作时段",
    shiftNight: "夜班",
    shiftNightDesc: "夜间工作时段",
    readonlyEvent: "只读事件-媒体事件",
    mutexExample: "互斥示例",
    menuEdit: `✏️ ${timelineMessages.contextMenuEdit}`,
    menuDuplicate: "📋 复制",
    menuDelete: `🗑️ ${timelineMessages.contextMenuDelete}`,
    menuExport: `📤 ${timelineMessages.contextMenuExport}`,
    duplicateSuffix: " (副本)",
  };
};

const TimelinePlayground = ({ lang = "zh" }: { lang?: TimelinePlaygroundLang }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const timelineLocale = useMemo(() => (lang === "en" ? "en" : "zh-CN"), [lang]);
  const timelineMessages = useMemo(() => createTimelineMessages(timelineLocale), [timelineLocale]);
  const t = useMemo(() => getText(lang, timelineMessages), [lang, timelineMessages]);
  const builtinPlugins = useMemo(() => {
    const pluginMetadata = [
      { name: "LightThemePlugin", metadata: LightThemePlugin.metadata },
      { name: "DarkThemePlugin", metadata: DarkThemePlugin.metadata },
      { name: "ContextMenuPlugin", metadata: ContextMenuPlugin().metadata },
      { name: "PerformanceOverlayPlugin", metadata: PerformanceOverlayPlugin.metadata },
      { name: "EventMediaPlugin", metadata: EventMediaPlugin().metadata },
      { name: "MutexGuardPlugin", metadata: MutexGuardPlugin().metadata },
      { name: "EventTooltipPlugin", metadata: EventTooltipPlugin().metadata },
    ];

    return pluginMetadata.map((plugin) => ({
      ...plugin,
      description: getPluginMetadataDescription(plugin.metadata, timelineLocale),
    }));
  }, [timelineLocale]);
  const [status, setStatus] = useState(timelineMessages.statusReady);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [accessibleEvents, setAccessibleEvents] = useState<AccessibleEvent[]>([]);
  const [selectedEventKey, setSelectedEventKey] = useState<string | null>(null);
  const playbackFrameRef = useRef<number | null>(null);
  const playbackTimestampRef = useRef<number | null>(null);
  const playSpeedRef = useRef(playSpeed);

  const stopPlaybackLoop = useCallback(() => {
    if (playbackFrameRef.current !== null) {
      cancelAnimationFrame(playbackFrameRef.current);
      playbackFrameRef.current = null;
    }
    playbackTimestampRef.current = null;
  }, []);

  const refreshAccessibleEvents = useCallback((source?: Timeline) => {
    const timeline = source || timelineRef.current;
    if (!timeline || timelineRef.current !== timeline) return;
    setAccessibleEvents(
      timeline.state.tracks.flatMap((track, trackIndex) =>
        track.events.map((event, eventIndex) => ({
          trackIndex,
          eventIndex,
          event: { ...event },
        })),
      ),
    );
    const selected = timeline.state.selectedEvent || timeline.state.highlightedEvent;
    setSelectedEventKey(selected ? `${selected.trackIndex}:${selected.eventIndex}` : null);
  }, []);

  // Feature toggles state
  const [config, setConfig] = useState({
    enableEventResize: true,
    enableEventSplit: true,
    enableTimeIndicator: true,
    enableContextMenu: true,
    debug: false,
    snapToSeconds: true,
    showEventDurationLabel: true,
    autoAddTrack: true,
    autoRemoveEmptyLastTrack: true,
    readOnly: false,
    theme: "light", // 'light' or 'dark'
  });

  useEffect(() => {
    setStatus(timelineMessages.statusReady);
  }, [timelineMessages.statusReady]);

  useEffect(() => {
    playSpeedRef.current = playSpeed;
  }, [playSpeed]);

  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;
    let timelineToDestroy: Timeline | null = null;

    stopPlaybackLoop();
    setIsPlaying(false);
    setAccessibleEvents([]);
    setSelectedEventKey(null);

    // Generate a unique ID for the canvas if it doesn't have one
    const canvasId = "timeline-playground-canvas";
    canvasRef.current.id = canvasId;

    const initialize = async () => {
      const canvasHost = canvasRef.current?.parentElement;
      const hostWidth = canvasHost?.clientWidth || canvasHost?.getBoundingClientRect().width || 0;

      // Initialize Timeline
      const timeline = new Timeline(canvasId, {
        canvasHeight: 600,
        locale: timelineLocale,
        startTime: 0,
        endTime: 3600,
        endPaddingTime: 60,
        secondWidth: getInitialSecondWidth(hostWidth),
        autoFitOnInit: false,
        trackHeight: 46,
        eventTextStyle: {
          titleFontSize: 13,
          timeFontSize: 11,
          titleFontFamily: "system-ui, -apple-system, sans-serif",
          timeFontFamily: "system-ui, -apple-system, sans-serif",
        },
        trackMargin: 10,
        firstTrackTopMargin: 16,
        timelineHeight: 40,

        // Initial config from state
        enableEventResize: config.enableEventResize,
        enableEventSplit: config.enableEventSplit,
        enableTimeIndicator: config.enableTimeIndicator,
        enableContextMenu: config.enableContextMenu,
        debug: config.debug,
        snapToSeconds: config.snapToSeconds,
        showEventDurationLabel: config.showEventDurationLabel,
        autoAddTrack: config.autoAddTrack,
        autoRemoveEmptyLastTrack: config.autoRemoveEmptyLastTrack,
        readOnly: config.readOnly,

        contextMenuItems: [
          { type: "edit", name: t.menuEdit },
          { type: "duplicate", name: t.menuDuplicate },
          { type: "delete", name: t.menuDelete },
          { type: "export", name: t.menuExport },
        ],

        onEventClick: (data) => {
          if (cancelled) return;
          setStatus(t.eventSelected(data.event.title, data.trackName));
          refreshAccessibleEvents(timeline);
          console.log("Event Clicked:", data);
        },
        onStatusChange: (text) => {
          if (cancelled) return;
          setStatus(text);
        },
        onEventAdd: () => refreshAccessibleEvents(timeline),
        onEventUpdate: () => refreshAccessibleEvents(timeline),
        onEventDelete: () => refreshAccessibleEvents(timeline),
        onEventMove: () => refreshAccessibleEvents(timeline),
        onTrackAdd: () => refreshAccessibleEvents(timeline),
        onTrackRemove: () => refreshAccessibleEvents(timeline),
        onEventHighlight: () => refreshAccessibleEvents(timeline),
        onContextMenu: (data) => {
          if (cancelled) return;
          console.log("Context Menu:", data);
          if (data.menuType === "delete") {
            if (confirm(t.confirmDelete(data.event.title))) {
              timeline.deleteEvent(data.trackIndex, data.eventIndex);
            }
          } else if (data.menuType === "duplicate") {
            timeline.addEvent(
              data.trackIndex,
              data.event.endTime,
              data.event.endTime + data.event.duration,
              data.event.title + t.duplicateSuffix,
              data.event.description,
              data.event.customData,
            );
          } else if (data.menuType === "edit") {
            alert(t.editEvent(data.event.title));
          }
        },
      });
      timelineToDestroy = timeline;
      timelineRef.current = timeline;

      // Load Plugins
      const plugins = [
        config.theme === "dark" ? DarkThemePlugin : LightThemePlugin,
        ContextMenuPlugin(),
        PerformanceOverlayPlugin,
        MutexGuardPlugin(),
        EventMediaPlugin(),
        EventTooltipPlugin(),
      ];
      for (const plugin of plugins) {
        const loaded = await timeline.usePlugin(plugin);
        if (cancelled || !loaded) return;
      }

      // Load Data
      const N = 20000;
      const waveformData = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const t = i / 200;
        waveformData[i] = Math.sin(t) * 0.8 + Math.sin(t * 0.25) * 0.2;
      }

      if (cancelled) return;
      timeline.loadData({
        timeIndicatorPosition: 0,
        tracks: [
          {
            events: [
              {
                startTime: 0,
                endTime: 900,
                title: t.shiftMorning,
                description: t.shiftMorningDesc,
              },
              {
                startTime: 1800,
                endTime: 3600,
                title: t.shiftNight,
                description: t.shiftNightDesc,
              },
            ],
          },
          {
            events: [
              {
                startTime: 0,
                endTime: 900,
                title: t.readonlyEvent,
                readonly: true,
                media: { waveform: { data: waveformData, color: "#FF7F00", opacity: 0.5 } },
              },
              {
                startTime: 1200,
                endTime: 2100,
                title: t.mutexExample,
                customData: { mutex: ["work"] },
              },
            ],
          },
        ],
      });
      if (!cancelled) refreshAccessibleEvents(timeline);
    };

    void initialize();

    return () => {
      cancelled = true;
      stopPlaybackLoop();
      if (timelineRef.current === timelineToDestroy) {
        timelineRef.current = null;
      }
      if (timelineToDestroy) {
        void timelineToDestroy.destroy();
      }
    };
  }, [refreshAccessibleEvents, stopPlaybackLoop, t, timelineLocale]);

  // Update config when state changes
  useEffect(() => {
    if (!timelineRef.current) return;
    const timeline = timelineRef.current;

    timeline.config.enableEventResize = config.enableEventResize;
    timeline.config.enableEventSplit = config.enableEventSplit;
    timeline.setEnableTimeIndicator(config.enableTimeIndicator);
    timeline.config.enableContextMenu = config.enableContextMenu;
    timeline.setDebug(config.debug);
    timeline.config.snapToSeconds = config.snapToSeconds;
    timeline.config.showEventDurationLabel = config.showEventDurationLabel;
    timeline.config.autoAddTrack = config.autoAddTrack;
    timeline.config.autoRemoveEmptyLastTrack = config.autoRemoveEmptyLastTrack;
    timeline.setReadOnly(config.readOnly);

    timeline.draw();
    refreshAccessibleEvents(timeline);
  }, [config, refreshAccessibleEvents]);

  const handleAction = (action: string) => {
    if (!timelineRef.current) return;
    const timeline = timelineRef.current;

    switch (action) {
      case "addTrack":
        timeline.addTrack();
        refreshAccessibleEvents(timeline);
        break;
      case "removeTrack":
        timeline.removeTrack();
        refreshAccessibleEvents(timeline);
        break;
      case "addEvent":
        const trackIndex = timeline.state?.selectedTrack ?? 0;
        const startTime = timeline.state?.timeIndicatorPosition ?? timeline.config.startTime;
        timeline.addEvent(trackIndex, startTime, startTime + 100, t.newEventTitle, t.newEventDesc);
        setStatus(t.eventAdded);
        refreshAccessibleEvents(timeline);
        break;
      case "zoomIn":
        timeline.zoom(1.2);
        break;
      case "zoomOut":
        timeline.zoom(0.8);
        break;
      case "resetTime":
        timeline.setTimeIndicator(timeline.config.startTime);
        break;
      case "togglePlay":
        if (isPlaying) {
          stopPlaybackLoop();
          setIsPlaying(false);
        } else {
          playbackTimestampRef.current = performance.now();
          const tick = (timestamp: number) => {
            const activeTimeline = timelineRef.current;
            const previousTimestamp = playbackTimestampRef.current;
            if (!activeTimeline || previousTimestamp === null) return;
            const newTime = advancePlaybackPosition(
              activeTimeline.state.timeIndicatorPosition,
              timestamp - previousTimestamp,
              playSpeedRef.current,
              activeTimeline.config.startTime,
              activeTimeline.config.endTime,
            );
            playbackTimestampRef.current = timestamp;
            activeTimeline.setTimeIndicator(newTime);
            playbackFrameRef.current = requestAnimationFrame(tick);
          };
          playbackFrameRef.current = requestAnimationFrame(tick);
          setIsPlaying(true);
        }
        break;
      case "stop":
        stopPlaybackLoop();
        setIsPlaying(false);
        timeline.setTimeIndicator(timeline.config.startTime);
        break;
    }
  };

  const toggleConfig = (key: keyof typeof config) => {
    setConfig((prev: typeof config) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAccessibleEvent = (item: AccessibleEvent) => {
    const timeline = timelineRef.current;
    if (!timeline || !timeline.highlightEvent(item.trackIndex, item.eventIndex)) return;
    refreshAccessibleEvents(timeline);
    setStatus(t.eventSelected(item.event.title, `${t.track} ${item.trackIndex + 1}`));
  };

  const editAccessibleEvent = (submitEvent: FormEvent<HTMLFormElement>, item: AccessibleEvent) => {
    submitEvent.preventDefault();
    const timeline = timelineRef.current;
    if (!timeline || timeline.isReadOnly() || item.event.readonly) return;
    const data = new FormData(submitEvent.currentTarget);
    const title = String(data.get("title") || "").trim();
    const startTime = Number(data.get("startTime"));
    const endTime = Number(data.get("endTime"));
    if (
      !title ||
      !Number.isFinite(startTime) ||
      !Number.isFinite(endTime) ||
      endTime <= startTime
    ) {
      setStatus(t.invalidEvent);
      return;
    }
    if (
      timeline.updateEvent(item.trackIndex, item.eventIndex, {
        title,
        startTime,
        endTime,
        duration: endTime - startTime,
      })
    ) {
      refreshAccessibleEvents(timeline);
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
                .timeline-playground-button:active {
                  transform: scale(0.96);
                }
                .timeline-playground-button:disabled {
                  cursor: not-allowed;
                  opacity: 0.5;
                }
                .timeline-playground-button:focus-visible,
                .timeline-playground-summary:focus-visible,
                .timeline-playground-input:focus-visible {
                    outline: 3px solid #f9e2af;
                    outline-offset: 2px;
                }
                @media (max-width: 560px) {
                    .timeline-playground-edit-form {
                        grid-template-columns: minmax(0, 1fr) !important;
                    }
                }
            `}</style>
      <div style={styles.canvasContainer}>
        <canvas
          ref={canvasRef}
          style={styles.canvas}
          role="img"
          aria-label={t.timelineCanvas}
          aria-describedby="timeline-playground-status"
        />
      </div>

      <div id="timeline-playground-status" style={styles.status} role="status" aria-live="polite">
        {t.status}: {status}
      </div>

      <div style={styles.controls}>
        <div style={styles.controlGroup}>
          <h3 style={styles.groupTitle}>{t.basicActions}</h3>
          <div style={styles.buttonGroup}>
            <button
              className="timeline-playground-button"
              style={styles.buttonPrimary}
              disabled={config.readOnly}
              onClick={() => handleAction("addTrack")}
            >
              {t.addTrack}
            </button>
            <button
              className="timeline-playground-button"
              style={styles.buttonDanger}
              disabled={config.readOnly}
              onClick={() => handleAction("removeTrack")}
            >
              {t.removeTrack}
            </button>
            <button
              className="timeline-playground-button"
              style={styles.buttonPrimary}
              disabled={config.readOnly}
              onClick={() => handleAction("addEvent")}
            >
              {t.addEvent}
            </button>
          </div>
        </div>

        <div style={styles.controlGroup}>
          <h3 style={styles.groupTitle}>{t.viewControls}</h3>
          <div style={styles.buttonGroup}>
            <button
              className="timeline-playground-button"
              style={styles.button}
              onClick={() => handleAction("zoomIn")}
            >
              {t.zoomIn}
            </button>
            <button
              className="timeline-playground-button"
              style={styles.button}
              onClick={() => handleAction("zoomOut")}
            >
              {t.zoomOut}
            </button>
            <button
              className="timeline-playground-button"
              style={styles.button}
              onClick={() => handleAction("resetTime")}
            >
              {t.resetTime}
            </button>
          </div>
        </div>

        <div style={styles.controlGroup}>
          <h3 style={styles.groupTitle}>{t.playback}</h3>
          <div style={styles.buttonGroup}>
            <button
              className="timeline-playground-button"
              style={isPlaying ? styles.buttonDanger : styles.buttonPrimary}
              onClick={() => handleAction("togglePlay")}
            >
              {isPlaying ? t.pause : t.play}
            </button>
            <button
              className="timeline-playground-button"
              style={styles.button}
              onClick={() => handleAction("stop")}
            >
              {t.stop}
            </button>
          </div>
          <label style={styles.sliderContainer}>
            <span>
              {t.speed}: {playSpeed}x
            </span>
            <input
              aria-valuetext={`${playSpeed}x`}
              type="range"
              min="0.5"
              max="5"
              step="0.5"
              value={playSpeed}
              onChange={(e) => setPlaySpeed(parseFloat(e.target.value))}
              style={styles.slider}
            />
          </label>
        </div>

        <div style={{ ...styles.controlGroup, gridColumn: "1 / -1" }}>
          <h3 style={styles.groupTitle}>{t.toggles}</h3>
          <div style={styles.toggleGroup}>
            <label style={styles.toggle}>
              <input
                type="checkbox"
                checked={config.enableEventResize}
                onChange={() => toggleConfig("enableEventResize")}
                style={{ cursor: "pointer" }}
              />
              {t.enableResize}
            </label>
            <label style={styles.toggle}>
              <input
                type="checkbox"
                checked={config.enableEventSplit}
                onChange={() => toggleConfig("enableEventSplit")}
                style={{ cursor: "pointer" }}
              />
              {t.enableSplit}
            </label>
            <label style={styles.toggle}>
              <input
                type="checkbox"
                checked={config.enableTimeIndicator}
                onChange={() => toggleConfig("enableTimeIndicator")}
                style={{ cursor: "pointer" }}
              />
              {t.showTimeIndicator}
            </label>
            <label style={styles.toggle}>
              <input
                type="checkbox"
                checked={config.snapToSeconds}
                onChange={() => toggleConfig("snapToSeconds")}
                style={{ cursor: "pointer" }}
              />
              {t.snapToSeconds}
            </label>
            <label style={styles.toggle}>
              <input
                type="checkbox"
                checked={config.showEventDurationLabel}
                onChange={() => toggleConfig("showEventDurationLabel")}
                style={{ cursor: "pointer" }}
              />
              {t.showDurationLabel}
            </label>
            <label style={styles.toggle}>
              <input
                type="checkbox"
                checked={config.debug}
                onChange={() => toggleConfig("debug")}
                style={{ cursor: "pointer" }}
              />
              {t.debug}
            </label>
            <label style={styles.toggle}>
              <input
                type="checkbox"
                checked={config.readOnly}
                onChange={() => toggleConfig("readOnly")}
                style={{ cursor: "pointer" }}
              />
              {t.readOnly}
            </label>
          </div>
        </div>

        <details style={{ gridColumn: "1 / -1" }}>
          <summary className="timeline-playground-summary" style={styles.pluginSummary}>
            {t.builtInPlugins} ({builtinPlugins.length})
          </summary>
          <div style={styles.pluginList}>
            {builtinPlugins.map((plugin) => (
              <div key={plugin.name} style={styles.pluginItem}>
                <span style={styles.pluginName}>{plugin.name}</span>
                <span style={styles.pluginDescription}>{plugin.description}</span>
              </div>
            ))}
          </div>
        </details>
      </div>

      <section style={styles.eventSection} aria-labelledby="timeline-playground-events-heading">
        <h3 id="timeline-playground-events-heading" style={styles.groupTitle}>
          {t.events}
        </h3>
        {accessibleEvents.length === 0 ? (
          <p style={{ margin: "8px 0 0", color: "#bac2de", fontSize: "13px" }}>{t.noEvents}</p>
        ) : (
          <ul style={styles.eventList}>
            {accessibleEvents.map((item) => {
              const eventKey = `${item.trackIndex}:${item.eventIndex}`;
              const canEdit = !config.readOnly && !item.event.readonly;
              return (
                <li
                  key={`${eventKey}:${item.event.title}:${item.event.startTime}:${item.event.endTime}`}
                  style={styles.eventItem}
                >
                  <button
                    className="timeline-playground-button"
                    type="button"
                    style={{
                      ...styles.eventSelect,
                      background: selectedEventKey === eventKey ? "#313244" : "transparent",
                    }}
                    aria-pressed={selectedEventKey === eventKey}
                    aria-label={`${t.selectEvent}: ${item.event.title}`}
                    onClick={() => selectAccessibleEvent(item)}
                  >
                    <strong>{item.event.title}</strong>
                    <span style={styles.eventMeta}>
                      {t.track} {item.trackIndex + 1} · {formatTime(item.event.startTime)} -{" "}
                      {formatTime(item.event.endTime)}
                    </span>
                  </button>
                  {canEdit && (
                    <details style={styles.editDisclosure}>
                      <summary className="timeline-playground-summary" style={styles.editSummary}>
                        {t.edit}
                      </summary>
                      <form
                        className="timeline-playground-edit-form"
                        style={styles.editForm}
                        onSubmit={(event) => editAccessibleEvent(event, item)}
                      >
                        <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                          {t.title}
                          <input
                            className="timeline-playground-input"
                            style={styles.input}
                            name="title"
                            defaultValue={item.event.title}
                            required
                          />
                        </label>
                        <label style={styles.field}>
                          {t.start}
                          <input
                            className="timeline-playground-input"
                            style={styles.input}
                            name="startTime"
                            type="number"
                            step="any"
                            defaultValue={item.event.startTime}
                            required
                          />
                        </label>
                        <label style={styles.field}>
                          {t.end}
                          <input
                            className="timeline-playground-input"
                            style={styles.input}
                            name="endTime"
                            type="number"
                            step="any"
                            defaultValue={item.event.endTime}
                            required
                          />
                        </label>
                        <button
                          className="timeline-playground-button"
                          style={{ ...styles.buttonPrimary, gridColumn: "1 / -1" }}
                          type="submit"
                        >
                          {t.save}
                        </button>
                      </form>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default TimelinePlayground;
