import type {
  BusinessId,
  ScheduleDataFormat,
  ScheduleError,
  ScheduleEventInput,
  ScheduleEventLocation,
  ScheduleEventPatch,
  ScheduleEventUpsert,
  ScheduleResult,
  ScheduleTrackInput,
  TimelineConfig,
  TimelineEvent,
  TimelineState,
  Track,
} from "../../types";
import { cloneCustomData, cloneEvent, cloneValueIsolated, fixFloatPrecision, toJsonSafe } from "../../utils";
import type { BusinessIdentityIndex } from "./BusinessIdentityIndex";
import { isValidBusinessId } from "./BusinessIdentityIndex";
import type { EventIndexManager } from "./EventIndexManager";

export interface ScheduleDataServiceOptions {
  config: TimelineConfig;
  state: TimelineState;
  businessIdentityIndex: BusinessIdentityIndex;
  eventIndexManager: EventIndexManager;
  onMutate?: () => void;
}

const fail = (code: ScheduleError["code"], message: string, path?: string): { ok: false; error: ScheduleError } => ({  ok: false,
  error: path === undefined ? { code, message } : { code, path, message },
});

const ok = <T>(value: T): ScheduleResult<T> => ({ ok: true, value });

/**
 * 严格排程数据服务：验证/复制/暂存完成后单次原子发布 tracks，
 * 失败发生在 publish 前（零写入）；成功后查询、命中、选择和渲染看到同一份数据。
 * customData 只接受可 JSON 往返的值；导出与查询返回与内存隔离的快照
 * （customData 深拷贝；waveform.data 保留引用，复制策略见公开文档）。
 */
export class ScheduleDataService {
  private readonly config: TimelineConfig;
  private readonly state: TimelineState;
  private readonly businessIdentityIndex: BusinessIdentityIndex;
  private readonly eventIndexManager: EventIndexManager;
  private readonly onMutate: (() => void) | undefined;

  constructor(options: ScheduleDataServiceOptions) {
    this.config = options.config;
    this.state = options.state;
    this.businessIdentityIndex = options.businessIdentityIndex;
    this.eventIndexManager = options.eventIndexManager;
    this.onMutate = options.onMutate;
  }

  public loadScheduleData(data: ScheduleDataFormat): ScheduleResult<void> {
    if (data === null || typeof data !== "object" || !Array.isArray(data.tracks)) {
      return fail("invalid_input", "schedule data must be an object with a tracks array", "tracks");
    }
    if (data.tracks.length === 0) {
      return fail("invalid_input", "tracks must contain at least one resource", "tracks");
    }
    // 校验必须在任何状态写入之前完成，保证失败路径零写入（原子导入合同）
    if (
      data.timeIndicatorPosition !== undefined &&
      (typeof data.timeIndicatorPosition !== "number" || !Number.isFinite(data.timeIndicatorPosition))
    ) {
      return fail("invalid_input", "timeIndicatorPosition must be a finite number", "timeIndicatorPosition");
    }

    const seenEventIds = new Set<BusinessId>();
    const seenTrackIds = new Set<BusinessId>();
    const clonedTracks: Array<{
      businessId: BusinessId;
      customData?: Record<string, unknown>;
      events: ScheduleEventInput[];
    }> = [];

    for (let trackIndex = 0; trackIndex < data.tracks.length; trackIndex++) {
      const trackInput = data.tracks[trackIndex];
      const trackPath = `tracks[${trackIndex}]`;
      if (trackInput === null || typeof trackInput !== "object") {
        return fail("invalid_input", "track must be an object", trackPath);
      }
      if (!isValidBusinessId(trackInput.businessId)) {
        return fail("invalid_input", "track.businessId must be a non-empty string or a finite number", `${trackPath}.businessId`);
      }
      if (seenTrackIds.has(trackInput.businessId)) {
        return fail("duplicate_business_id", "duplicate track business id", `${trackPath}.businessId`);
      }
      seenTrackIds.add(trackInput.businessId);

      if (!Array.isArray(trackInput.events)) {
        return fail("invalid_input", "track.events must be an array", `${trackPath}.events`);
      }
      const customData = this.validateCustomData(trackInput.customData, `${trackPath}.customData`);
      if (!customData.ok) return customData;

      const events: ScheduleEventInput[] = [];
      for (let eventIndex = 0; eventIndex < trackInput.events.length; eventIndex++) {
        const eventPath = `${trackPath}.events[${eventIndex}]`;
        const validated = this.validateEventInput(trackInput.events[eventIndex], eventPath, seenEventIds);
        if (!validated.ok) return validated;
        events.push(validated.value);
      }

      clonedTracks.push({
        businessId: trackInput.businessId,
        ...(customData.value ? { customData: customData.value } : {}),
        events,
      });
    }

    // 验证全部通过：构建运行时事件并单次原子发布
    const tracks: Track[] = clonedTracks.map((trackInput, trackIndex) => ({
      id: trackIndex,
      businessId: trackInput.businessId,
      ...(trackInput.customData ? { customData: cloneCustomData(trackInput.customData) } : {}),
      events: trackInput.events.map((eventInput, eventIndex) =>
        this.createRuntimeEvent(eventInput, eventIndex),
      ),
    }));

    this.state.tracks = tracks;
    this.state.selectedTrack = null;
    this.state.selectedEvent = null;
    // 严格导入承诺“清空交互选择”：槽位指针全部清空（与 deleteEvent 的身份重解析互补）
    this.state.highlightedEvent = null;
    this.state.contextMenuEvent = null;
    this.state.contextMenuVisible = false;
    this.state.hoveredResizeHandle = null;
    this.state.hoveredSplitLine = null;
    this.state.lastClickEvent = null;
    // 拖拽/缩放进行中导入会让指针索引指向新数据集的同名索引（静默错改路径），一并清空
    this.state.draggingEvent = null;
    this.state.resizingEvent = null;

    this.eventIndexManager.invalidateAll();
    this.businessIdentityIndex.markAllDirty();
    this.onMutate?.();

    // timeIndicatorPosition 只做校验，不在此写入：
    // Timeline 包装层经 setTimeIndicator 写入（clamp + 通知单一入口）
    return ok(undefined);
  }

