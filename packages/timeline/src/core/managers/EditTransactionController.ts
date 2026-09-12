import type {
  BusinessId,
  ScheduleChange,
  ScheduleCommitResult,
  ScheduleCommitStateData,
  ScheduleEditSnapshot,
  ScheduleEditState,
  ScheduleEditingOptions,
  SchedulePlacement,
  ScheduleValidationResult,
  TimelineEvent,
  TimelineState,
} from "../../types";
import { cloneEvent } from "../../utils";
import type { BusinessIdentityIndex } from "./BusinessIdentityIndex";

/** 宿主定时器可表示的最大毫秒数；commitTimeoutMs 超出视为配置错误 */
const MAX_TIMEOUT_MS = 2147483647;

interface EditTransaction {
  operationId: string;
  eventBusinessId: BusinessId;
  action: "move" | "resize";
  resizeEdge?: "left" | "right";
  before: ScheduleEditSnapshot;
  beforeTrackIndex: number;
  beforeEventIndex: number;
  draft: SchedulePlacement;
  /** 最后一次候选评估是否有效；无效落点在提交时按 validation_failed 丢弃 */
  lastCandidateValid: boolean;
  state: "preview" | "pending" | "reconciliation_required";
  /** 待核对原因码（timeout/transport_error/invalid_response/reconciliation_required） */
  reasonCode?: string;
  abort: AbortController;
}

export type EditBeginResult =
  | { ok: true }
  | { ok: false; code: "busy" | "missing_business_id" | "inactive"; reason: string };

export type EditFinalizeResult =
  | { ok: true; change: ScheduleChange }
  | { ok: false; code: string; reason: string };

/**
 * M2 编辑协议事务控制器：
 * 管理候选草稿投影（state.editDrafts）、before/after 快照与 operationId；
 * 提交端 Promise 的超时/结算/epoch 在 W3 由 ScheduleCommitCoordinator 承接。
 */
export class EditTransactionController {
  private static instanceCounter = 0;

  private readonly state: TimelineState;
  private readonly businessIdentityIndex: BusinessIdentityIndex;
  private readonly notify: (data: ScheduleCommitStateData) => void;
  private options: ScheduleEditingOptions | null = null;
  private readonly transactions = new Map<BusinessId, EditTransaction>();
  /** 由 ScheduleCommitCoordinator 接线：提交结果（null=未知） */
  public commitSink: ((result: ScheduleCommitResult | null, change: ScheduleChange) => void) | null = null;
  private operationSeq = 0;
  private readonly instanceSeq = ++EditTransactionController.instanceCounter;

  constructor(
    state: TimelineState,
    businessIdentityIndex: BusinessIdentityIndex,
    notify: (data: ScheduleCommitStateData) => void,
  ) {
    this.state = state;
    this.businessIdentityIndex = businessIdentityIndex;
    this.notify = notify;
  }

  /** 构造期校验：非法配置必须在监听/观察器注册前抛出明确配置错误 */
  public static validateOptions(options: ScheduleEditingOptions | undefined): void {
    if (options === undefined) return;
    if (options === null || typeof options !== "object") {
      throw new Error("scheduleEditing must be an object when provided");
    }
    if (typeof options.onBeforeCommit !== "function") {
      throw new Error("scheduleEditing.onBeforeCommit is required when scheduleEditing is configured");
    }
    if (options.validate !== undefined && typeof options.validate !== "function") {
      throw new Error("scheduleEditing.validate must be a function when provided");
    }
    if (options.commitTimeoutMs !== undefined) {
      const timeout = options.commitTimeoutMs;
      if (typeof timeout !== "number" || !Number.isFinite(timeout) || timeout <= 0 || timeout > MAX_TIMEOUT_MS) {
        throw new Error(
          `scheduleEditing.commitTimeoutMs must be a finite positive number <= ${MAX_TIMEOUT_MS}`,
        );
      }
    }
  }

  public configure(options: ScheduleEditingOptions): void {
    EditTransactionController.validateOptions(options);
    this.options = options;
  }

  /** 未配置协议时所有编辑入口保持 legacy 同步语义 */
  public get active(): boolean {
    return this.options !== null;
  }

  /** 该事件是否存在进行中的事务（preview/pending） */
  public hasActiveTransaction(businessId: BusinessId): boolean {
    return this.transactions.has(businessId);
  }

