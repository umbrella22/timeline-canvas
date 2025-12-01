import { useEffect, useRef, useState, CSSProperties } from 'react';
import { Timeline } from '../../src/index';
import { LightThemePlugin } from '../../src/plugins/builtin/LightThemePlugin';
import { DarkThemePlugin } from '../../src/plugins/builtin/DarkThemePlugin';
import { ContextMenuPlugin } from '../../src/plugins/builtin/ContextMenuPlugin';
import { PerformanceOverlayPlugin } from '../../src/plugins/builtin/PerformanceOverlayPlugin';
import { EventMediaPlugin } from '../../src/plugins/builtin/EventMediaPlugin';
import { MutexGuardPlugin } from '../../src/plugins/builtin/MutexGuardPlugin';
import { EventTooltipPlugin } from "../../src/plugins/builtin/EventTooltipPlugin"

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

const TimelinePlayground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const timelineRef = useRef<Timeline | null>(null);
    const [status, setStatus] = useState('就绪');
    const [playSpeed, setPlaySpeed] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);
    const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
            timelineHeight: 60,

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
                { type: 'edit', name: '✏️ 编辑' },
                { type: 'duplicate', name: '📋 复制' },
                { type: 'delete', name: '🗑️ 删除' },
                { type: 'export', name: '📤 导出' },
            ],

            onEventClick: (data) => {
                setStatus(`选中事件: ${data.event.title} (轨道: ${data.trackName})`);
                console.log('Event Clicked:', data);
            },
            onStatusChange: (_text) => {
                // Only update if it's a significant status change to avoid too many re-renders
                // or just log it. For now, we'll use the local status for major events.
            },
            onContextMenu: (data) => {
                console.log('Context Menu:', data);
                if (data.menuType === 'delete') {
                    if (confirm(`确定要删除事件 "${data.event.title}" 吗？`)) {
                        timeline.deleteEvent(data.trackIndex, data.eventIndex);
                    }
                } else if (data.menuType === 'duplicate') {
                    timeline.addEvent(
                        data.trackIndex,
                        data.event.endTime,
                        data.event.endTime + data.event.duration,
                        data.event.title + ' (副本)',
                        data.event.description,
                        data.event.customData
                    );
                } else if (data.menuType === 'edit') {
                    alert(`编辑事件: ${data.event.title}`);
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
                            title: "早班",
                            description: "上午工作时段",
                            customData: { priority: "high" },
                            media: { images: [{ src: "https://picsum.photos/200/300", fit: "contain", opacity: 0.35 }] }
                        },
                        {
                            startTime: 1800,
                            endTime: 3600,
                            title: "夜班",
                            description: "夜间工作时段",
                            customData: { priority: "normal" }
                        }
                    ]
                },
                {
                    events: [
                        {
                            startTime: 0,
                            endTime: 900,
                            title: "只读事件",
                            readonly: true,
                            media: { waveform: { data: waveformData, color: "#FF7F00", backgroundColor: "rgba(255,255,255,0.03)", opacity: 0.5 } }
                        },
                        {
                            startTime: 1200,
                            endTime: 2100,
                            title: "互斥示例",
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
    }, []); // Run once on mount

    // Update config when state changes
    useEffect(() => {
        if (!timelineRef.current) return;
        const timeline = timelineRef.current;

        timeline.config.enableEventResize = config.enableEventResize;
        timeline.config.enableEventSplit = config.enableEventSplit;
        timeline.config.enableTimeIndicator = config.enableTimeIndicator;
        timeline.config.enableContextMenu = config.enableContextMenu;
        timeline.config.debug = config.debug;
        timeline.config.snapToSeconds = config.snapToSeconds;
        timeline.config.showEventDurationLabel = config.showEventDurationLabel;
        timeline.config.autoAddTrack = config.autoAddTrack;
        timeline.config.autoRemoveEmptyLastTrack = config.autoRemoveEmptyLastTrack;
        timeline.config.readOnly = config.readOnly;

        timeline.draw();
    }, [config]);

    const handleAction = (action: string) => {
        if (!timelineRef.current) return;
        const timeline = timelineRef.current;

        switch (action) {
            case 'addTrack':
                timeline.addTrack();
                setStatus('添加了新轨道');
                break;
            case 'removeTrack':
                timeline.removeTrack();
                setStatus('删除了最后一个轨道');
                break;
            case 'addEvent':
                const trackIndex = timeline.state?.selectedTrack || 0;
                const startTime = timeline.state?.timeIndicatorPosition || timeline.config.startTime;
                timeline.addEvent(trackIndex, startTime, startTime + 100, '新事件', '手动添加');
                setStatus('添加了新事件');
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
                状态: {status}
            </div>

            <div style={styles.controls}>
                <div style={styles.controlGroup}>
                    <div style={styles.groupTitle}>基础操作</div>
                    <div style={styles.buttonGroup}>
                        <button style={styles.buttonPrimary} onClick={() => handleAction('addTrack')}>添加轨道</button>
                        <button style={styles.buttonDanger} onClick={() => handleAction('removeTrack')}>删除轨道</button>
                        <button style={styles.buttonPrimary} onClick={() => handleAction('addEvent')}>添加事件</button>
                    </div>
                </div>

                <div style={styles.controlGroup}>
                    <div style={styles.groupTitle}>视图控制</div>
                    <div style={styles.buttonGroup}>
                        <button style={styles.button} onClick={() => handleAction('zoomIn')}>放大</button>
                        <button style={styles.button} onClick={() => handleAction('zoomOut')}>缩小</button>
                        <button style={styles.button} onClick={() => handleAction('resetTime')}>重置时间</button>
                    </div>
                </div>

                <div style={styles.controlGroup}>
                    <div style={styles.groupTitle}>播放控制</div>
                    <div style={styles.buttonGroup}>
                        <button style={isPlaying ? styles.buttonDanger : styles.buttonPrimary} onClick={() => handleAction('togglePlay')}>
                            {isPlaying ? '暂停' : '播放'}
                        </button>
                        <button style={styles.button} onClick={() => handleAction('stop')}>停止</button>
                    </div>
                    <div style={styles.sliderContainer}>
                        <span>速度: {playSpeed}x</span>
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
                    <div style={styles.groupTitle}>功能开关</div>
                    <div style={{ ...styles.buttonGroup, flexDirection: 'column', gap: '4px' }}>
                        <label style={styles.toggle}>
                            <input type="checkbox" checked={config.enableEventResize} onChange={() => toggleConfig('enableEventResize')} style={{ cursor: 'pointer' }} />
                            允许调整大小
                        </label>
                        <label style={styles.toggle}>
                            <input type="checkbox" checked={config.enableEventSplit} onChange={() => toggleConfig('enableEventSplit')} style={{ cursor: 'pointer' }} />
                            允许切割事件
                        </label>
                        <label style={styles.toggle}>
                            <input type="checkbox" checked={config.enableTimeIndicator} onChange={() => toggleConfig('enableTimeIndicator')} style={{ cursor: 'pointer' }} />
                            显示时间指示器
                        </label>
                        <label style={styles.toggle}>
                            <input type="checkbox" checked={config.snapToSeconds} onChange={() => toggleConfig('snapToSeconds')} style={{ cursor: 'pointer' }} />
                            秒级吸附
                        </label>
                        <label style={styles.toggle}>
                            <input type="checkbox" checked={config.showEventDurationLabel} onChange={() => toggleConfig('showEventDurationLabel')} style={{ cursor: 'pointer' }} />
                            显示时长标签
                        </label>
                        <label style={styles.toggle}>
                            <input type="checkbox" checked={config.debug} onChange={() => toggleConfig('debug')} style={{ cursor: 'pointer' }} />
                            调试模式
                        </label>
                        <label style={styles.toggle}>
                            <input type="checkbox" checked={config.readOnly} onChange={() => toggleConfig('readOnly')} style={{ cursor: 'pointer' }} />
                            只读模式
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimelinePlayground;
