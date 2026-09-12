import type {
  EventContentPhase,
  EventContentRect,
  EventContentRenderContext,
  TimelineConfig,
  TimelineEvent,
  TimelineState,
  Track,
} from "../../types";
import { getLogger } from "../../core/managers/Logger";

const logger = getLogger("EventContentRenderer");

/** 水平滚动条占位高度，与 ViewportManager.H_SCROLLBAR_PADDING 保持一致 */
const H_SCROLLBAR_PADDING = 13;

export interface DrawEventContentArgs {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  config: TimelineConfig;
  state: TimelineState;
  dpr: number;
  event: TimelineEvent;
  track: Track;
  trackIndex: number;
  eventIndex: number;
  /** 事件块完整矩形：CSS px、Canvas 原点、已扣 scroll，含 eventVerticalPadding */
  rect: EventContentRect;
  phase: EventContentPhase;
  selected: boolean;
  highlighted: boolean;
  drawDefaultContent: (ctx: CanvasRenderingContext2D) => void;
  renderEventContent?: (context: EventContentRenderContext) => void;
}

/**
 * 统一事件内容绘制入口：普通、拖动、拉伸阶段的可见任务内容都经过这里。
 * 调用入口前 save + clip，finally restore；自定义绘制异常以固定错误码记录并回退
 * 默认内容（默认内容在一次调用中至多执行一次，不重复绘制媒体）。
 */
export function drawEventContent(args: DrawEventContentArgs): void {
  const {
    ctx,
    canvas,
    config,
    dpr,
    event,
    track,
    trackIndex,
    eventIndex,
    rect,
    phase,
    selected,
    highlighted,
    drawDefaultContent,
    renderEventContent,
  } = args;

  const clipRect = computeClipRect(args);
  ctx.save();
  ctx.beginPath();
  ctx.rect(clipRect.x, clipRect.y, clipRect.width, clipRect.height);
  ctx.clip();

  let defaultDrawn = false;
  const drawDefaultOnce = (): void => {
    if (defaultDrawn) return;
    defaultDrawn = true;
    drawDefaultContent(ctx);
  };

  const draftState = ((): { commitState: "idle" | "preview" | "pending" | "reconciliation_required"; operationId?: string } => {
    const draft =
      args.event.businessId !== undefined ? args.state.editDrafts.get(args.event.businessId) : undefined;
    if (!draft) return { commitState: "idle" };
    return { commitState: draft.commitState, operationId: draft.operationId };
  })();

  if (renderEventContent) {
    try {
      renderEventContent({
        ctx,
        canvas,
        config,
        state: args.state,
        event,
        track,
        trackIndex,
        eventIndex,
        rect,
        clipRect,
        phase,
        selected,
        highlighted,
        readonly: Boolean(event.readonly) || config.readOnly,
        dpr,
        // M2：候选草稿存在时按其提交状态展示（pending/待核对）
        commitState: draftState.commitState,
        ...(draftState.operationId ? { operationId: draftState.operationId } : {}),
        drawDefaultContent: drawDefaultOnce,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown error";
      logger.error(
        `[render] custom event content failed (code=event_content_error); falling back to default content (${detail})`
      );
      drawDefaultOnce();
    }
  } else {
    drawDefaultOnce();
  }

  ctx.restore();
}

/**
 * 事件内容与可绘制视口的交集：排除固定时间轴与水平滚动条区域。
 * 宽度规则与 EventsRenderer 一致：duration * secondWidth * zoomLevel。
 */
function computeClipRect(args: DrawEventContentArgs): EventContentRect {
  const { rect, config } = args;
  const dpr = args.dpr > 0 ? args.dpr : 1;
  // 调用方传入的 canvas.width 为物理像素；RenderPipeline 传入逻辑宽度时 dpr=1
  const logicalWidth = args.canvas.width / dpr;
  const logicalHeight = args.canvas.height / dpr;

  const contentLeft = 0;
  const contentTop = config.timelineHeight;
  const contentWidth = logicalWidth;
  const contentBottom = logicalHeight - scrollbarInset(args, logicalWidth);

  const x = Math.max(rect.x, contentLeft);
  const y = Math.max(rect.y, contentTop);
  const right = Math.min(rect.x + rect.width, contentLeft + contentWidth);
  const bottom = Math.min(rect.y + rect.height, contentBottom);

  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}

function scrollbarInset(args: DrawEventContentArgs, logicalWidth: number): number {
  const contentWidth =
    args.config.startPaddingTime +
    (args.config.endTime +
      args.config.endPaddingTime -
      args.config.startTime) *
      args.config.secondWidth *
      args.state.zoomLevel;
  return contentWidth > logicalWidth ? H_SCROLLBAR_PADDING : 0;
}
