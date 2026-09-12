/**
 * G10 契约 fixture（M2 编辑协议负例守卫）：
 *
 * 错误形状必须始终被编译器拒绝。若有人放宽公共类型导致以下 @ts-expect-error
 * 变为 unused，契约编译即失败。
 */
import type {
  ScheduleChange,
  ScheduleCommitResult,
  ScheduleCommitStateData,
  ScheduleEditingOptions,
  ScheduleValidationResult,
} from "../../src";

// 负例 1：scheduleEditing 缺少 onBeforeCommit 必须无法通过类型检查
export const missingCommit: ScheduleEditingOptions = {
  validate: () => ({ allowed: true }),
  // @ts-expect-error onBeforeCommit is required when scheduleEditing is configured
  onBeforeCommit: undefined,
};

// 负例 2：validate 返回 Promise 不是合法的同步校验结果
export function asyncValidator(): ScheduleEditingOptions {
  return {
    onBeforeCommit: () => Promise.resolve({ accepted: true }),
    // @ts-expect-error validate must be synchronous
    validate: () => Promise.resolve({ allowed: true }),
  };
}

// 负例 3：拒绝结果缺少 code/reason 字符串
export function invalidRejection(): ScheduleValidationResult {
  // @ts-expect-error rejection requires string code and reason
  return { allowed: false, code: 42, reason: null };
}

// 负例 4：action 只能是 move | resize 字面量
export function badAction(change: ScheduleChange): string {
  // @ts-expect-error action is a union of literal strings
  change.action = "teleport";
  return change.action;
}

// 负例 5：accepted 结果的 placement 缺少资源身份
export function badPlacement(): ScheduleCommitResult {
  // @ts-expect-error placement.resourceBusinessId is required
  return { accepted: true, placement: { startTime: 1, endTime: 2 } };
}

// 负例 6：非法的提交状态种类
export function badStateName(data: ScheduleCommitStateData): string {
  // @ts-expect-error unknown commit state kind
  data.state = "maybe";
  return data.state;
}