  public exportScheduleData(): ScheduleResult<ScheduleDataFormat> {
    const tracks: ScheduleTrackInput[] = [];
    for (let trackIndex = 0; trackIndex < this.state.tracks.length; trackIndex++) {
      const track = this.state.tracks[trackIndex];
      if (track.businessId === undefined) {
        return fail("missing_business_id", `track at index ${trackIndex} has no business id`, `tracks[${trackIndex}]`);
      }
      const events: ScheduleEventInput[] = [];
      for (let eventIndex = 0; eventIndex < track.events.length; eventIndex++) {
        const exported = this.exportEvent(track.events[eventIndex], trackIndex, eventIndex);
        if (!exported.ok) return exported;
        events.push(exported.value);
      }
      const customData = this.validateCustomData(track.customData, `tracks[${trackIndex}].customData`);
      if (!customData.ok) return customData;
      tracks.push({
        businessId: track.businessId,
        // 导出是与内存隔离的快照：customData 深拷贝，调用方修改导出结果不得污染运行时状态
        ...(customData.value ? { customData: cloneCustomData(customData.value) } : {}),
        events,
      });
    }

    // 导出当前指示器位置：round trip 反映实时状态，而不是加载时刻的旧值
    return ok({
      tracks,
      timeIndicatorPosition: this.state.timeIndicatorPosition,
    });
  }

  public getEventLocation(businessId: BusinessId): ScheduleEventLocation | null {
    if (!isValidBusinessId(businessId)) return null;
    const location = this.businessIdentityIndex.getEventLocation(businessId);
    if (!location) return null;
    const track = this.state.tracks[location.trackIndex];
    if (!track || track.businessId === undefined) return null;
    const event = track.events[location.eventIndex];
    if (!event) return null;
    return {
      trackIndex: location.trackIndex,
      eventIndex: location.eventIndex,
      resourceBusinessId: track.businessId,
      event: cloneEvent(event),
    };
  }

