import { type InteractionState, IdleState } from "./states";
import type { TimelineInteractionAPI } from "./TimelineInteractionAPI";
import { LogColors, getLogger } from "../core/managers/Logger";

const logger = getLogger("StateMachine");

/**
 * MouseHandler - 鼠标事件处理器(重构为状态模式)
 *
 * 职责:
 * - 监听原生 DOM 鼠标事件
 * - 创建事件上下文对象
 * - 将事件分发给当前激活的状态对象
 * - 管理状态转换
 *
 * 优势:
 * - 消除了复杂的布尔标志位和 if-else 嵌套
 * - 每个交互逻辑独立封装,易于维护和扩展
 * - 状态转换清晰可追踪
 */
export class MouseHandler {
  /** 当前激活的交互状态 */
  private currentState: InteractionState;

  /** requestAnimationFrame ID,用于节流 */
  private rafId: number | null = null;

  /** 待处理的鼠标移动事件 */
  private pendingMouseMove: MouseEvent | null = null;

  constructor(private timeline: TimelineInteractionAPI) {
    // 初始状态为空闲状态
    this.currentState = new IdleState(timeline);
  }

  /**
   * 获取当前状态名称(用于调试)
   */
  public getCurrentStateName(): string {
    return this.currentState.name;
  }

  /**
   * 处理状态转换
   */
  private transitionTo(newState: InteractionState | null): void {
    if (!newState || newState === this.currentState) {
      return;
    }

    const oldState = this.currentState;

    // 调用旧状态的退出钩子
    if (oldState.onExit) {
      logger.debugStyled(LogColors.stateExit, `◁ Exit: ${oldState.name}`);
      oldState.onExit(newState);
    }

    // 切换状态
    this.currentState = newState;

    // 调用新状态的进入钩子
    if (newState.onEnter) {
      logger.debugStyled(LogColors.stateEnter, `▷ Enter: ${newState.name}`);
      newState.onEnter(oldState);
    }

    // 调试日志
    logger.debugStyled(
      LogColors.stateTransition,
      `⟳ Transition: ${oldState.name} → ${newState.name}`
    );
  }

  /**
   * 创建鼠标事件上下文
   */
  private createContext(e: MouseEvent) {
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
   * 处理鼠标按下事件
   */
  public handleMouseDown(e: MouseEvent): void {
    const ctx = this.createContext(e);
    const newState = this.currentState.handleMouseDown(ctx);
    this.transitionTo(newState);
  }

  /**
   * 处理鼠标移动事件(使用 RAF 节流)
   */
  public handleMouseMove(e: MouseEvent): void {
    // 如果已经有pending的RAF,只更新事件
    if (this.rafId !== null) {
      this.pendingMouseMove = e;
      return;
    }

    // 保存事件并请求下一帧
    this.pendingMouseMove = e;
    this.rafId = requestAnimationFrame(() => {
      if (this.pendingMouseMove) {
        this.handleMouseMoveImpl(this.pendingMouseMove);
        this.pendingMouseMove = null;
      }
      this.rafId = null;
    });
  }

  /**
   * 实际处理鼠标移动的逻辑
   */
  private handleMouseMoveImpl(e: MouseEvent): void {
    const ctx = this.createContext(e);
    const newState = this.currentState.handleMouseMove(ctx);
    this.transitionTo(newState);
  }

  /**
   * 处理鼠标抬起事件
   */
  public handleMouseUp(e?: MouseEvent): void {
    // 取消pending的RAF
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.pendingMouseMove = null;
    }

    // 如果没有事件对象,创建一个虚拟的
    const event = e || new MouseEvent("mouseup");
    const ctx = this.createContext(event);
    const newState = this.currentState.handleMouseUp(ctx);
    this.transitionTo(newState);
  }

  /**
   * 处理右键菜单事件
   */
  public handleContextMenu(e: MouseEvent): void {
    const ctx = this.createContext(e);
    const newState = this.currentState.handleContextMenu(ctx);
    this.transitionTo(newState);
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.pendingMouseMove = null;
  }
}
