import { PluginType, TimelinePlugin, RenderLayer } from "../types";
import { getLogger } from "../../core/managers/Logger";

const logger = getLogger("EventTooltipPlugin");

interface EventTooltipPluginOptions {
  /** 自定义 HTML 模板函数，接收事件标题，返回 HTML 字符串。传入此参数将自动启用 HTML 渲染模式 */
  htmlTemplate?: (title: string) => string;
  /** tooltip 显示延迟（毫秒），默认 300 */
  showDelay?: number;
  /** tooltip 最大宽度，默认 300 */
  maxWidth?: number;
  /** tooltip 内边距，默认 8 */
  padding?: number;
  /** tooltip 圆角，默认 4 */
  borderRadius?: number;
  /** tooltip 背景色，默认 '#333' */
  backgroundColor?: string;
  /** tooltip 文字颜色，默认 '#fff' */
  textColor?: string;
  /** tooltip 边框颜色，默认 '#555' */
  borderColor?: string;
  /** tooltip 字体大小，默认 12 */
  fontSize?: number;
  /** tooltip 字体，默认 'Arial, sans-serif' */
  fontFamily?: string;
}

interface TooltipState {
  visible: boolean;
  title: string;
  x: number;
  y: number;
  trackIndex: number;
  eventIndex: number;
}

function getPluginData<T>(
  getData: (key: string) => unknown,
  key: string
): T | undefined {
  return getData(key) as T | undefined;
}

