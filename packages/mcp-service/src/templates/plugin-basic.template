import type { TimelinePlugin } from "../../plugins/types";
import { PluginType } from "../../plugins/types";

export const {{EXPORT_NAME}}: TimelinePlugin = {
  metadata: {
    name: "{{METADATA_NAME}}",
    version: "{{VERSION}}",
    description: "{{DESCRIPTION}}",
    type: PluginType.{{PLUGIN_TYPE_KEY}},
  },
{{#IF hasInit}}
  async init(_context) {
    // TODO: initialization logic
  },
{{/IF}}
  activate(_context) {
{{#IF renderLayer}}
    _context.api.registerRenderLayer({
      name: "{{METADATA_NAME}}-layer",
      position: "overlay",
      render: (_ctx, _canvas, _config, _state) => {
        // TODO: implement render
      },
    });
{{/IF}}
{{#IF eventHandler}}
    // TODO: register event handlers
    // _context.api.registerEventHandler('eventName', handler);
{{/IF}}
  },
  deactivate(_context) {
{{#IF renderLayer}}
    _context.api.unregisterRenderLayer("{{METADATA_NAME}}-layer");
{{/IF}}
  },
{{#IF lifecycle}}
  destroy(_context) {
    // TODO: cleanup resources
  },
{{/IF}}
};
