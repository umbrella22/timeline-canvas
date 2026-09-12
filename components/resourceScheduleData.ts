import type { ScheduleDataFormat } from "../../../packages/timeline/src/index";

/**
 * 资源排程示例数据：固定种子可复现。
 * 08:00–18:00（相对秒 28800–64800），产线 A1–A4，工单含数量/完成百分比/告警。
 */

export interface ResourceLineMeta {
  businessId: string;
  name: string;
  nameEn: string;
  status: string;
  statusEn: string;
  utilization: number;
}

/** mulberry32 固定种子伪随机，保证 4x40 与 100 行总 10000 两组数据可复现 */
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

/** 每行工单互不重叠；工单时长 300–3600 秒，间隔 120–900 秒 */
function buildTrackEvents(
  line: ResourceLineMeta,
  orderOffset: number,
  count: number,
  rand: () => number,
): ScheduleDataFormat["tracks"][number]["events"] {
  const events: ScheduleDataFormat["tracks"][number]["events"] = [];
  let cursor = DAY_START + Math.floor(rand() * 600);
  for (let i = 0; i < count; i++) {
    const duration = 300 + Math.floor(rand() * 3300);
    const endTime = cursor + duration;
    if (endTime > DAY_END) break;
    const quantity = 10 + Math.floor(rand() * 240);
    const progress = Math.floor(rand() * 101);
    const alert = rand() > 0.85;
    events.push({
      businessId: `${line.businessId}-WO-${(orderOffset + i + 1).toString().padStart(5, "0")}`,
      startTime: cursor,
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
    cursor = endTime + 120 + Math.floor(rand() * 780);
  }
  return events;
}

/** 4 产线 x 40 工单的查看示例数据（8 小时工作窗） */
export function buildResourceSchedule(seed = 20260912): ScheduleDataFormat {
  const rand = mulberry32(seed);
  const lines = buildLines(4, rand);
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
