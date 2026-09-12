/**
 * G10 契约 fixture：1.5.0 既有公开类型正例与兼容负例。
 * 由 `pnpm exec tsc -p packages/timeline/tsconfig.contract-tests.json --noEmit` 编译验证。
 * 负例的 @ts-expect-error 表示"这里必须保持编译失败"；
 * 若类型被放宽（如 number id 放宽为 string|number），指令将变为 unused 并使编译失败。
 */
import type {
  LoadDataFormat,
  TimelineEvent,
  TimelineOptions,
  Track,
} from "../../src";

export const legacyEvent: TimelineEvent = {
  id: 1,
  startTime: 0,
  endTime: 10,
  duration: 10,
  title: "早班",
  description: "",
  color: "#3F76FC",
  readonly: false,
  customData: { owner: "alice" },
};

export const legacyTrack: Track = { id: 0, events: [legacyEvent] };

export const legacyLoadData: LoadDataFormat = {
  timeIndicatorPosition: 5,
  tracks: [
    {
      events: [
        { startTime: 1, endTime: 2, title: "a" },
        { startTime: 3, duration: 2, title: "b", readonly: true },
      ],
    },
  ],
};

export const legacyOptions: TimelineOptions = {
  startTime: 0,
  endTime: 100,
  readOnly: false,
  onEventClick: (data) => {
    void data.trackIndex;
    void data.event.id;
  },
  onEventUpdate: (data) => {
    void data.type;
    void data.eventIndex;
  },
};

// C-01/C-10：TimelineEvent.id 必须保持 number，不得放宽为 string | number。
export function makeLegacyEvent(id: number): TimelineEvent {
  return {
    id,
    startTime: 0,
    endTime: 1,
    duration: 1,
    title: "t",
    description: "",
    color: "#000000",
  };
}

// @ts-expect-error C-01/C-10：旧 number id 合同要求 string id 被编译器拒绝
export const stringIdEvent: TimelineEvent = { ...legacyEvent, id: "1" };

// C-10：LoadDataFormat 的事件条目 title 为必填，缺省必须编译失败。
// @ts-expect-error title 必填
export const missingTitleData: LoadDataFormat = { tracks: [{ events: [{ startTime: 1, endTime: 2 }] }] };

// C-10：TimelineOptions.onEventMove 载荷保持 EventMoveData 形状。
export function onMove(data: {
  trackIndex: number;
  eventIndex: number;
  fromTrackIndex: number;
}): void {
  void data;
}

export const optionsWithMove: TimelineOptions = { onEventMove: onMove };