  /** 合并现有值后验证并应用 patch；不允许改写 id/businessId/duration */
  public patchEvent(
    businessId: BusinessId,
    patch: ScheduleEventPatch
  ): ScheduleResult<{ trackIndex: number; eventIndex: number; event: TimelineEvent; oldEvent: TimelineEvent }> {
    if (!isValidBusinessId(businessId)) {
      return fail("not_found", "no event with the given business id");
    }
    if (patch === null || typeof patch !== "object") {
      return fail("invalid_input", "patch must be an object");
    }
    for (const forbidden of ["id", "businessId", "duration"] as const) {
      if (forbidden in patch) {
        return fail("invalid_input", `patch must not change ${forbidden}`, String(forbidden));
      }
    }

    const location = this.businessIdentityIndex.getEventLocation(businessId);
    if (!location) {
      return fail("not_found", "no event with the given business id");
    }
    const track = this.state.tracks[location.trackIndex];
    const event = track?.events[location.eventIndex];
    if (!track || !event) {
      return fail("not_found", "no event with the given business id");
    }

    const mergedStart = patch.startTime ?? event.startTime;
    const mergedEnd = patch.endTime ?? event.endTime;
    if (typeof mergedStart !== "number" || !Number.isFinite(mergedStart)) {
      return fail("invalid_input", "startTime must be a finite number", "startTime");
    }
    if (typeof mergedEnd !== "number" || !Number.isFinite(mergedEnd)) {
      return fail("invalid_input", "endTime must be a finite number", "endTime");
    }
    if (mergedStart < this.config.startTime) {
      return fail("invalid_input", "startTime is before the timeline start", "startTime");
    }
    if (mergedEnd <= mergedStart) {
      return fail("invalid_input", "endTime must be greater than startTime", "endTime");
    }
    const maxEndTime = this.config.endTime + this.config.endPaddingTime;
    if (mergedEnd > maxEndTime) {
      return fail("invalid_input", "endTime exceeds the timeline window", "endTime");
    }
    if (patch.title !== undefined && (typeof patch.title !== "string" || patch.title.length === 0)) {
      return fail("invalid_input", "title must be a non-empty string", "title");
    }
    if (patch.description !== undefined && typeof patch.description !== "string") {
      return fail("invalid_input", "description must be a string", "description");
    }
    if (patch.color !== undefined && typeof patch.color !== "string") {
      return fail("invalid_input", "color must be a string", "color");
    }
    if (patch.readonly !== undefined && typeof patch.readonly !== "boolean") {
      return fail("invalid_input", "readonly must be a boolean", "readonly");
    }
    const customData = this.validateCustomData(patch.customData, "customData");
    if (!customData.ok) return customData;
    if (patch.media !== undefined) {
      const media = this.validateMedia(patch.media, "media");
      if (!media.ok) return media;
    }

    // 校验全部通过后再统一应用，保证 patch 的原子性
    const oldEvent = cloneEvent(event);
    const duration = fixFloatPrecision(mergedEnd - mergedStart);
    event.startTime = mergedStart;
    event.endTime = fixFloatPrecision(mergedStart + duration);
    event.duration = duration;
    if (patch.title !== undefined) event.title = patch.title;
    if (patch.description !== undefined) event.description = patch.description;
    if (patch.color !== undefined) event.color = patch.color;
    if (patch.readonly !== undefined) {
      if (patch.readonly) event.readonly = true;
      else delete event.readonly;
    }
    if (patch.customData !== undefined) {
      event.customData = cloneCustomData(customData.value as Record<string, unknown>);
    }
    if (patch.media !== undefined) {
      // 导入路径：波形缓冲按值隔离，调用方复用/修改输入缓冲不影响内部状态
      event.media = cloneValueIsolated(patch.media) as TimelineEvent["media"];
    }

    this.eventIndexManager.invalidateTrack(location.trackIndex);
    this.businessIdentityIndex.markTrackDirty(location.trackIndex);
    this.onMutate?.();
    return ok({ trackIndex: location.trackIndex, eventIndex: location.eventIndex, event, oldEvent });
  }

