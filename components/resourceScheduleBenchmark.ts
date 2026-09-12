import { Timeline } from "../../../packages/timeline/src/index";
import { buildBenchmarkSchedule } from "./resourceScheduleData";

/**
 * 资源排程基准：固定 seed 数据，输出可复现测量（p50/p95 + 样本数）。
 * 无法获取内存 API 时明确写 unsupported，不伪造 0 泄漏。
 */

export interface BenchmarkSample {
  label: string;
  samples: number[];
}

export interface BenchmarkReport {
  environment: {
    userAgent: string;
    devicePixelRatio: number;
    hardwareConcurrency: string;
    memory: string;
  };
  dataLayout: { rows: number; totalEvents: number; window: string };
  loadTimeMs: number;
  frameP50Ms: number;
  frameP95Ms: number;
  incrementalUpdateMs: { p50: number; p95: number; samples: number };
  mountUnmountMs: { p50: number; p95: number; samples: number };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

function summarize(label: string, samples: number[]): BenchmarkSample & { p50: number; p95: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    label,
    samples: sorted,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
  };
}

function createTimelineIn(container: HTMLElement, startTime: number, endTime: number): Timeline {
  const canvas = document.createElement("canvas");
  canvas.id = `benchmark-canvas-${Math.random().toString(36).slice(2)}`;
  container.appendChild(canvas);
  return new Timeline(canvas.id, {
    autoFitOnInit: false,
    startTime,
    endTime,
    startPaddingTime: 10,
    secondWidth: 0.03,
    trackHeight: 40,
    timelineHeight: 24,
    firstTrackTopMargin: 8,
  });
}

/** 运行两组固定数据测量；调用方负责提供挂载容器与销毁返回的实例列表 */
export async function runResourceScheduleBenchmark(
  container: HTMLElement,
  options: { loadSamples?: number; frameSamples?: number } = {},
): Promise<BenchmarkReport> {
  const loadSamples = options.loadSamples ?? 5;
  const frameSamples = options.frameSamples ?? 120;

  const rows = 100;
  // 请求上限；受 10 小时窗口约束，生成器实际可能放入更少事件
  const requestedEvents = 10000;
  const data = buildBenchmarkSchedule(rows, requestedEvents);
  // 报告实测规模：硬编码请求值会谎报被测数据集
  const totalEvents = data.tracks.reduce((sum, track) => sum + track.events.length, 0);

  const loadTimings: number[] = [];
  let timeline: Timeline | null = null;
  for (let i = 0; i < loadSamples; i++) {
    timeline?.destroy();
    timeline = createTimelineIn(container, 28800, 64800);
    const start = performance.now();
    const result = timeline.loadScheduleData(structuredClone(data));
    const elapsed = performance.now() - start;
    if (result.ok) loadTimings.push(elapsed);
  }

  const frameTimings: number[] = [];
  if (timeline) {
    for (let i = 0; i < frameSamples; i++) {
      // 强制脏层，避免把"无脏层空操作"当成帧耗时
      timeline.markDirty(["tracks", "timeline", "guideLines", "indicator", "scrollbar", "interaction"]);
      const start = performance.now();
      timeline.draw();
      frameTimings.push(performance.now() - start);
    }
  }

  const updateTimings: number[] = [];
  if (timeline) {
    // 探针 id 从实测数据派生：生成器每行带 orderOffset（A2 首单是 WO-00101），
    // 硬编码 "-WO-00001" 会大面积命中 not_found 拒绝路径使测量失真
    const probeIds = data.tracks
      .map((track) => track.events[0]?.businessId)
      .filter((id): id is NonNullable<typeof id> => id !== undefined);
    for (let i = 0; i < 30 && probeIds.length > 0; i++) {
      const businessId = probeIds[i % probeIds.length];
      const start = performance.now();
      timeline.updateEventByBusinessId(businessId, {
        customData: { quantity: i, progress: (i * 7) % 101, alert: false, item: `物料 ${i}` },
      });
      updateTimings.push(performance.now() - start);
    }
  }

  const mountTimings: number[] = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const instance = createTimelineIn(container, 28800, 64800);
    instance.loadScheduleData(structuredClone(data));
    mountTimings.push(performance.now() - start);
    const destroyStart = performance.now();
    await instance.destroy();
    mountTimings.push(performance.now() - destroyStart);
  }

  timeline?.destroy();
  container.textContent = "";

  const frames = summarize("frame", frameTimings);
  const updates = summarize("update", updateTimings);
  const mounts = summarize("mount/unmount", mountTimings);
  const loads = summarize("load", loadTimings);

  const memoryApi = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;

  return {
    environment: {
      userAgent: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio,
      hardwareConcurrency: String(navigator.hardwareConcurrency ?? "unknown"),
      memory: memoryApi ? `${(memoryApi.usedJSHeapSize / 1048576).toFixed(1)} MiB usedJSHeapSize` : "unsupported（无内存 API，不报告 0 泄漏）",
    },
    dataLayout: { rows, totalEvents, window: "08:00–18:00 (28800–64800s)" },
    loadTimeMs: loads.p50,
    frameP50Ms: frames.p50,
    frameP95Ms: frames.p95,
    incrementalUpdateMs: { p50: updates.p50, p95: updates.p95, samples: updates.samples.length },
    mountUnmountMs: { p50: mounts.p50, p95: mounts.p95, samples: mounts.samples.length },
  };
}
