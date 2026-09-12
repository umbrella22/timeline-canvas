/**
 * G10 契约 fixture（C-11/12/13 M2 编辑协议类型，W2 增量加入）：
 *
 * 正例：scheduleEditing 配置、ScheduleChange/ScheduleValidationResult/ScheduleCommitResult
 * 的合法形状必须可以免强转编译。运行时行为由 tests/schedule-*.spec.ts 覆盖。
 */
import type {
  BusinessId,
  ScheduleChange,
  ScheduleCommitResult,
  ScheduleCommitStateData,
  ScheduleEditingOptions,
  ScheduleEditState,
  SchedulePlacement,
  ScheduleValidationResult,
  TimelineOptions,
} from "../../src";

export function buildEditingOptions(
  onBeforeCommit: ScheduleEditingOptions["onBeforeCommit"],
): TimelineOptions {
  const options: TimelineOptions = {
    scheduleEditing: {
      onBeforeCommit,
      commitTimeoutMs: 30000,
      validate: (change) => {
        if (change.action === "move" && change.after.resourceBusinessId === "A3") {
          return { allowed: true };
        }
        return { allowed: false, code: "equipment_closed", reason: "产线已收班" };
      },
    },
    onScheduleCommitStateChange: (data: ScheduleCommitStateData) => {
      void data.operationId;
      void data.eventBusinessId;
      void data.action;
      void data.before;
    },
  };
  return options;
}

export function describeChange(change: Readonly<ScheduleChange>): string {
  const placement: SchedulePlacement = {
    resourceBusinessId: change.after.resourceBusinessId,
    startTime: change.after.event.startTime,
    endTime: change.after.event.endTime,
  };
  if (change.action === "resize") {
    const edge: "left" | "right" | undefined = change.resizeEdge;
    return `${change.operationId} resize ${edge ?? "?"} -> ${placement.resourceBusinessId}`;
  }
  return `${change.operationId} move -> ${placement.resourceBusinessId}`;
}

export function foldValidation(result: ScheduleValidationResult): string {
  return result.allowed ? "ok" : `${result.code}:${result.reason}`;
}

export function foldCommitResult(result: ScheduleCommitResult): string {
  if (result.accepted) {
    return result.placement
      ? `accepted@${result.placement.resourceBusinessId}`
      : "accepted";
  }
  return `rejected:${result.reason}`;
}

export function describeEditState(id: BusinessId, state: ScheduleEditState | null): string {
  if (state === null) return `${id}:missing`;
  if (state.state === "idle") return `${id}:idle`;
  return `${id}:${state.state}:${state.operationId ?? "-"}`;
}

export async function commitThrough(
  options: ScheduleEditingOptions,
  change: ScheduleChange,
  signal: AbortSignal,
): Promise<ScheduleCommitResult> {
  return options.onBeforeCommit(change, { signal });
}