  /**
   * 完整业务事件替换：先整批验证（含批次内重复检查），全部通过后按序原子应用。
   * 已存在的业务 ID 就地替换或移动到目标资源；不存在则追加，沿用内部数字 id 分配。
   */
  public upsertScheduleEvents(
    items: ScheduleEventUpsert[]
  ): ScheduleResult<
    Array<{
      kind: "insert" | "replace" | "move";
      trackIndex: number;
      eventIndex: number;
      fromTrackIndex?: number;
      event: TimelineEvent;
      oldEvent?: TimelineEvent;
    }>
  > {
    if (!Array.isArray(items)) {
      return fail("invalid_input", "items must be an array", "items");
    }

    const seenBatchIds = new Set<BusinessId>();
    const validated: Array<{ targetTrackIndex: number; input: ScheduleEventInput }> = [];
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const itemPath = `items[${index}]`;
      if (item === null || typeof item !== "object") {
        return fail("invalid_input", "item must be an object", itemPath);
      }
      if (!isValidBusinessId(item.resourceBusinessId)) {
        return fail("not_found", "unknown resource business id", `${itemPath}.resourceBusinessId`);
      }
      const targetTrackIndex = this.businessIdentityIndex.getTrackIndex(item.resourceBusinessId);
      if (targetTrackIndex === null) {
        return fail("not_found", "unknown resource business id", `${itemPath}.resourceBusinessId`);
      }
      const input = this.validateEventInput(item.event, `${itemPath}.event`, seenBatchIds);
      if (!input.ok) return input;
      validated.push({ targetTrackIndex, input: input.value });
    }

    const ops: Array<{
      kind: "insert" | "replace" | "move";
      trackIndex: number;
      eventIndex: number;
      fromTrackIndex?: number;
      event: TimelineEvent;
      oldEvent?: TimelineEvent;
    }> = [];

    // 运行时事件全部在验证阶段构建：应用循环不再有任何可抛错步骤，保证整批原子
    const prepared = validated.map(({ targetTrackIndex, input }, index) => ({
      targetTrackIndex,
      input,
      // id/默认色在应用时按目标轨道真实状态确定
      runtimeEvent: this.createRuntimeEvent(input, 0),
      sequence: index,
    }));

    for (const { targetTrackIndex, input, runtimeEvent } of prepared) {
      const targetTrack = this.state.tracks[targetTrackIndex];
      const existing = this.businessIdentityIndex.getEventLocation(input.businessId);
      let oldEvent: TimelineEvent | undefined;
      let fromTrackIndex: number | undefined;
      let eventIndex: number;

      if (existing) {
        fromTrackIndex = existing.trackIndex;
        oldEvent = cloneEvent(this.state.tracks[existing.trackIndex].events[existing.eventIndex]);
        if (existing.trackIndex === targetTrackIndex) {
          // 同轨替换：保持位置与内部 number id（顺序与调色板颜色推导不变）
          runtimeEvent.id = oldEvent.id;
          targetTrack.events[existing.eventIndex] = runtimeEvent;
          eventIndex = existing.eventIndex;
        } else {
          // 跨轨移动：保持内部 number id，插入目标轨道末尾
          runtimeEvent.id = oldEvent.id;
          this.state.tracks[existing.trackIndex].events.splice(existing.eventIndex, 1);
          targetTrack.events.push(runtimeEvent);
          eventIndex = targetTrack.events.length - 1;
        }
        // 跨轨移动时目标轨道的长度/位置同样变化，两侧都必须标脏，
        // 否则下一次 sync 用旧桶重建源轨道后该 business id 会从索引中消失
        this.eventIndexManager.invalidateTrack(existing.trackIndex);
        this.businessIdentityIndex.markTrackDirty(existing.trackIndex);
        if (existing.trackIndex !== targetTrackIndex) {
          this.eventIndexManager.invalidateTrack(targetTrackIndex);
          this.businessIdentityIndex.markTrackDirty(targetTrackIndex);
        }
      } else {
        runtimeEvent.id = targetTrack.events.length;
        targetTrack.events.push(runtimeEvent);
        eventIndex = targetTrack.events.length - 1;
        this.eventIndexManager.invalidateTrack(targetTrackIndex);
        this.businessIdentityIndex.markTrackDirty(targetTrackIndex);
      }
      if (input.color === undefined) {
        runtimeEvent.color = this.defaultColor(eventIndex);
      }
      this.onMutate?.();

      let kind: "insert" | "replace" | "move";
      if (!existing) {
        kind = "insert";
      } else if (fromTrackIndex === targetTrackIndex) {
        kind = "replace";
      } else {
        kind = "move";
      }
      ops.push({
        kind,
        trackIndex: targetTrackIndex,
        eventIndex,
        ...(fromTrackIndex !== undefined ? { fromTrackIndex } : {}),
        event: runtimeEvent,
        ...(oldEvent ? { oldEvent } : {}),
      });
    }

