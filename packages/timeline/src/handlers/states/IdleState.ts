import {
  BaseState,
  type InteractionState,
  type MouseEventContext,
} from "./InteractionState";
import type { Timeline } from "../../core/Timeline";
import { DraggingState } from "./DraggingState";
import { ResizingState } from "./ResizingState";
import { ScrollingState } from "./ScrollingState";
import { TimeIndicatorDragState } from "./TimeIndicatorDragState";
import { IdleHoverController } from "./idle/IdleHoverController";
import { IdleMouseDownRouter } from "./idle/IdleMouseDownRouter";

/**
 * 空闲状态 - 没有进行任何交互操作
 * 负责:
 * - 检测鼠标悬停效果
 * - 检测是否点击了可交互元素(事件、滚动条、时间指示器等)
 * - 切换到对应的交互状态
 */
export class IdleState extends BaseState {
  readonly name = "Idle";
  private readonly hoverController: IdleHoverController;
  private readonly mouseDownRouter: IdleMouseDownRouter;

  constructor(timeline: Timeline) {
    super(timeline);
    this.hoverController = new IdleHoverController(this);
    this.mouseDownRouter = new IdleMouseDownRouter(this);
  }

  public getTimeline(): Timeline {
    return this.timeline;
  }

  public handleMouseDown(ctx: MouseEventContext): InteractionState | null {
    return this.mouseDownRouter.handleMouseDown(ctx);
  }

  public handleMouseMove(ctx: MouseEventContext): InteractionState | null {
    return this.hoverController.handleMouseMove(ctx);
  }

  handleContextMenu(ctx: MouseEventContext): InteractionState | null {
    ctx.originalEvent.preventDefault();
    const { canvasX, canvasY } = ctx;
    const config = this.timeline.config;
    const state = this.timeline.state;

    // 只有在加载了 ContextMenuPlugin 时才响应右键菜单
    if (
      !config.enableContextMenu ||
      config.readOnly ||
      !this.timeline.isPluginLoaded("context-menu")
    ) {
      return null;
    }

    const clickedEvent = this.timeline.getEventAtPosition(canvasX, canvasY);
    if (clickedEvent) {
      const { trackIndex, eventIndex } = clickedEvent;
      state.contextMenuEvent = { trackIndex, eventIndex };
      state.contextMenuVisible = true;
      state.contextMenuX = canvasX;
      state.contextMenuY = canvasY;
      state.hoveredContextMenuItem = -1;
      this.timeline.notifyChange("interaction:contextMenu");
    } else {
      state.contextMenuVisible = false;
      state.contextMenuEvent = null;
      this.timeline.notifyChange("interaction:contextMenu");
    }

    return null;
  }

  /**
   * 创建拖拽状态
   */
  public createDraggingState(): InteractionState {
    return new DraggingState(this.timeline);
  }

  /**
   * 创建调整大小状态
   */
  public createResizingState(): InteractionState {
    return new ResizingState(this.timeline);
  }

  /**
   * 创建滚动状态
   */
  public createScrollingState(): InteractionState {
    return new ScrollingState(this.timeline);
  }

  /**
   * 创建时间指示器拖拽状态
   */
  public createTimeIndicatorDragState(): InteractionState {
    return new TimeIndicatorDragState(this.timeline);
  }
}