export function EventTooltipPlugin(
  options: EventTooltipPluginOptions = {}
): TimelinePlugin {
  const {
    htmlTemplate,
    showDelay = 300,
    maxWidth = 300,
    padding = 8,
    borderRadius = 4,
    backgroundColor = "#333",
    textColor = "#fff",
    borderColor = "#555",
    fontSize = 12,
    fontFamily = "Arial, sans-serif",
  } = options;

  let tooltipState: TooltipState = {
    visible: false,
    title: "",
    x: 0,
    y: 0,
    trackIndex: -1,
    eventIndex: -1,
  };

  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let lastHoveredEvent: { trackIndex: number; eventIndex: number } | null =
    null;

  // 用于检测文本是否被截断的辅助函数
  function isTextTruncated(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxTextWidth: number
  ): boolean {
    const textWidth = ctx.measureText(text).width;
    return textWidth > maxTextWidth;
  }

  return {
    metadata: {
      name: "event-tooltip",
      version: "1.0.0",
      description:
        "Tooltip plugin for displaying full event title when text is truncated",
      descriptionI18n: {
        "zh-CN": "当事件标题被截断时显示完整标题的提示插件",
      },
      type: PluginType.EXTENSION,
    },

    activate(context) {
      const canvas = context.timeline.getCanvas();

      // RAF 节流：避免高刷新率显示器下每帧触发多次 hit-test
      let rafPending = false;
      let pendingMouseEvent: MouseEvent | null = null;

      // 鼠标移动事件处理（实际逻辑）
      const processMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const config = context.config;
        const state = context.state;

        // 检测是否悬停在事件块上
        const hoveredEvent = context.timeline.getEventAtPosition(
          canvasX,
          canvasY
        );

        if (hoveredEvent) {
          const { trackIndex, eventIndex } = hoveredEvent;
          const event = state.tracks[trackIndex]?.events[eventIndex];

          if (!event) {
            clearTooltip();
            return;
          }

          // 检查是否是同一个事件
          const isSameEvent =
            lastHoveredEvent &&
            lastHoveredEvent.trackIndex === trackIndex &&
            lastHoveredEvent.eventIndex === eventIndex;

          if (isSameEvent && tooltipState.visible) {
            // 更新位置
            tooltipState.x = canvasX;
            tooltipState.y = canvasY;
            context.timeline.draw();
            return;
          }

          // 新的事件
          lastHoveredEvent = { trackIndex, eventIndex };

          // 清除之前的定时器
          if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
          }

          // 计算事件块宽度和文本是否截断
          const eventWidth =
            event.duration * config.secondWidth * state.zoomLevel;
          const textPadding = 10;
          const maxTextWidth = eventWidth - textPadding * 2;

          // 创建临时 canvas 上下文来测量文本
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          const textStyle = config.eventTextStyle;
          const titleFontSize =
            textStyle.titleFontSize === "auto"
              ? Math.max(10, Math.min(14, config.trackHeight * 0.175))
              : textStyle.titleFontSize;

          ctx.font = `${textStyle.titleFontWeight} ${titleFontSize}px ${textStyle.titleFontFamily}`;

          // 只有文本被截断时才显示 tooltip
          if (isTextTruncated(ctx, event.title, maxTextWidth)) {
            hoverTimer = setTimeout(() => {
              tooltipState = {
                visible: true,
                title: event.title,
                x: canvasX,
                y: canvasY,
                trackIndex,
                eventIndex,
              };
              context.timeline.draw();
            }, showDelay);
          } else {
            clearTooltip();
          }
        } else {
          clearTooltip();
        }
      };

      // RAF 节流的 mousemove handler
      const handleMouseMove = (e: MouseEvent) => {
        pendingMouseEvent = e;
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(() => {
            rafPending = false;
            if (pendingMouseEvent) {
              processMouseMove(pendingMouseEvent);
              pendingMouseEvent = null;
            }
          });
        }
      };

      const clearTooltip = () => {
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
        lastHoveredEvent = null;
        if (tooltipState.visible) {
          tooltipState.visible = false;
          context.timeline.draw();
        }
      };

      const handleMouseLeave = () => {
        clearTooltip();
      };

      // 注册事件监听
      canvas.addEventListener("mousemove", handleMouseMove);
      canvas.addEventListener("mouseleave", handleMouseLeave);

      // 存储事件处理函数引用以便清理
      context.api.setData("tooltipMouseMoveHandler", handleMouseMove);
      context.api.setData("tooltipMouseLeaveHandler", handleMouseLeave);

      // 注册渲染层
      const layer: RenderLayer = {
        name: "event-tooltip-overlay",
        position: "overlay",
        render(ctx, _canvas, _config, _state) {
          if (!tooltipState.visible || !tooltipState.title) {
            // 隐藏 HTML 容器（如果存在）
            const container =
              getPluginData<HTMLElement>(
                context.api.getData,
                "tooltipContainer"
              ) || null;
            if (container) {
              container.style.display = "none";
            }
            return;
          }

          const canvasRect = context.timeline
            .getCanvas()
            .getBoundingClientRect();

          // 计算 tooltip 位置（在鼠标上方）
          let tooltipX = tooltipState.x;
          let tooltipY = tooltipState.y - 10; // 在鼠标上方

          // 测量文本以确定 tooltip 尺寸
          ctx.save();
          ctx.font = `${fontSize}px ${fontFamily}`;

          // 计算文本换行
          const words = tooltipState.title.split("");
          const lines: string[] = [];
          let currentLine = "";

          for (const char of words) {
            const testLine = currentLine + char;
            const testWidth = ctx.measureText(testLine).width;
            if (testWidth > maxWidth - padding * 2) {
              if (currentLine) {
                lines.push(currentLine);
                currentLine = char;
              } else {
                lines.push(char);
              }
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) {
            lines.push(currentLine);
          }

          // 计算 tooltip 尺寸
          let tooltipWidth = 0;
          for (const line of lines) {
            const lineWidth = ctx.measureText(line).width;
            tooltipWidth = Math.max(tooltipWidth, lineWidth);
          }
          tooltipWidth = Math.min(tooltipWidth + padding * 2, maxWidth);

          const lineHeight = fontSize * 1.4;
          const tooltipHeight = lines.length * lineHeight + padding * 2;

          // 调整位置，确保不超出画布边界
          tooltipY -= tooltipHeight;

          if (tooltipX + tooltipWidth > canvasRect.width) {
            tooltipX = canvasRect.width - tooltipWidth - 5;
          }
          if (tooltipX < 5) {
            tooltipX = 5;
          }
          if (tooltipY < 5) {
            // 如果上方空间不足，显示在下方
            tooltipY = tooltipState.y + 20;
          }

          // 检测是否使用 HTML 渲染模式（传入 htmlTemplate 自动启用）
          const shouldUseHtml = !!htmlTemplate;
          if (shouldUseHtml) {
            // 验证 htmlTemplate 返回有效内容
            const testContent = htmlTemplate(tooltipState.title);
            if (!testContent || testContent.trim() === "") {
              logger.warn(
                context.timeline.t("warningEmptyTooltipTemplateFallback")
              );
            } else {
              let container =
                getPluginData<HTMLElement>(
                  context.api.getData,
                  "tooltipContainer"
                ) || null;

              if (!container) {
                container = document.createElement("div");
                container.style.position = "absolute";
                container.style.zIndex = "1001";
                container.style.pointerEvents = "none";
                container.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
                container.style.border = `1px solid ${borderColor}`;
                container.style.borderRadius = `${borderRadius}px`;
                container.style.padding = `${padding}px`;
                container.style.fontSize = `${fontSize}px`;
                container.style.fontFamily = fontFamily;
                container.style.backgroundColor = backgroundColor;
                container.style.color = textColor;
                container.style.maxWidth = `${maxWidth}px`;
                container.style.wordWrap = "break-word";
                container.style.whiteSpace = "pre-wrap";

                const parent =
                  context.timeline.getCanvas().parentElement || document.body;
                parent.style.position = parent.style.position || "relative";
                parent.appendChild(container);
                context.api.setData("tooltipContainer", container);
              }

              container.style.display = "block";
              container.style.left = `${tooltipX}px`;
              container.style.top = `${tooltipY}px`;

              container.innerHTML = testContent;

              ctx.restore();
              return;
            }
          }

          // Canvas 渲染模式
          // 绘制阴影
          ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 2;

          // 绘制背景
          ctx.fillStyle = backgroundColor;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(
              tooltipX,
              tooltipY,
              tooltipWidth,
              tooltipHeight,
              borderRadius
            );
          } else {
            // 兼容不支持 roundRect 的浏览器
            const x = tooltipX;
            const y = tooltipY;
            const w = tooltipWidth;
            const h = tooltipHeight;
            const r = borderRadius;
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
          }
          ctx.fill();

          // 清除阴影
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;

          // 绘制边框
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 1;
          ctx.stroke();

          // 绘制文本
          ctx.fillStyle = textColor;
          ctx.font = `${fontSize}px ${fontFamily}`;
          ctx.textAlign = "left";
          ctx.textBaseline = "top";

          for (let i = 0; i < lines.length; i++) {
            ctx.fillText(
              lines[i],
              tooltipX + padding,
              tooltipY + padding + i * lineHeight
            );
          }

          ctx.restore();
        },
      };

      context.api.registerRenderLayer(layer);
    },

    deactivate(context) {
      // 清理事件监听
      const canvas = context.timeline.getCanvas();
      const handleMouseMove = getPluginData<
        (event: MouseEvent) => void
      >(context.api.getData, "tooltipMouseMoveHandler");
      const handleMouseLeave = getPluginData<() => void>(
        context.api.getData,
        "tooltipMouseLeaveHandler"
      );

      if (handleMouseMove) {
        canvas.removeEventListener("mousemove", handleMouseMove);
      }
      if (handleMouseLeave) {
        canvas.removeEventListener("mouseleave", handleMouseLeave);
      }

      // 清理定时器
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }

      // 注销渲染层
      context.api.unregisterRenderLayer("event-tooltip-overlay");

      // 清理 HTML 容器
      const container =
        getPluginData<HTMLElement>(context.api.getData, "tooltipContainer") ||
        null;
      if (container && container.parentElement) {
        container.parentElement.removeChild(container);
      }
    },

    destroy(context) {
      // 清理 HTML 容器
      const container =
        getPluginData<HTMLElement>(context.api.getData, "tooltipContainer") ||
        null;
      if (container && container.parentElement) {
        container.parentElement.removeChild(container);
      }

      // 清理定时器
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
    },
  };
}
