import { RenderLayer, TimelinePlugin, PluginType } from "../types";

const darkColors = {
  canvasBackground: "#1E1E2E",
  timelineBackground: "#2D2D3D",
  trackBackground: "#2A2A3A",
  trackBackgroundSelected: "#3A3A4A",
  timelineText: "#CCCCDD",
  timelineGrid: "#5A5A7A",
  timelineSubGrid: "#3A3A4A",
  trackText: "#CCCCDD",
  eventColors: ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FECA57", "#FF9FF3"],
  eventText: "#FFFFFF",
  eventBorder: "#FFFFFF",
  eventBorderSelected: "#FFD700",
  eventOverlay: "rgba(255, 255, 255, 0.1)",
  dragPreviewValid: "rgba(100, 255, 100, 0.5)",
  dragPreviewInvalid: "rgba(255, 100, 100, 0.5)",
  dragPreviewBorderValid: "#00FF00",
  dragPreviewBorderInvalid: "#FF0000",
  timeIndicator: "#FF6B6B",
  guideLine: "#00D9FF",
  guideLineLabel: "#00D9FF",
  dragTimeReferenceLine: "#FFD700",
  dragTimeReferenceLabel: "#FFD700",
  dragTimeReferenceLabelBackground: "rgba(0, 0, 0, 0)",
  scrollbarTrack: "rgba(255, 255, 255, 0.6)",
  scrollbarHandle: "rgba(150, 150, 150, 0.8)",
  scrollbarHandleHover: "rgba(0, 0, 0, 0.85)",
  scrollbarHandleHighlight: "rgba(255, 255, 255, 0.3)",
  scrollbarBorder: "rgba(255, 255, 255, 0.9)",
  contextMenuBackground: "#2D2D3D",
  contextMenuBorder: "#5A5A7A",
  contextMenuText: "#CCCCDD",
  contextMenuHoverBackground: "#3A3A4A",
  contextMenuHoverText: "#FFFFFF",
  eventDurationLabel: "#FFD700",
};

export const DarkThemePlugin: TimelinePlugin = {
  metadata: {
    name: "theme-dark",
    version: "1.0.0",
    description: "Dark theme for timeline",
    type: PluginType.THEME,
  },
  activate(context) {
    context.config.colors = { ...context.config.colors, ...darkColors };
    const layer: RenderLayer = {
      name: "theme-dark-background",
      position: "background",
      render(ctx, canvas, config) {
        ctx.fillStyle = config.colors.canvasBackground;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      },
    };
    context.api.registerRenderLayer(layer);
  },
  deactivate(context) {
    context.api.unregisterRenderLayer("theme-dark-background");
  },
};