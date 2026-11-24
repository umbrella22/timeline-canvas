import type { ScheduleDataFormat } from "../../../packages/timeline/src/index";

/**
 * 资源排程示例数据：固定种子可复现。
 * 08:00–18:00（相对秒 28800–64800），产线 A1–A10，工单含数量/完成百分比/告警。
 */

export interface ResourceLineMeta {
  businessId: string;
  name: string;
  nameEn: string;
  status: string;
  statusEn: string;
  utilization: number;
}

/** mulberry32 固定种子伪随机，保证 10x40 与 100 行总 10000 两组数据可复现 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DAY_START = 28800; // 08:00
export const DAY_END = 64800; // 18:00

function buildLines(count: number, rand: () => number): ResourceLineMeta[] {
  return Array.from({ length: count }, (_, i) => {
    const running = rand() > 0.2;
    return {
      businessId: `A${i + 1}`,
      name: `产线 A${i + 1}`,
      nameEn: `Line A${i + 1}`,
      status: running ? "运行中" : "待料",
      statusEn: running ? "Running" : "Waiting",
      utilization: Math.round(rand() * 400) / 10,
    };
  });
}

/**
 * 每行工单按时间窗等分槽位排布：第 i 条起点落在第 i 个槽内并做 ≤10% 槽宽抖动，
 * 条宽取槽宽的 45%–85%。抖动上限 + 条宽上限 = 95% < 100%，因此 count 条工单必然
 * 全部落在 08:00–18:00 内、互不重叠，且请求数量与实际生成数量一致（不依赖窗口截断）。
 */
function buildTrackEvents(
  line: ResourceLineMeta,
  orderOffset: number,
  count: number,
  rand: () => number,
): ScheduleDataFormat["tracks"][number]["events"] {
  const events: ScheduleDataFormat["tracks"][number]["events"] = [];
  const slot = (DAY_END - DAY_START) / count;
  for (let i = 0; i < count; i++) {
    const startTime = Math.round(DAY_START + i * slot + rand() * slot * 0.1);
    const endTime = Math.round(startTime + slot * (0.45 + rand() * 0.4));
    const quantity = 10 + Math.floor(rand() * 240);
    const progress = Math.floor(rand() * 101);
    const alert = rand() > 0.85;
    events.push({
      businessId: `${line.businessId}-WO-${(orderOffset + i + 1).toString().padStart(5, "0")}`,
      startTime,
      endTime,
      title: `${line.businessId}-${(orderOffset + i + 1).toString().padStart(5, "0")}`,
      customData: {
        quantity,
        progress,
        alert,
        item: `物料 ${(orderOffset + i) % 12 + 1}`,
        itemEn: `Material ${(orderOffset + i) % 12 + 1}`,
      },
    });
  }
  return events;
}

/** 10 产线 x 40 工单的查看示例数据（10 小时工作窗，08:00–18:00） */
export function buildResourceSchedule(seed = 20260912): ScheduleDataFormat {
  const rand = mulberry32(seed);
  const lines = buildLines(10, rand);
  let orderOffset = 0;
  return {
    timeIndicatorPosition: DAY_START + 3600,
    tracks: lines.map((line) => {
      const events = buildTrackEvents(line, orderOffset, 40, rand);
      orderOffset += 40;
      return {
        businessId: line.businessId,
        customData: {
          name: line.name,
          nameEn: line.nameEn,
          status: line.status,
          statusEn: line.statusEn,
          utilization: line.utilization,
        },
        events,
      };
    }),
  };
}

/** 压测数据：rows 行、总计 total 个工单（注意不是每行 total 个） */
export function buildBenchmarkSchedule(
  rows: number,
  total: number,
  seed = 20260912,
): ScheduleDataFormat {
  const rand = mulberry32(seed);
  const lines = buildLines(rows, rand);
  const perRow = Math.floor(total / rows);
  let orderOffset = 0;
  const tracks = lines.map((line) => {
    const events = buildTrackEvents(line, orderOffset, perRow, rand);
    orderOffset += perRow;
    return {
      businessId: line.businessId,
      customData: {
        name: line.name,
        nameEn: line.nameEn,
        status: line.status,
        statusEn: line.statusEn,
        utilization: 0,
      },
      events,
    };
  });
  return { tracks };
}