    return ok(ops);
  }

  public getTrack(businessId: BusinessId): { trackIndex: number; track: Track } | null {
    if (!isValidBusinessId(businessId)) return null;
    const trackIndex = this.businessIdentityIndex.getTrackIndex(businessId);
    if (trackIndex === null) return null;
    const track = this.state.tracks[trackIndex];
    if (!track) return null;
    return {
      trackIndex,
      track: {
        id: track.id,
        ...(track.businessId !== undefined ? { businessId: track.businessId } : {}),
        ...(track.customData ? { customData: cloneCustomData(track.customData) } : {}),
        events: track.events.map(cloneEvent),
      },
    };
  }

  public updateTrackCustomData(
    businessId: BusinessId,
    patch: { customData?: Record<string, unknown> }
  ): ScheduleResult<Track> {
    if (patch === null || typeof patch !== "object") {
      return fail("invalid_input", "patch must be an object");
    }
    const trackIndex = this.businessIdentityIndex.getTrackIndex(businessId);
    if (trackIndex === null) {
      return fail("not_found", "no track with the given business id");
    }
    const track = this.state.tracks[trackIndex];
    if (!track) {
      return fail("not_found", "no track with the given business id");
    }
    if (patch.customData !== undefined) {
      const customData = this.validateCustomData(patch.customData, "customData");
      if (!customData.ok) return customData;
      if (customData.value) {
        track.customData = cloneCustomData(customData.value);
      }
    }
    this.onMutate?.();
    return ok(track);
  }

  /**
   * reconcile 发布前的单事件完整预检（title/时间窗/自定义数据/媒体序列化）。
   * 只校验不写入；不做批次内业务 id 去重（单事件语义，唯一性由调用方场景保证）。
   */
  public validateSingleEventInput(
    event: unknown,
    path: string
  ): ScheduleResult<ScheduleEventInput> {
    return this.validateEventInput(event, path, null);
  }

  /**
   * 校验并克隆一份事件输入；返回值可直接用于运行时发布。
   * seenEventIds 为 null 时跳过全局唯一性检查（upsert 外层自行处理）。
   */
  private validateEventInput(
    input: unknown,
    path: string,
    seenEventIds: Set<BusinessId> | null
  ): ScheduleResult<ScheduleEventInput> {
    if (input === null || typeof input !== "object") {
      return fail("invalid_input", "event must be an object", path);
    }
    const event = input as ScheduleEventInput;
    if (!isValidBusinessId(event.businessId)) {
      return fail("invalid_input", "event.businessId must be a non-empty string or a finite number", `${path}.businessId`);
    }
    if (seenEventIds?.has(event.businessId)) {
      return fail("duplicate_business_id", "duplicate event business id", `${path}.businessId`);
    }
    seenEventIds?.add(event.businessId);

    if (typeof event.title !== "string" || event.title.length === 0) {
      return fail("invalid_input", "event.title must be a non-empty string", `${path}.title`);
    }
    if (typeof event.startTime !== "number" || !Number.isFinite(event.startTime)) {
      return fail("invalid_input", "event.startTime must be a finite number", `${path}.startTime`);
    }
    if (typeof event.endTime !== "number" || !Number.isFinite(event.endTime)) {
      return fail("invalid_input", "event.endTime must be a finite number", `${path}.endTime`);
    }
    if (event.startTime < this.config.startTime) {
      return fail("invalid_input", "event.startTime is before the timeline start", `${path}.startTime`);
    }
    if (event.endTime <= event.startTime) {
      return fail("invalid_input", "event.endTime must be greater than startTime", `${path}.endTime`);
    }
    const maxEndTime = this.config.endTime + this.config.endPaddingTime;
    if (event.endTime > maxEndTime) {
      return fail("invalid_input", "event.endTime exceeds the timeline window", `${path}.endTime`);
    }
    if (event.description !== undefined && typeof event.description !== "string") {
      return fail("invalid_input", "event.description must be a string", `${path}.description`);
    }
    if (event.color !== undefined && typeof event.color !== "string") {
      return fail("invalid_input", "event.color must be a string", `${path}.color`);
    }
    if (event.readonly !== undefined && typeof event.readonly !== "boolean") {
      return fail("invalid_input", "event.readonly must be a boolean", `${path}.readonly`);
    }
    const customData = this.validateCustomData(event.customData, `${path}.customData`);
    if (!customData.ok) return customData;
    if (event.media !== undefined) {
      const media = this.validateMedia(event.media, `${path}.media`);
      if (!media.ok) return media;
    }

    return ok({
      businessId: event.businessId,
      startTime: event.startTime,
      endTime: event.endTime,
      title: event.title,
      ...(event.description !== undefined ? { description: event.description } : {}),
      ...(event.color !== undefined ? { color: event.color } : {}),
      ...(event.readonly !== undefined ? { readonly: event.readonly } : {}),
      ...(customData.value ? { customData: customData.value } : {}),
      ...(event.media !== undefined ? { media: event.media } : {}),
    });
  }

  private validateCustomData(
    customData: Record<string, unknown> | undefined,
    path: string
  ): ScheduleResult<Record<string, unknown> | undefined> {
    if (customData === undefined) return ok(undefined);
    if (customData === null || typeof customData !== "object" || Array.isArray(customData)) {
      return fail("invalid_input", "customData must be an object", path);
    }
    const problem = findSerializationProblem(customData, path, new WeakSet());
    if (problem) {
      return fail("invalid_input", `customData is not JSON-serializable (${problem.reason})`, problem.path);
    }
    return ok(customData as Record<string, unknown>);
  }

  private validateMedia(media: TimelineEvent["media"], path: string): ScheduleResult<TimelineEvent["media"]> {
    if (media === null || typeof media !== "object") {
      return fail("invalid_input", "media must be an object", path);
    }
    if (media.images !== undefined) {
      if (!Array.isArray(media.images)) {
        return fail("invalid_input", "media.images must be an array", `${path}.images`);
      }
      for (let index = 0; index < media.images.length; index++) {
        const image = media.images[index];
        if (!image || typeof image !== "object" || typeof image.src !== "string") {
          return fail("invalid_input", "media.images entries need a src string", `${path}.images[${index}].src`);
        }
      }
    }
    if (media.waveform !== undefined) {
      const data = media.waveform.data;
      if (!(data instanceof Float32Array) && !Array.isArray(data)) {
        return fail("invalid_input", "media.waveform.data must be Float32Array or number[]", `${path}.waveform.data`);
      }
      for (let index = 0; index < data.length; index++) {
        if (!Number.isFinite(data[index])) {
          return fail("invalid_input", "media.waveform.data must contain finite numbers", `${path}.waveform.data[${index}]`);
        }
      }
    }
    // 整个 media 对象必须可安全克隆：拒绝环、函数、非 plain 对象附加字段
    // （Float32Array 作为波形叶子放行；有限性已在上面校验）
    const problem = findSerializationProblem(media, path, new WeakSet(), true);
    if (problem) {
      return fail("invalid_input", `media is not serializable (${problem.reason})`, problem.path);
    }
    return ok(media);
  }

  private createRuntimeEvent(event: ScheduleEventInput, eventIndex: number): TimelineEvent {
    const duration = fixFloatPrecision(event.endTime - event.startTime);
    return {
      id: eventIndex,
      startTime: event.startTime,
      endTime: fixFloatPrecision(event.startTime + duration),
      duration,
      title: event.title,
      description: event.description ?? "",
      color: event.color ?? this.defaultColor(eventIndex),
      ...(event.businessId !== undefined ? { businessId: event.businessId } : {}),
      ...(event.readonly ? { readonly: event.readonly } : {}),
      ...(event.customData ? { customData: cloneCustomData(event.customData) } : {}),
      ...(event.media ? { media: cloneValueIsolated(event.media) as TimelineEvent["media"] } : {}),
    };
  }

  private defaultColor(eventIndex: number): string {
    return this.config.colors.eventColors[eventIndex % this.config.colors.eventColors.length];
  }

  private exportEvent(event: TimelineEvent, trackIndex: number, eventIndex: number): ScheduleResult<ScheduleEventInput> {
    if (event.businessId === undefined) {
      return fail("missing_business_id", `event at index ${eventIndex} has no business id`, `tracks[${trackIndex}].events[${eventIndex}]`);
    }
    const customData = this.validateCustomData(event.customData, `tracks[${trackIndex}].events[${eventIndex}].customData`);
    if (!customData.ok) return customData;

    let media: TimelineEvent["media"];
    if (event.media) {
      // legacy 路径（loadData/updateEvent）按引用存入 media、不经验证：
      // 导出侧必须先做序列化检查，环引用返回 typed error 而不是在 toJsonSafe 中炸栈，
      // 非 plain 对象/其他 TypedArray 也在此拒绝，避免按引用穿透破坏导出隔离
      const eventPath = `tracks[${trackIndex}].events[${eventIndex}]`;
      const problem = findSerializationProblem(event.media, `${eventPath}.media`, new WeakSet(), true);
      if (problem) {
        return fail("invalid_input", `media is not serializable (${problem.reason})`, problem.path);
      }
      // 导出 JSON 安全且与内存隔离：media 树内任意位置的 Float32Array 叶子统一转 number[]
      media = toJsonSafe(event.media) as TimelineEvent["media"];
    }

    return ok({
      businessId: event.businessId,
      startTime: event.startTime,
      endTime: event.endTime,
      title: event.title,
      ...(event.description ? { description: event.description } : {}),
      // 颜色等于调色板默认值时不导出：重新加载会推导出同一颜色，语义保持不变
      ...(event.color !== this.defaultColor(eventIndex) ? { color: event.color } : {}),
      ...(event.readonly ? { readonly: event.readonly } : {}),
      // 与轨道 customData 同理：导出深拷贝，保持“导出与内存隔离”的文档合同
      ...(customData.value ? { customData: cloneCustomData(customData.value) } : {}),
      ...(media ? { media } : {}),
    });
  }
}

