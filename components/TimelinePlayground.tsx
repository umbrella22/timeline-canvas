import { useEffect, useMemo, useRef, useState, CSSProperties } from 'react';
import { Timeline } from '../../../packages/timeline/src/index';
import { LightThemePlugin } from '../../../packages/timeline/src/plugins/builtin/LightThemePlugin';
import { DarkThemePlugin } from '../../../packages/timeline/src/plugins/builtin/DarkThemePlugin';
import { ContextMenuPlugin } from '../../../packages/timeline/src/plugins/builtin/ContextMenuPlugin';
import { PerformanceOverlayPlugin } from '../../../packages/timeline/src/plugins/builtin/PerformanceOverlayPlugin';
import { EventMediaPlugin } from '../../../packages/timeline/src/plugins/builtin/EventMediaPlugin';
import { MutexGuardPlugin } from '../../../packages/timeline/src/plugins/builtin/MutexGuardPlugin';
import { EventTooltipPlugin } from '../../../packages/timeline/src/plugins/builtin/EventTooltipPlugin';

// Inline styles
const styles: Record<string, CSSProperties> = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '20px',
        background: '#1e1e2e',
        borderRadius: '12px',
        color: '#cdd6f4',
        fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    canvasContainer: {
        position: 'relative',
        background: '#181825',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #313244',
        height: '600px',
    },
    canvas: {
        display: 'block',
        width: '100%',
        height: '100%',
    },
    controls: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '16px',
        background: '#313244',
        borderRadius: '8px',
    },
    controlGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minWidth: '200px',
    },
    groupTitle: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#89b4fa',
        marginBottom: '4px',
    },
    buttonGroup: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
    },
    button: {
        padding: '8px 12px',
        background: '#45475a',
        border: 'none',
        borderRadius: '4px',
        color: '#cdd6f4',
        cursor: 'pointer',
        fontSize: '13px',
        transition: 'all 0.2s',
    },
    buttonPrimary: {
        padding: '8px 12px',
        background: '#89b4fa',
        border: 'none',
        borderRadius: '4px',
        color: '#1e1e2e',
        cursor: 'pointer',
        fontSize: '13px',
        transition: 'all 0.2s',
    },
    buttonDanger: {
        padding: '8px 12px',
        background: '#f38ba8',
        border: 'none',
        borderRadius: '4px',
        color: '#1e1e2e',
        cursor: 'pointer',
        fontSize: '13px',
        transition: 'all 0.2s',
    },
    toggle: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        cursor: 'pointer',
    },
    status: {
        fontSize: '13px',
        color: '#a6adc8',
        padding: '8px',
        background: '#313244',
        borderRadius: '4px',
    },
    sliderContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
    },
    slider: {
        flex: '1',
    },
};

type TimelinePlaygroundLang = 'zh' | 'en';