  /**
   * 动作开始（拖动/拉伸越阈值）时捕获 before 快照并登记预览事务。
   * 零快照失败安全：cloneEvent 不会抛错，但业务身份缺失/忙返回 typed 结果。
   */
  public tryBegin(params: {
    event: TimelineEvent;
    trackIndex: number;
    eventIndex: number;
    action: "move" | "resize";
    resizeEdge?: "left" | "right";
  }): EditBeginResult {
    if (!this.active) {
      return { ok: false, code: "inactive", reason: "schedule editing is not configured" };
    }
    const { event, trackIndex, eventIndex, action, resizeEdge } = params;
    if (event.businessId === undefined) {
      return { ok: false, code: "missing_business_id", reason: "event has no business id" };
    }
    if (this.transactions.has(event.businessId)) {
      return { ok: false, code: "busy", reason: "event is locked by an in-flight edit operation" };
    }
    const location = this.businessIdentityIndex.getEventLocation(event.businessId);
    const resourceBusinessId = location
      ? this.state.tracks[location.trackIndex]?.businessId
      : undefined;
    if (resourceBusinessId === undefined) {
      return { ok: false, code: "missing_business_id", reason: "resource has no business id" };
    }

    const before: ScheduleEditSnapshot = {
      resourceBusinessId,
      event: cloneEvent(event),
    };
    const transaction: EditTransaction = {
      operationId: `${this.instanceSeq}-${++this.operationSeq}`,
      eventBusinessId: event.businessId,
      action,
      ...(resizeEdge !== undefined ? { resizeEdge } : {}),
      before,
      beforeTrackIndex: trackIndex,
      beforeEventIndex: eventIndex,
      draft: {
        resourceBusinessId,
        startTime: event.startTime,
        endTime: event.endTime,
      },
      lastCandidateValid: true,
      state: "preview",
      abort: new AbortController(),
    };
    this.transactions.set(event.businessId, transaction);
    this.syncDraftProjection(transaction);
    return { ok: true };
  }

  /** 更新候选位置；仅 preview 可更新，pending 期间事实与候选都冻结 */
  public updateDraft(businessId: BusinessId, placement: SchedulePlacement, targetTrackIndex: number): void {
    const transaction = this.transactions.get(businessId);
    if (!transaction || transaction.state !== "preview") return;
    transaction.draft = placement;
    transaction.lastCandidateValid = true;
    const draft = this.state.editDrafts.get(businessId);
    if (draft) {
      draft.targetTrackIndex = targetTrackIndex;
      draft.startTime = placement.startTime;
      draft.endTime = placement.endTime;
    }
  }

  /** 当前事务（若只要求未终态） */
  public getTransaction(businessId: BusinessId): EditTransaction | undefined {
    return this.transactions.get(businessId);
  }

  /** 用最终候选构建 ScheduleChange（after 为独立快照） */
  public buildChange(businessId: BusinessId): ScheduleChange | null {
    const transaction = this.transactions.get(businessId);
    if (!transaction) return null;
    const sourceTrack = this.state.tracks[transaction.beforeTrackIndex];
    const liveEvent = sourceTrack?.events[transaction.beforeEventIndex];
    const after: ScheduleEditSnapshot = {
      resourceBusinessId: transaction.draft.resourceBusinessId,
      event: {
        ...cloneEvent(liveEvent ?? (transaction.before.event as TimelineEvent)),
        id: (transaction.before.event as TimelineEvent).id,
        startTime: transaction.draft.startTime,
        endTime: transaction.draft.endTime,
        duration: transaction.draft.endTime - transaction.draft.startTime,
      },
    };
    const change: ScheduleChange = {
      operationId: transaction.operationId,
      eventBusinessId: transaction.eventBusinessId,
      action: transaction.action,
      ...(transaction.resizeEdge !== undefined ? { resizeEdge: transaction.resizeEdge } : {}),
      before: transaction.before,
      after,
    };
    return change;
  }

  /** 记录最后一次候选评估无效：提交时丢弃编辑而不是隐式提交上一个有效位置 */
  public markCandidateInvalid(businessId: BusinessId): void {
    const transaction = this.transactions.get(businessId);
    if (transaction) {
      transaction.lastCandidateValid = false;
    }
  }

  /** 同步业务校验：Promise/抛错/非法结构一律 validation_error */
  public runBusinessValidate(change: ScheduleChange): ScheduleValidationResult {
    const validate = this.options?.validate;
    if (!validate) return { allowed: true };
    let result: ScheduleValidationResult | Promise<ScheduleValidationResult>;
    try {
      result = validate(change);
    } catch {
      return { allowed: false, code: "validation_error", reason: "business validator threw an exception" };
    }
    if (result instanceof Promise) {
      return { allowed: false, code: "validation_error", reason: "business validator must be synchronous" };
    }
    if (!result || typeof result !== "object") {
      return { allowed: false, code: "validation_error", reason: "business validator returned an invalid structure" };
    }
    if (result.allowed === true) return { allowed: true };
    if (result.allowed === false && typeof result.code === "string" && typeof result.reason === "string") {
      return result;
    }
    return { allowed: false, code: "validation_error", reason: "business validator returned an invalid structure" };
  }

