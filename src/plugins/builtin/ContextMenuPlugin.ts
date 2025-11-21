import { PluginType, TimelinePlugin, RenderLayer } from "../types";

interface ContextMenuPluginOptions {
  useHtml?: boolean;
  htmlTemplate?: string;
}

export function ContextMenuPlugin(options: ContextMenuPluginOptions = {}): TimelinePlugin {
  return {
    metadata: {
      name: "context-menu",
      version: "1.0.0",
      description: "Context menu as plugin, supports HTML takeover",
      type: PluginType.EXTENSION,
    },
    activate(context) {
      const cfgHtml = (context.config && context.config.contextMenuHtml) || undefined;
      const useHtml = options.useHtml || !!cfgHtml;
      const htmlTemplate = options.htmlTemplate || (typeof cfgHtml === "string" ? cfgHtml : undefined);
      const layer: RenderLayer = {
        name: "context-menu-overlay",
        position: "overlay",
        render(ctx, _canvas, config, state) {
          if (!config.enableContextMenu || !state.contextMenuVisible || !state.contextMenuEvent) {
            const container: HTMLElement | null = context.api.getData("contextMenuContainer") || null;
            if (container) container.style.display = "none";
            state.contextMenuBounds = null;
            return;
          }
          const { padding, itemHeight, borderRadius, borderWidth, minWidth, fontSize, fontFamily, fontWeight } = config.contextMenuStyle;
          ctx.save();
          ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
          let maxWidth = minWidth;
          const cacheKey = `${fontWeight}-${fontSize}-${fontFamily}`;
          const widthCache: Record<string, Record<string, number>> = context.api.getData("contextMenuTextWidthCache") || {};
          const cacheBucket = widthCache[cacheKey] || {};
          for (const item of config.contextMenuItems) {
            const cached = cacheBucket[item.name];
            const textWidth = cached !== undefined ? cached : ctx.measureText(item.name).width;
            if (cached === undefined) {
              (cacheBucket as Record<string, number>)[item.name] = textWidth;
            }
            maxWidth = Math.max(maxWidth, textWidth + padding * 2);
          }
          widthCache[cacheKey] = cacheBucket;
          context.api.setData("contextMenuTextWidthCache", widthCache);
          const menuWidth = maxWidth;
          const menuHeight = config.contextMenuItems.length * itemHeight + padding * 2;
          const rect = context.timeline.getCanvas().getBoundingClientRect();
          let menuX = state.contextMenuX;
          let menuY = state.contextMenuY;
          if (menuX + menuWidth > rect.width) menuX = rect.width - menuWidth - 5;
          if (menuY + menuHeight > rect.height) menuY = rect.height - menuHeight - 5;

          state.contextMenuBounds = { x: menuX, y: menuY, width: menuWidth, height: menuHeight, itemHeight, padding };

          if (useHtml) {
            let container: HTMLElement | null = context.api.getData("contextMenuContainer") || null;
            if (!container) {
              container = document.createElement("div");
              container.style.position = "absolute";
              container.style.zIndex = "1000";
              container.style.boxShadow = "0 2px 10px rgba(0,0,0,0.3)";
              container.style.border = `${borderWidth}px solid ${config.colors.contextMenuBorder}`;
              container.style.borderRadius = `${borderRadius}px`;
              container.style.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
              container.style.background = config.colors.contextMenuBackground;
              container.style.color = config.colors.contextMenuText;
              const parent = context.timeline.getCanvas().parentElement || document.body;
              parent.style.position = parent.style.position || "relative";
              parent.appendChild(container);
              context.api.setData("contextMenuContainer", container);
            }
            container.style.display = "block";
            container.style.left = `${menuX}px`;
            container.style.top = `${menuY}px`;
            container.style.width = `${menuWidth}px`;
            container.style.height = `${menuHeight}px`;
            if (htmlTemplate) {
              container.innerHTML = htmlTemplate;
            } else {
              let html = "";
              for (let i = 0; i < config.contextMenuItems.length; i++) {
                const item = config.contextMenuItems[i];
                const isHover = state.hoveredContextMenuItem === i;
                const bg = isHover ? config.colors.contextMenuHoverBackground : "transparent";
                const fg = isHover ? config.colors.contextMenuHoverText : config.colors.contextMenuText;
                html += `<div style="height:${itemHeight}px; padding:${padding}px; background:${bg}; color:${fg}; display:flex; align-items:center;">${item.name}</div>`;
              }
              container.innerHTML = html;
            }
            ctx.restore();
            return;
          }

          ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
          ctx.shadowBlur = 10;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 2;
          ctx.fillStyle = config.colors.contextMenuBackground;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(menuX, menuY, menuWidth, menuHeight, borderRadius);
          } else {
            ctx.moveTo(menuX + borderRadius, menuY);
            ctx.lineTo(menuX + menuWidth - borderRadius, menuY);
            ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + borderRadius);
            ctx.lineTo(menuX + menuWidth, menuY + menuHeight - borderRadius);
            ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - borderRadius, menuY + menuHeight);
            ctx.lineTo(menuX + borderRadius, menuY + menuHeight);
            ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - borderRadius);
            ctx.lineTo(menuX, menuY + borderRadius);
            ctx.quadraticCurveTo(menuX, menuY, menuX + borderRadius, menuY);
          }
          ctx.fill();
          ctx.shadowColor = "transparent";
          ctx.strokeStyle = config.colors.contextMenuBorder;
          ctx.lineWidth = borderWidth;
          ctx.stroke();
          ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
          for (let i = 0; i < config.contextMenuItems.length; i++) {
            const item = config.contextMenuItems[i];
            const itemY = menuY + padding + i * itemHeight;
            if (state.hoveredContextMenuItem === i) {
              ctx.fillStyle = config.colors.contextMenuHoverBackground;
              ctx.beginPath();
              if (i === 0) {
                if (ctx.roundRect) {
                  ctx.roundRect(menuX + borderWidth, itemY, menuWidth - borderWidth * 2, itemHeight, [borderRadius - borderWidth, borderRadius - borderWidth, 0, 0]);
                } else {
                  ctx.fillRect(menuX + borderWidth, itemY, menuWidth - borderWidth * 2, itemHeight);
                }
              } else if (i === config.contextMenuItems.length - 1) {
                if (ctx.roundRect) {
                  ctx.roundRect(menuX + borderWidth, itemY, menuWidth - borderWidth * 2, itemHeight, [0, 0, borderRadius - borderWidth, borderRadius - borderWidth]);
                } else {
                  ctx.fillRect(menuX + borderWidth, itemY, menuWidth - borderWidth * 2, itemHeight);
                }
              } else {
                ctx.fillRect(menuX + borderWidth, itemY, menuWidth - borderWidth * 2, itemHeight);
              }
              ctx.fill();
            }
            ctx.fillStyle = state.hoveredContextMenuItem === i ? config.colors.contextMenuHoverText : config.colors.contextMenuText;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(item.name, menuX + padding, itemY + itemHeight / 2);
          }
          ctx.restore();
        },
      };
      context.api.registerRenderLayer(layer);
    },
    deactivate(context) {
      context.api.unregisterRenderLayer("context-menu-overlay");
      const container: HTMLElement | null = context.api.getData("contextMenuContainer") || null;
      if (container && container.parentElement) container.parentElement.removeChild(container);
    },
    destroy(context) {
      const container: HTMLElement | null = context.api.getData("contextMenuContainer") || null;
      if (container && container.parentElement) container.parentElement.removeChild(container);
    },
  };
}