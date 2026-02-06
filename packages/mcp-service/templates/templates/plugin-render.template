import type { TimelinePlugin } from "../../plugins/types";
import { PluginType } from "../../plugins/types";

export const {{EXPORT_NAME}}: TimelinePlugin = {
  metadata: {
    name: "{{METADATA_NAME}}",
    version: "{{VERSION}}",
    description: "{{DESCRIPTION}}",
    type: PluginType.RENDER,
  },
  activate(context) {
    context.api.registerRenderLayer({
      name: "{{METADATA_NAME}}-layer",
      position: "overlay",
      render: (ctx, _canvas, _config, _state) => {
        // TODO: implement custom rendering
        ctx.save();
        // ... drawing logic
        ctx.restore();
      },
    });
  },
  deactivate(context) {
    context.api.unregisterRenderLayer("{{METADATA_NAME}}-layer");
  },
};