  /**
   * 提交入口：标记 pending、通知 pending、调用一次 onBeforeCommit。
   * 结算（accept/reject/unknown 发布）在 W3 ScheduleCommitCoordinator 实现；
   * W2 仅保证单次调用与 busy 互斥。
   */
  public beginCommit(businessId: BusinessId, change: ScheduleChange): boolean {
    const transaction = this.transactions.get(businessId);
    if (!transaction || transaction.state !== "preview") return false;
    transaction.state = "pending";
    // 草稿投影同步进入保存中：渲染器据此把候选虚线切换为保存角标
    const draft = this.state.editDrafts.get(businessId);
    if (draft) draft.commitState = "pending";
    this.notify({
      state: "pending",
      operationId: transaction.operationId,
      eventBusinessId: businessId,
      action: transaction.action,
      before: transaction.before,
      after: change.after,
    });
    // 同步抛错保守视为结果未知（外部函数可能先触发副作用再 throw）
    const hook = this.options?.onBeforeCommit;
    if (!hook) return false;
    let promise: Promise<ScheduleCommitResult>;
    try {
      promise = Promise.resolve(
        hook.call(this.options as ScheduleEditingOptions, change, {
          signal: transaction.abort.signal,
        }),
      );
    } catch {
      this.commitSink?.(null, change);
      return true;
    }
    void promise
      .then((result) => {
        this.commitSink?.(result, change);
      })
      .catch(() => {
        this.commitSink?.(null, change);
      });
    return true;
  }

  /** 同步业务校验拒绝/落点无效：丢弃候选并恢复（无请求发出） */
  public cancelPreview(businessId: BusinessId, reason: string, code: string, state: "cancelled" | "validation_failed"): void {
    const transaction = this.transactions.get(businessId);
    if (!transaction || transaction.state !== "preview") return;
    this.transactions.delete(businessId);
    this.state.editDrafts.delete(businessId);
    this.notify({
      state,
      operationId: transaction.operationId,
      eventBusinessId: businessId,
      action: transaction.action,
      before: transaction.before,
      reason,
      reasonCode: code,
    });
  }

  /**
   * 仅取消 preview 事务（pointercancel、只读切换）。
   * pending/reconciliation_required 代表"保存可能已到达服务器"，
   * 只能经明确拒绝结算、权威恢复（reconcile/整批 load）或 destroy 解除。
   */
  public cancelAll(reason: string): void {
    for (const transaction of Array.from(this.transactions.values())) {
      if (transaction.state !== "preview") continue;
      this.transactions.delete(transaction.eventBusinessId);
      this.state.editDrafts.delete(transaction.eventBusinessId);
      this.notify({
        state: "cancelled",
        operationId: transaction.operationId,
        eventBusinessId: transaction.eventBusinessId,
        action: transaction.action,
        before: transaction.before,
        reason,
      });
    }
  }

  /** 整批权威数据替换：作废全部预览与待定事务；在途操作 id 交协调器停表并标记 settled */
  public handleDatasetReplaced(): string[] {
    const invalidatedOperations: string[] = [];
    for (const transaction of Array.from(this.transactions.values())) {
      transaction.abort.abort();
      invalidatedOperations.push(transaction.operationId);
      this.transactions.delete(transaction.eventBusinessId);
      this.state.editDrafts.delete(transaction.eventBusinessId);
      this.notify({
        state: "invalidated",
        operationId: transaction.operationId,
        eventBusinessId: transaction.eventBusinessId,
        action: transaction.action,
        before: transaction.before,
        reason: "dataset replaced by authoritative load",
      });
    }
    return invalidatedOperations;
  }

  /** 提交结果未知：保留 before/候选预约与同任务锁，停止 pending，等待权威恢复 */
  public enterReconciliation(businessId: BusinessId, reason: string, reasonCode: string): void {
    const transaction = this.transactions.get(businessId);
    if (!transaction || transaction.state !== "pending") return;
    transaction.state = "reconciliation_required";
    transaction.reasonCode = reasonCode;
    const draft = this.state.editDrafts.get(businessId);
    if (draft) draft.commitState = "reconciliation_required";
    transaction.abort.abort();
    const afterEvent = cloneEvent(transaction.before.event);
    afterEvent.startTime = transaction.draft.startTime;
    afterEvent.endTime = transaction.draft.endTime;
    afterEvent.duration = transaction.draft.endTime - transaction.draft.startTime;
    this.notify({
      state: "reconciliation_required",
      operationId: transaction.operationId,
      eventBusinessId: businessId,
      action: transaction.action,
      before: transaction.before,
      after: {
        resourceBusinessId: transaction.draft.resourceBusinessId,
        event: afterEvent,
      },
      reason,
      reasonCode,
    });
  }

