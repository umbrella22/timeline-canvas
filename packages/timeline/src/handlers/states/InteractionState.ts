import type { TimelineInteractionAPI } from "../TimelineInteractionAPI";

/**
 * 鼠标事件的上下文信息
 */
export interface MouseEventContext {
  /** Canvas 相对坐标 X */
  canvasX: number;
  /** Canvas 相对坐标 Y */
  canvasY: number;
  /** 考虑滚动后的逻辑坐标 X */
  logicalX: number;
  /** 考虑滚动后的逻辑坐标 Y */
  logicalY: number;
  /** 原始鼠标事件 */
  originalEvent: MouseEvent;
  /** Canvas 逻辑宽度 */
  canvasWidth: number;
  /** Canvas 逻辑高度 */
  canvasHeight: number;
}

/**
 * 交互状态接口
 * 所有具体的交互状态类都需要实现此接口
 */
export interface InteractionState {
  /** 状态名称,用于调试 */
  readonly name: string;

  /**
   * 进入状态时的钩子
   * @param fromState 从哪个状态转换而来
   */
  onEnter?(fromState: InteractionState | null): void;

  /**
   * 离开状态时的钩子
   * @param toState 将要转换到哪个状态
   */
  onExit?(toState: InteractionState | null): void;

  /**
   * 处理鼠标按下事件
   * @returns 可能返回新的状态,如果返回 null 则保持当前状态
   */
  handleMouseDown(ctx: MouseEventContext): InteractionState | null;

  /**
   * 处理鼠标移动事件
   * @returns 可能返回新的状态,如果返回 null 则保持当前状态
   */
  handleMouseMove(ctx: MouseEventContext): InteractionState | null;

  /**
   * 处理鼠标抬起事件
   * @returns 可能返回新的状态,如果返回 null 则保持当前状态
   */
  handleMouseUp(ctx: MouseEventContext): InteractionState | null;

  /**
   * 处理右键菜单事件
   * @returns 可能返回新的状态,如果返回 null 则保持当前状态
   */
  handleContextMenu(ctx: MouseEventContext): InteractionState | null;
}

/**
 * 基础状态类,提供通用的实现和辅助方法
 */
export abstract class BaseState implements InteractionState {
  abstract readonly name: string;

  constructor(protected timeline: TimelineInteractionAPI) {}

  /**
   * 创建鼠标事件上下文
   */
  protected createContext(e: MouseEvent): MouseEventContext {
    const canvas = this.timeline.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const state = this.timeline.state;

    return {
      canvasX: e.clientX - rect.left,
      canvasY: e.clientY - rect.top,
      logicalX: e.clientX - rect.left + state.scrollX,
      logicalY: e.clientY - rect.top + state.scrollY,
      originalEvent: e,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
    };
  }

  /**
   * 默认实现:不处理,保持当前状态
   */
  handleMouseDown(_ctx: MouseEventContext): InteractionState | null {
    return null;
  }

  handleMouseMove(_ctx: MouseEventContext): InteractionState | null {
    return null;
  }

  handleMouseUp(_ctx: MouseEventContext): InteractionState | null {
    return null;
  }

  handleContextMenu(_ctx: MouseEventContext): InteractionState | null {
    return null;
  }

  onEnter?(_fromState: InteractionState | null): void;
  onExit?(_toState: InteractionState | null): void;
}
