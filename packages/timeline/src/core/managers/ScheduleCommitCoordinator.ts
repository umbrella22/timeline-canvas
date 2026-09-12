import type {
  BusinessId,
  ScheduleChange,
  ScheduleCommitResult,
  ScheduleCommitStateData,
  SchedulePlacement,
  TimelineEvent,
} from "../../types";
import type { EditTransactionController } from "./EditTransactionController";

export interface AcceptedPublishResult {
  ok: boolean;
  code?: string;
  reason?: string;
  event?: TimelineEvent;
  /** 发布后的新位置（供旧回调使用） */
  toTrackIndex?: number;
  toEventIndex?: number;
  /** 发布前的原位置 */
  fromTrackIndex?: number;
  fromEventIndex?: number;
}

export interface CommitCoordinatorDeps {
  /** 状态通知（路由到 onScheduleCommitStateChange） */
  notify: (data: ScheduleCommitStateData) => void;
  /** 实例存活检查（destroyed 后一切晚到结果作废） */
  isAlive: () => boolean;
  /** 数据集代数：loadData/loadScheduleData 整批替换成功时自增（accepted 通知重入检测） */
  getDatasetEpoch: () => number;
  /** 结算（接受/拒绝/未知）完成后触发一次渲染刷新 */
  notifySettled: () => void;
  /** 接受结果的原子发布；失败返回 typed 原因（进入待核对，不冒充 rejected） */
  publishAccepted: (
    businessId: BusinessId,
    change: ScheduleChange,
    placement: SchedulePlacement,
  ) => AcceptedPublishResult;
  /** 旧成功回调：确认后且内部状态稳定后发送一次 */
  fireLegacySuccess: (
    change: ScheduleChange,
    finalPlacement: SchedulePlacement,
    event: TimelineEvent,
    locations: { fromTrackIndex: number; fromEventIndex: number; toTrackIndex: number; toEventIndex: number },
  ) => void;
  /** 提交等待上限 */
  getTimeoutMs: () => number;
}

/**
 * M3 提交结算协调器（M2 W3）：
 * 负责提交结果分类（接受/明确拒绝/未知）、timeout timer、至多一次结算。
 * 未知结果（超时/网络异常/hook 抛错/非法结果/无法应用的 accepted）一律进入
 * reconciliation_required，不冒充 rejected，不自动重试，不写回晚到响应。
 */
export class ScheduleCommitCoordinator {
  private readonly deps: CommitCoordinatorDeps;
  private controller: EditTransactionController | null = null;
  /** 已结算（或已进入待核对）的 operationId：至多一次结算 */
  private readonly settled = new Set<string>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(deps: CommitCoordinatorDeps) {
    this.deps = deps;
  }

  /** 解决 Timeline 构造顺序：controller 先建，随后互相接线 */
  public attachController(controller: EditTransactionController): void {
    this.controller = controller;
  }

  /** 提交发起后启动等待计时；超时按未知结果处理并解除视觉 pending */
  public beginTiming(change: ScheduleChange): void {
    const timeoutMs = this.deps.getTimeoutMs();
    const timer = setTimeout(() => {
      this.timers.delete(change.operationId);
      this.handleUnknown(change, "timeout", "commit timed out waiting for the server result");
    }, timeoutMs);
    this.timers.set(change.operationId, timer);
  }

  /** 提交端 Promise 结算入口；result 为 null 表示 hook 抛错/拒绝等未知结果 */
  public handleResult(change: ScheduleChange, result: ScheduleCommitResult | null): void {
    if (!this.deps.isAlive()) return;
    if (this.settled.has(change.operationId)) return;
    const transaction = this.controller?.getTransaction(change.eventBusinessId);
    // operationId 必须仍匹配当前事务：load 作废/重发后的晚到结果一律不写回。
    // 额外要求 pending：preview 从不产生结果；reconciliation_required 不允许再结算——
    // 即使 settled 集合按上限清理逐出了旧 operationId，待核对事务也不会被晚到 accepted 覆盖
    if (!transaction || transaction.operationId !== change.operationId) return;
    if (transaction.state !== "pending") return;

    if (result === null) {
      this.handleUnknown(change, "transport_error", "commit hook threw or rejected without a verdict");
      return;
    }
    if (!ScheduleCommitCoordinator.isValidResult(result)) {
      this.handleUnknown(change, "invalid_response", "commit hook returned an invalid result structure");
      return;
    }
    if (result.accepted) {
      this.settleAccepted(change, result);
      return;
    }
    this.settleRejected(change, result.reason, result.code);
  }

  /** 明确拒绝：移除候选与锁定，事实未变，不发旧成功回调 */
  private settleRejected(
    change: ScheduleChange,
    reason: string,
    code?: string,
  ): void {
    this.markSettled(change.operationId);
    this.stopTimer(change.operationId);
    this.controller?.rejectPending(change.eventBusinessId, reason, code);
    this.deps.notifySettled();
  }

