import { PluginType, TimelinePlugin, RenderLayer } from "../types";
import { graphemes } from "../../renderers/core/graphemes";
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
}

function getPluginData<T>(getData: (key: string) => unknown, key: string): T | undefined {
  return getData(key) as T | undefined;
}

export function EventTooltipPlugin(options: EventTooltipPluginOptions = {}): TimelinePlugin {
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

  return {
    metadata: {
      name: "event-tooltip",
      version: "1.0.0",
      description: "Tooltip plugin for displaying full event title when text is truncated",
      descriptionI18n: {
        "zh-CN": "当事件标题被截断时显示完整标题的提示插件",
      },
      type: PluginType.EXTENSION,
    },

    activate(context) {
      const canvas = context.timeline.getCanvas();

      const tooltipState: TooltipState = { visible: false, title: "", x: 0, y: 0 };
      let hovered: typeof context.state.tracks[number]["events"][number] | undefined;
      let hoverTimer: ReturnType<typeof setTimeout> | null = null;
      let animationFrameId: number | null = null;
      let pendingMouseEvent: MouseEvent | null = null;

      const redrawOverlay = () => {
        context.timeline.markDirty(["overlay"]);
        context.timeline.draw();
      };
      const clearTooltip = () => {
        if (hoverTimer !== null) clearTimeout(hoverTimer);
        hoverTimer = null;
        hovered = undefined;
        if (tooltipState.visible) {
          tooltipState.visible = false;
          redrawOverlay();
        }
      };
      const processMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const hit = context.timeline.getEventAtPosition(x, y);
        const event = hit && context.state.tracks[hit.trackIndex]?.events[hit.eventIndex];
        if (!event) { clearTooltip(); return; }

        const moved = tooltipState.x !== x || tooltipState.y !== y;
        tooltipState.x = x;
        tooltipState.y = y;
        if (event === hovered && event.title === tooltipState.title) {
          if (moved && tooltipState.visible) redrawOverlay();
          return;
        }
        clearTooltip();
        const { config, state } = context;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const style = config.eventTextStyle;
        const fontSize = style.titleFontSize === "auto"
          ? Math.max(10, Math.min(14, config.trackHeight * 0.175)) : style.titleFontSize;
        ctx.save();
        try {
          ctx.font = `${style.titleFontWeight} ${fontSize}px ${style.titleFontFamily}`;
          if (ctx.measureText(event.title).width <= event.duration * config.secondWidth * state.zoomLevel - 20) return;
        } finally {
          ctx.restore();
        }
        hovered = event;
        tooltipState.title = event.title;
        hoverTimer = setTimeout(() => {
          hoverTimer = null;
          tooltipState.visible = true;
          redrawOverlay();
        }, showDelay);
      };

      // RAF 节流的 mousemove handler
      const handleMouseMove = (e: MouseEvent) => {
        pendingMouseEvent = e;
        if (animationFrameId === null) {
          animationFrameId = requestAnimationFrame(() => {
            animationFrameId = null;
            if (pendingMouseEvent) {
              processMouseMove(pendingMouseEvent);
              pendingMouseEvent = null;
            }
          });
        }
      };

      const cancelFrame = () => {
        if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        pendingMouseEvent = null;
      };
      const handleMouseLeave = () => {
        cancelFrame();
        clearTooltip();
      };
      canvas.addEventListener("mousemove", handleMouseMove);
      canvas.addEventListener("mouseleave", handleMouseLeave);
      context.api.setData("tooltipCleanup", () => {
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("mouseleave", handleMouseLeave);
        cancelFrame();
        if (hoverTimer !== null) clearTimeout(hoverTimer);
        getPluginData<HTMLElement>(context.api.getData, "tooltipContainer")?.remove();
      });

      // 注册渲染层
      const layer: RenderLayer = {
        name: "event-tooltip-overlay",
        position: "overlay",
        render(ctx, _canvas, _config, _state) {
          if (!tooltipState.visible || !tooltipState.title) {
            // 隐藏 HTML 容器（如果存在）
            const container =
              getPluginData<HTMLElement>(context.api.getData, "tooltipContainer") || null;
            if (container) {
              container.style.display = "none";
            }
            return;
          }

          const canvasRect = context.timeline.getCanvas().getBoundingClientRect();

          // 计算 tooltip 位置（在鼠标上方）
          let tooltipX = tooltipState.x;
          let tooltipY = tooltipState.y - 10; // 在鼠标上方

          // 测量文本以确定 tooltip 尺寸
          ctx.save();
          ctx.font = `${fontSize}px ${fontFamily}`;

          // 计算文本换行
          const words = graphemes(tooltipState.title);
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
              const previous = getPluginData<HTMLElement>(context.api.getData, "tooltipContainer");
              if (previous) previous.style.display = "none";
              logger.warn(context.timeline.t("warningEmptyTooltipTemplateFallback"));
            } else {
              let container =
                getPluginData<HTMLElement>(context.api.getData, "tooltipContainer") || null;

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

                const parent = context.timeline.getCanvas().parentElement || document.body;
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
            ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, borderRadius);
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
            ctx.fillText(lines[i], tooltipX + padding, tooltipY + padding + i * lineHeight);
          }

          ctx.restore();
        },
      };

      context.api.registerRenderLayer(layer);
    },

    deactivate(context) {
      context.api.unregisterRenderLayer("event-tooltip-overlay");
      getPluginData<() => void>(context.api.getData, "tooltipCleanup")?.();
      context.api.setData("tooltipCleanup", undefined);
    },
    destroy(context) {
      getPluginData<() => void>(context.api.getData, "tooltipCleanup")?.();
    },
  };
}
