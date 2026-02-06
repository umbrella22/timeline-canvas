import type { TimelinePlugin, TimelineColors } from "../../plugins/types";
import { PluginType } from "../../plugins/types";

const colors: TimelineColors = {
  // TODO: define theme colors
  background: "#ffffff",
  text: "#000000",
};

export const {{EXPORT_NAME}}: TimelinePlugin = {
  metadata: {
    name: "{{METADATA_NAME}}",
    version: "{{VERSION}}",
    description: "{{DESCRIPTION}}",
    type: PluginType.THEME,
  },
  activate(context) {
    // Apply theme colors to the timeline
    context.api.applyTheme(colors);
  },
  deactivate(_context) {
    // Theme cleanup is handled by the plugin system
  },
};
