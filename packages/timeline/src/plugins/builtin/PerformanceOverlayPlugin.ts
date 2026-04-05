import { RenderLayer, TimelinePlugin, PluginType } from "../types";
import { PerformanceMonitor } from "../../utils/performanceMonitor";

export const PerformanceOverlayPlugin: TimelinePlugin = {
  metadata: {
    name: "performance-overlay",
    version: "1.0.0",
    description: "Draw performance metrics overlay",
    type: PluginType.TOOL,
  },
  activate(context) {
    const monitor = new PerformanceMonitor(
      context.config.enablePerformanceMonitor || context.config.debug
    );
    context.api.setPerformanceProvider(monitor);
    context.api.setData("perfMonitor", monitor);
    context.api.setData("perfOverlayPos", { x: 10, y: 10 });
    context.api.setData("perfOverlayDragging", false);
    context.api.setData("perfOverlayOffset", { x: 0, y: 0 });
    const canvas = context.timeline.getCanvas();
    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = context.api.getData("perfOverlaySize") as
        | { width: number; height: number }
        | undefined;
      const pos = (context.api.getData("perfOverlayPos") as {
        x: number;
        y: number;
      }) || { x: 10, y: 10 };
      if (
        size &&
        x >= pos.x &&
        x <= pos.x + size.width &&
        y >= pos.y &&
        y <= pos.y + size.height
      ) {
        context.api.setData("perfOverlayDragging", true);
        context.api.setData("perfOverlayOffset", {
          x: x - pos.x,
          y: y - pos.y,
        });
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      const dragging = context.api.getData("perfOverlayDragging") as boolean;
      if (!dragging) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const offset = (context.api.getData("perfOverlayOffset") as {
        x: number;
        y: number;
      }) || { x: 0, y: 0 };
      const size = (context.api.getData("perfOverlaySize") as {
        width: number;
        height: number;
      }) || { width: 0, height: 0 };
      let nx = x - offset.x;
      let ny = y - offset.y;
      nx = Math.max(0, Math.min(rect.width - size.width, nx));
      ny = Math.max(0, Math.min(rect.height - size.height, ny));
      context.api.setData("perfOverlayPos", { x: nx, y: ny });
      context.timeline.markDirty(["overlay"]);
      context.timeline.draw();
      e.stopImmediatePropagation();
      e.preventDefault();
    };
    const onMouseUp = (_e: MouseEvent) => {
      const dragging = context.api.getData("perfOverlayDragging") as boolean;
      if (dragging) {
        context.api.setData("perfOverlayDragging", false);
      }
    };
    canvas.addEventListener("mousedown", onMouseDown, { capture: true });
    canvas.addEventListener("mousemove", onMouseMove, { capture: true });
    window.addEventListener("mouseup", onMouseUp, { capture: true });
    context.api.setData("perfOverlayListeners", {
      onMouseDown,
      onMouseMove,
      onMouseUp,
    });
    const layer: RenderLayer = {
      name: "performance-overlay",
      position: "overlay",
      render(ctx) {
        const m = context.api.getData("perfMonitor") as
          | PerformanceMonitor
          | undefined;
        const shouldEnable = !!(
          context.config.enablePerformanceMonitor || context.config.debug
        );
        if (m) {
          if (shouldEnable) {
            m.enable();
          } else {
            m.disable();
            m.clear();
            return;
          }
        } else if (!shouldEnable) {
          return;
        }
        const allStats = context.api.getPerformanceStats();

        const padding = 15;
        const lineHeight = 20;
        const headerHeight = 25;
        const fps = context.api.getFPS();
        const lines = Array.from(allStats.entries());
        const overlayWidth = 280;
        const ordered = [
          "background",
          "tracks",
          "timeline",
          "interaction",
          "guideLines",
          "scrollbar",
          "overlay",
          "dragPreview",
        ];
        const layerTimes = context.timeline.getLastLayerTimes
          ? context.timeline.getLastLayerTimes()
          : undefined;
        const layerCount = layerTimes
          ? ordered.filter((k) => layerTimes[k] !== undefined).length
          : 0;
        const extraRows = layerTimes ? 1 + layerCount : 0;
        const statsRows = allStats.size === 0 ? 1 : lines.length;
        const overlayHeight =
          headerHeight + (1 + statsRows + extraRows) * lineHeight + padding * 2;
        const pos = (context.api.getData("perfOverlayPos") as {
          x: number;
          y: number;
        }) || { x: 10, y: 10 };
        context.api.setData("perfOverlaySize", {
          width: overlayWidth,
          height: overlayHeight,
        });

        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(pos.x, pos.y, overlayWidth, overlayHeight);
        ctx.strokeStyle = "rgba(100, 255, 100, 0.6)";
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x, pos.y, overlayWidth, overlayHeight);
        ctx.fillStyle = "#00FF00";
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "left";
        ctx.fillText("Performance Monitor", pos.x + 10, pos.y + 20);
        let yOffset = pos.y + 20 + headerHeight;
        ctx.fillStyle =
          fps >= 55 ? "#00FF00" : fps >= 30 ? "#FFFF00" : "#FF0000";
        ctx.font = "bold 14px monospace";
        ctx.fillText(`FPS: ${fps.toFixed(1)}`, pos.x + 10, yOffset);
        ctx.font = "12px monospace";
        yOffset += lineHeight;

        if (layerTimes) {
          ctx.fillStyle = "#00FFFF";
          ctx.font = "bold 12px monospace";
          ctx.fillText("Layer Times (ms):", pos.x + 10, yOffset);
          yOffset += lineHeight;
          ctx.font = "12px monospace";
          ctx.fillStyle = "#FFFFFF";
          for (const key of ordered) {
            if (layerTimes[key] !== undefined) {
              ctx.fillText(
                `${key}: ${layerTimes[key].toFixed(2)}`,
                pos.x + 10,
                yOffset
              );
              yOffset += lineHeight;
            }
          }
        }

        if (allStats.size === 0) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillText("Collecting...", pos.x + 10, yOffset);
          yOffset += lineHeight;
        } else {
          lines.forEach(([name, stats]) => {
            let color = "#00FF00";
            if (stats.average > 16) color = "#FFFF00";
            if (stats.average > 33) color = "#FF0000";
            ctx.fillStyle = color;
            const text = `${name}: ${stats.average.toFixed(
              2
            )}ms (${stats.min.toFixed(1)}-${stats.max.toFixed(1)})`;
            ctx.fillText(text, pos.x + 10, yOffset);
            yOffset += lineHeight;
          });
        }
      },
    };
    context.api.registerRenderLayer(layer);
  },
  deactivate(context) {
    context.api.unregisterRenderLayer("performance-overlay");
    const listeners = context.api.getData("perfOverlayListeners") as
      | {
          onMouseDown: (e: MouseEvent) => void;
          onMouseMove: (e: MouseEvent) => void;
          onMouseUp: (e: MouseEvent) => void;
        }
      | undefined;
    const canvas = context.timeline.getCanvas();
    if (listeners) {
      canvas.removeEventListener("mousedown", listeners.onMouseDown, true);
      canvas.removeEventListener("mousemove", listeners.onMouseMove, true);
      window.removeEventListener("mouseup", listeners.onMouseUp, true);
    }
  },
};