function findSerializationProblem(
  value: unknown,
  path: string,
  seen: WeakSet<object>,
  allowTypedArrayLeaves = false
): { path: string; reason: string } | null {
  if (value === null) return null;
  const type = typeof value;
  if (type === "string" || type === "boolean") return null;
  if (type === "number") {
    return Number.isFinite(value as number) ? null : { path, reason: "non-finite number" };
  }
  if (type === "function" || type === "symbol" || type === "bigint" || type === "undefined") {
    return { path, reason: `unsupported value type "${type}"` };
  }
  const obj = value as object;
  // media 路径放行 Float32Array 叶子（波形数据）。
  // 元素有限性在此统一校验：strict 导入路径此前已单独校验（报错更具体），
  // 但 legacy 路径的缓冲按引用直通、只在导出时经过这里——
  // 含 NaN/Infinity 的缓冲若放行，导出的 number[] 会 JSON 序列化为 null，破坏往返
  if (allowTypedArrayLeaves && obj instanceof Float32Array) {
    if (!Number.isFinite(obj.length)) {
      return { path, reason: "invalid typed array" };
    }
    for (let index = 0; index < obj.length; index++) {
      if (!Number.isFinite(obj[index])) {
        return { path: `${path}[${index}]`, reason: "non-finite number in typed array" };
      }
    }
    return null;
  }
  // seen 充当路径栈：递归返回后回缩，非循环的共享子引用（DAG）不会误报为环
  if (seen.has(obj)) {
    return { path, reason: "circular reference" };
  }
  seen.add(obj);
  if (Array.isArray(obj)) {
    for (let index = 0; index < obj.length; index++) {
      const problem = findSerializationProblem(obj[index], `${path}[${index}]`, seen, allowTypedArrayLeaves);
      if (problem) return problem;
    }
    seen.delete(obj);
    return null;
  }
  if (Object.getPrototypeOf(obj) !== Object.prototype && Object.getPrototypeOf(obj) !== null) {
    return { path, reason: "non plain object" };
  }
  for (const [key, entry] of Object.entries(obj)) {
    const problem = findSerializationProblem(entry, `${path}.${key}`, seen, allowTypedArrayLeaves);
    if (problem) return problem;
  }
  seen.delete(obj);
  return null;
}