const getText = (lang: TimelinePlaygroundLang) => {
  if (lang === 'en') {
    return {
      ready: 'Ready',
      status: 'Status',
      basicActions: 'Basic Actions',
      viewControls: 'View Controls',
      playback: 'Playback',
      toggles: 'Toggles',
      addTrack: 'Add Track',
      removeTrack: 'Remove Track',
      addEvent: 'Add Event',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      resetTime: 'Reset Time',
      play: 'Play',
      pause: 'Pause',
      stop: 'Stop',
      speed: 'Speed',
      enableResize: 'Enable resizing',
      enableSplit: 'Enable splitting',
      showTimeIndicator: 'Show time indicator',
      snapToSeconds: 'Snap to seconds',
      showDurationLabel: 'Show duration label',
      debug: 'Debug mode',
      readOnly: 'Read-only mode',
      trackAdded: 'Added a new track',
      trackRemoved: 'Removed the last track',
      eventAdded: 'Added a new event',
      eventSelected: (title: string, trackName: string) => `Selected event: ${title} (track: ${trackName})`,
      confirmDelete: (title: string) => `Are you sure you want to delete "${title}"?`,
      editEvent: (title: string) => `Edit event: ${title}`,
      newEventTitle: 'New Event',
      newEventDesc: 'Added manually',
      shiftMorning: 'Day Shift',
      shiftMorningDesc: 'Morning work block',
      shiftNight: 'Night Shift',
      shiftNightDesc: 'Night work block',
      readonlyEvent: 'Read-only Event',
      mutexExample: 'Mutex Example',
      menuEdit: '✏️ Edit',
      menuDuplicate: '📋 Duplicate',
      menuDelete: '🗑️ Delete',
      menuExport: '📤 Export',
      duplicateSuffix: ' (Copy)',
    };
  }

  return {
    ready: '就绪',
    status: '状态',
    basicActions: '基础操作',
    viewControls: '视图控制',
    playback: '播放控制',
    toggles: '功能开关',
    addTrack: '添加轨道',
    removeTrack: '删除轨道',
    addEvent: '添加事件',
    zoomIn: '放大',
    zoomOut: '缩小',
    resetTime: '重置时间',
    play: '播放',
    pause: '暂停',
    stop: '停止',
    speed: '速度',
    enableResize: '允许调整大小',
    enableSplit: '允许切割事件',
    showTimeIndicator: '显示时间指示器',
    snapToSeconds: '秒级吸附',
    showDurationLabel: '显示时长标签',
    debug: '调试模式',
    readOnly: '只读模式',
    trackAdded: '添加了新轨道',
    trackRemoved: '删除了最后一个轨道',
    eventAdded: '添加了新事件',
    eventSelected: (title: string, trackName: string) => `选中事件: ${title} (轨道: ${trackName})`,
    confirmDelete: (title: string) => `确定要删除事件 "${title}" 吗？`,
    editEvent: (title: string) => `编辑事件: ${title}`,
    newEventTitle: '新事件',
    newEventDesc: '手动添加',
    shiftMorning: '早班',
    shiftMorningDesc: '上午工作时段',
    shiftNight: '夜班',
    shiftNightDesc: '夜间工作时段',
    readonlyEvent: '只读事件',
    mutexExample: '互斥示例',
    menuEdit: '✏️ 编辑',
    menuDuplicate: '📋 复制',
    menuDelete: '🗑️ 删除',
    menuExport: '📤 导出',
    duplicateSuffix: ' (副本)',
  };
};