  /** 接受：校验最终 placement → 原子发布 → 释放 → 通知 → 旧成功回调一次 */
  private settleAccepted(
    change: ScheduleChange,
    result: Extract<ScheduleCommitResult, { accepted: true }>,
  ): void {
    // notify 是宿主回调：accepted 分支内 destroy/整批 load 会使本次发布事实过期，
    // 进入即捕获存活与数据集代数，回调返回后复核，绝不发送指向旧数据集的旧成功回调
    const aliveAtAccept = this.deps.isAlive();
    const datasetEpochAtAccept = this.deps.getDatasetEpoch();
    const fallback: SchedulePlacement = {
      resourceBusinessId: change.after.resourceBusinessId,
      startTime: change.after.event.startTime,
      endTime: change.after.event.endTime,
    };
    const placement = result.placement ?? fallback;
    const publish = this.deps.publishAccepted(change.eventBusinessId, change, placement);
    if (!publish.ok) {
      // 服务器已接受但本地无法应用：进入待核对，不冒充 rejected
      this.handleUnknown(
        change,
        publish.code ?? "reconciliation_required",
        publish.reason ?? "accepted result cannot be applied locally",
      );
      return;
    }
    this.markSettled(change.operationId);
    this.stopTimer(change.operationId);
    this.controller?.releaseForAccept(change.eventBusinessId);
    this.deps.notifySettled();
    const finalSnapshot = {
      resourceBusinessId: placement.resourceBusinessId,
      event: publish.event as TimelineEvent,
    };
    this.deps.notify({
      state: "accepted",
      operationId: change.operationId,
      eventBusinessId: change.eventBusinessId,
      action: change.action,
      before: change.before,
      after: finalSnapshot,
    });
    // 旧成功回调仅在确认、实例存活与数据集代数都未变化后发送一次
    if (!aliveAtAccept || !this.deps.isAlive() || this.deps.getDatasetEpoch() !== datasetEpochAtAccept) {
      return;
    }
    this.deps.fireLegacySuccess(change, placement, publish.event as TimelineEvent, {
      fromTrackIndex: publish.fromTrackIndex ?? 0,
      fromEventIndex: publish.fromEventIndex ?? 0,
      toTrackIndex: publish.toTrackIndex ?? 0,
      toEventIndex: publish.toEventIndex ?? 0,
    });
  }

  /** 未知结果：停止计时，保留 before/候选预约与同任务锁，等待权威恢复 */
  private handleUnknown(change: ScheduleChange, reasonCode: string, reason: string): void {
    if (this.settled.has(change.operationId)) return;
    // 定时器路径与 handleResult 同样校验归属：旧 timer 不得击中同事件的新事务
    const transaction = this.controller?.getTransaction(change.eventBusinessId);
    if (!transaction || transaction.operationId !== change.operationId) return;
    if (transaction.state !== "pending") return;
    this.markSettled(change.operationId);
    this.stopTimer(change.operationId);
    this.controller?.enterReconciliation(change.eventBusinessId, reason, reasonCode);
    this.deps.notifySettled();
  }

  /** 数据集整批替换：作废在途操作（停 timer + 标记 settled），晚到结果永不写回 */
  public invalidateOperations(operationIds: string[]): void {
    for (const operationId of operationIds) {
      const timer = this.timers.get(operationId);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(operationId);
      }
      this.settled.add(operationId);
    }
  }

  /** 销毁：取消全部计时器；销毁后 resolve 不写状态、不通知 */
  public destroy(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.settled.clear();
    this.controller = null;
  }

  private markSettled(operationId: string): void {
    this.settled.add(operationId);
    // 防线性泄漏：长期高频实例按插入序清理最旧的一半（晚到结果窗口仍然足够大）
    if (this.settled.size > 1000) {
      let removed = 0;
      for (const operationId of this.settled) {
        this.settled.delete(operationId);
        if (++removed >= 500) break;
      }
    }
  }

  private stopTimer(operationId: string): void {
    const timer = this.timers.get(operationId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(operationId);
    }
  }

  private static isValidResult(result: ScheduleCommitResult): boolean {
    if (typeof result !== "object" || result === null) return false;
    if (typeof result.accepted !== "boolean") return false;
    if (result.accepted) {
      if (result.placement !== undefined) {
        const placement = result.placement;
        if (typeof placement !== "object" || placement === null) return false;
        if (
          placement.resourceBusinessId === undefined ||
          typeof placement.startTime !== "number" ||
          typeof placement.endTime !== "number"
        ) {
          return false;
        }
      }
      return true;
    }
    if (typeof result.reason !== "string") return false;
    // 非字符串 code 会在通知中破坏 typed reasonCode 字段
    return result.code === undefined || typeof result.code === "string";
  }
}