  /** 接受结算：释放事务/草稿/预约；发布由调用方在释放前完成 */
  public releaseForAccept(businessId: BusinessId): void {
    const transaction = this.transactions.get(businessId);
    if (!transaction) return;
    transaction.abort.abort();
    this.transactions.delete(businessId);
    this.state.editDrafts.delete(businessId);
  }

  public hasTransaction(businessId: BusinessId): boolean {
    return this.transactions.has(businessId);
  }

  /** 全部事务的 before/候选预约区间（排除指定事务自身） */
  public getReservations(
    excludeBusinessId?: BusinessId,
  ): Array<{ resourceBusinessId: BusinessId; startTime: number; endTime: number }> {
    const reservations: Array<{ resourceBusinessId: BusinessId; startTime: number; endTime: number }> = [];
    for (const transaction of this.transactions.values()) {
      if (excludeBusinessId !== undefined && transaction.eventBusinessId === excludeBusinessId) {
        continue;
      }
      reservations.push({
        resourceBusinessId: transaction.before.resourceBusinessId,
        startTime: transaction.before.event.startTime,
        endTime: transaction.before.event.endTime,
      });
      reservations.push({
        resourceBusinessId: transaction.draft.resourceBusinessId,
        startTime: transaction.draft.startTime,
        endTime: transaction.draft.endTime,
      });
    }
    return reservations;
  }

  /** 实例销毁：清空全部事务与计时引用，不发任何通知（销毁后回调被抑制） */
  public destroyAll(): void {
    for (const transaction of this.transactions.values()) {
      transaction.abort.abort();
      this.state.editDrafts.delete(transaction.eventBusinessId);
    }
    this.transactions.clear();
  }

  /** 权威恢复入口使用：作废指定事务并清理草稿（不发成功类通知） */
  public invalidateTransaction(businessId: BusinessId, reason: string): void {
    const transaction = this.transactions.get(businessId);
    if (!transaction) return;
    transaction.abort.abort();
    this.transactions.delete(businessId);
    this.state.editDrafts.delete(businessId);
    if (transaction.state === "pending") {
      this.notify({
        state: "invalidated",
        operationId: transaction.operationId,
        eventBusinessId: businessId,
        action: transaction.action,
        before: transaction.before,
        reason,
      });
    }
  }

  /** 提交端明确拒绝：移除候选与锁定，事实未变，不发旧成功回调 */
  public rejectPending(businessId: BusinessId, reason: string, code?: string): void {
    const transaction = this.transactions.get(businessId);
    if (!transaction || transaction.state !== "pending") return;
    transaction.abort.abort();
    this.transactions.delete(businessId);
    this.state.editDrafts.delete(businessId);
    this.notify({
      state: "rejected",
      operationId: transaction.operationId,
      eventBusinessId: businessId,
      action: transaction.action,
      before: transaction.before,
      reason,
      ...(code !== undefined ? { reasonCode: code } : {}),
    });
  }

  /** 事件编辑状态查询；事件不存在返回 null */
  public getEditState(businessId: BusinessId): ScheduleEditState | null {
    const transaction = this.transactions.get(businessId);
    if (!transaction) {
      return { state: "idle" };
    }
    if (transaction.state === "preview") {
      return {
        state: "preview",
        operationId: transaction.operationId,
        action: transaction.action,
        placement: { ...transaction.draft },
      };
    }
    if (transaction.state === "reconciliation_required") {
      return {
        state: "reconciliation_required",
        operationId: transaction.operationId,
        action: transaction.action,
        placement: { ...transaction.draft },
        reasonCode: transaction.reasonCode,
      };
    }
    return {
      state: "pending",
      operationId: transaction.operationId,
      action: transaction.action,
      placement: { ...transaction.draft },
    };
  }

  /** 草稿投影与事务表保持一致（预览期间渲染器读取 state.editDrafts） */
  private syncDraftProjection(transaction: EditTransaction): void {
    const location = this.businessIdentityIndex.getEventLocation(transaction.eventBusinessId);
    this.state.editDrafts.set(transaction.eventBusinessId, {
      operationId: transaction.operationId,
      eventBusinessId: transaction.eventBusinessId,
      sourceTrackIndex: location?.trackIndex ?? transaction.beforeTrackIndex,
      targetTrackIndex: location?.trackIndex ?? transaction.beforeTrackIndex,
      startTime: transaction.draft.startTime,
      endTime: transaction.draft.endTime,
      action: transaction.action,
      ...(transaction.resizeEdge !== undefined ? { resizeEdge: transaction.resizeEdge } : {}),
      commitState: "preview",
    });
  }
}