const TimelinePlayground = ({ lang = 'zh' }: { lang?: TimelinePlaygroundLang }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const timelineRef = useRef<Timeline | null>(null);
    const t = useMemo(() => getText(lang), [lang]);
    const [status, setStatus] = useState(t.ready);
    const [playSpeed, setPlaySpeed] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);
    const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Feature toggles state
    const [config, setConfig] = useState({
        enableEventResize: true,
        enableEventSplit: true,
        enableTimeIndicator: true,
        enableContextMenu: true,
        debug: true,
        snapToSeconds: true,
        showEventDurationLabel: true,
        autoAddTrack: true,
        autoRemoveEmptyLastTrack: true,
        readOnly: false,
        theme: 'light', // 'light' or 'dark'
    });

    useEffect(() => {
        if (!canvasRef.current) return;

        // Generate a unique ID for the canvas if it doesn't have one
        const canvasId = 'timeline-playground-canvas';
        canvasRef.current.id = canvasId;

        // Initialize Timeline
        const timeline = new Timeline(canvasId, {
            canvasHeight: 600,
            startTime: 0,
            endTime: 3600,
            endPaddingTime: 60,
            secondWidth: 0.022, // 80 / 3600
            trackHeight: 46,
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
                { type: 'edit', name: t.menuEdit },
                { type: 'duplicate', name: t.menuDuplicate },
                { type: 'delete', name: t.menuDelete },
                { type: 'export', name: t.menuExport },
            ],

            onEventClick: (data) => {
                setStatus(t.eventSelected(data.event.title, data.trackName));
                console.log('Event Clicked:', data);
            },
            onStatusChange: (_text) => {
                // Only update if it's a significant status change to avoid too many re-renders
                // or just log it. For now, we'll use the local status for major events.
            },
            onContextMenu: (data) => {
                console.log('Context Menu:', data);
                if (data.menuType === 'delete') {
                    if (confirm(t.confirmDelete(data.event.title))) {
                        timeline.deleteEvent(data.trackIndex, data.eventIndex);
                    }
                } else if (data.menuType === 'duplicate') {
                    timeline.addEvent(
                        data.trackIndex,
                        data.event.endTime,
                        data.event.endTime + data.event.duration,
                        data.event.title + t.duplicateSuffix,
                        data.event.description,
                        data.event.customData
                    );
                } else if (data.menuType === 'edit') {
                    alert(t.editEvent(data.event.title));
                }
            }
        });

        // Load Plugins
        timeline.usePlugin(config.theme === 'dark' ? DarkThemePlugin : LightThemePlugin);
        timeline.usePlugin(ContextMenuPlugin());
        timeline.usePlugin(PerformanceOverlayPlugin);
        timeline.usePlugin(MutexGuardPlugin());
        timeline.usePlugin(EventMediaPlugin());
        timeline.usePlugin(EventTooltipPlugin());

        // Load Data
        const N = 20000;
        const waveformData = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            const t = i / 200;
            waveformData[i] = Math.sin(t) * 0.8 + Math.sin(t * 0.25) * 0.2;
        }

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
                            customData: { priority: "high" },
                            media: { images: [{ src: "https://picsum.photos/200/300", fit: "contain", opacity: 0.35 }] }
                        },
                        {
                            startTime: 1800,
                            endTime: 3600,
                            title: t.shiftNight,
                            description: t.shiftNightDesc,
                            customData: { priority: "normal" }
                        }
                    ]
                },
                {
                    events: [
                        {
                            startTime: 0,
                            endTime: 900,
                            title: t.readonlyEvent,
                            readonly: true,
                            media: { waveform: { data: waveformData, color: "#FF7F00", backgroundColor: "rgba(255,255,255,0.03)", opacity: 0.5 } }
                        },
                        {
                            startTime: 1200,
                            endTime: 2100,
                            title: t.mutexExample,
                            customData: { mutex: ["work"] }
                        }
                    ]
                }
            ]
        });

        timelineRef.current = timeline;

        return () => {
            if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current);
            }
        };
    }, [t]);

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
    }, [config]);

    const handleAction = (action: string) => {
        if (!timelineRef.current) return;
        const timeline = timelineRef.current;

        switch (action) {
            case 'addTrack':
                timeline.addTrack();
                setStatus(t.trackAdded);
                break;
            case 'removeTrack':
                timeline.removeTrack();
                setStatus(t.trackRemoved);
                break;
            case 'addEvent':
                const trackIndex = timeline.state?.selectedTrack || 0;
                const startTime = timeline.state?.timeIndicatorPosition || timeline.config.startTime;
                timeline.addEvent(trackIndex, startTime, startTime + 100, t.newEventTitle, t.newEventDesc);
                setStatus(t.eventAdded);
                break;
            case 'zoomIn':
                timeline.zoom(1.2);
                break;
            case 'zoomOut':
                timeline.zoom(0.8);
                break;
            case 'resetTime':
                timeline.setTimeIndicator(timeline.config.startTime);
                break;
            case 'togglePlay':
                if (isPlaying) {
                    if (playIntervalRef.current) clearInterval(playIntervalRef.current);
                    setIsPlaying(false);
                } else {
                    playIntervalRef.current = setInterval(() => {
                        if (!timelineRef.current) return;
                        let newTime = timelineRef.current.state.timeIndicatorPosition + playSpeed;
                        if (newTime >= timelineRef.current.config.endTime) {
                            newTime = timelineRef.current.config.startTime;
                        }
                        timelineRef.current.setTimeIndicator(newTime);
                    }, 100);
                    setIsPlaying(true);
                }
                break;
            case 'stop':
                if (playIntervalRef.current) clearInterval(playIntervalRef.current);
                setIsPlaying(false);
                timeline.setTimeIndicator(timeline.config.startTime);
                break;
        }
    };

    const toggleConfig = (key: keyof typeof config) => {
        setConfig((prev: typeof config) => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div style={styles.container}>
            <div style={styles.canvasContainer}>
                <canvas ref={canvasRef} style={styles.canvas} />
            </div>

            <div style={styles.status}>
                {t.status}: {status}
            </div>

            <div style={styles.controls}>
                <div style={styles.controlGroup}>
                    <div style={styles.groupTitle}>{t.basicActions}</div>
                    <div style={styles.buttonGroup}>
                        <button style={styles.buttonPrimary} onClick={() => handleAction('addTrack')}>{t.addTrack}</button>
                        <button style={styles.buttonDanger} onClick={() => handleAction('removeTrack')}>{t.removeTrack}</button>
                        <button style={styles.buttonPrimary} onClick={() => handleAction('addEvent')}>{t.addEvent}</button>
                    </div>
                </div>

                <div style={styles.controlGroup}>
                    <div style={styles.groupTitle}>{t.viewControls}</div>
                    <div style={styles.buttonGroup}>
                        <button style={styles.button} onClick={() => handleAction('zoomIn')}>{t.zoomIn}</button>
                        <button style={styles.button} onClick={() => handleAction('zoomOut')}>{t.zoomOut}</button>
                        <button style={styles.button} onClick={() => handleAction('resetTime')}>{t.resetTime}</button>
                    </div>
                </div>

                <div style={styles.controlGroup}>
                    <div style={styles.groupTitle}>{t.playback}</div>
                    <div style={styles.buttonGroup}>
                        <button style={isPlaying ? styles.buttonDanger : styles.buttonPrimary} onClick={() => handleAction('togglePlay')}>
                            {isPlaying ? t.pause : t.play}
                        </button>
                        <button style={styles.button} onClick={() => handleAction('stop')}>{t.stop}</button>
                    </div>
                    <div style={styles.sliderContainer}>
                        <span>{t.speed}: {playSpeed}x</span>
                        <input
                            type="range"
                            min="0.5"
                            max="5"
                            step="0.5"
                            value={playSpeed}
                            onChange={(e) => setPlaySpeed(parseFloat(e.target.value))}
                            style={styles.slider}
                        />
                    </div>
                </div>

                <div style={styles.controlGroup}>
                    <div style={styles.groupTitle}>{t.toggles}</div>
                    <div style={{ ...styles.buttonGroup, flexDirection: 'column', gap: '4px' }}>
                        <label style={styles.toggle}>
                            <input type="checkbox" checked={config.enableEventResize} onChange={() => toggleConfig('enableEventResize')} style={{ cursor: 'pointer' }} />
                            {t.enableResize}
                        </label>
                        <label style={styles.toggle}>
                            <input type="checkbox" checked={config.enableEventSplit} onChange={() => toggleConfig('enableEventSplit')} style={{ cursor: 'pointer' }} />
                            {t.enableSplit}
                        </label>
                        <label style={styles.toggle}>
                            <input type="checkbox" checked={config.enableTimeIndicator} onChange={() => toggleConfig('enableTimeIndicator')} style={{ cursor: 'pointer' }} />
                            {t.showTimeIndicator}
                        </label>
                        <label style={styles.toggle}>
                            <input type="checkbox" checked={config.snapToSeconds} onChange={() => toggleConfig('snapToSeconds')} style={{ cursor: 'pointer' }} />
                            {t.snapToSeconds}
                        </label>
                        <label style={styles.toggle}>
                            <input type="checkbox" checked={config.showEventDurationLabel} onChange={() => toggleConfig('showEventDurationLabel')} style={{ cursor: 'pointer' }} />
                            {t.showDurationLabel}
                        </label>
                        <label style={styles.toggle}>
                            <input type="checkbox" checked={config.debug} onChange={() => toggleConfig('debug')} style={{ cursor: 'pointer' }} />
                            {t.debug}
                        </label>
                        <label style={styles.toggle}>
                            <input type="checkbox" checked={config.readOnly} onChange={() => toggleConfig('readOnly')} style={{ cursor: 'pointer' }} />
                            {t.readOnly}
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimelinePlayground;
