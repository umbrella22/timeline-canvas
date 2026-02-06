/**
 * Simple template engine for plugin scaffold generation.
 *
 * Supports:
 *  - Variable substitution: {{VAR_NAME}}
 *  - Conditional blocks:    {{#IF flag}}...{{/IF}}
 *  - Negative conditional:  {{#UNLESS flag}}...{{/UNLESS}}
 */

export class TemplateEngine {
  render(
    template: string,
    vars: Record<string, string | boolean>
  ): string {
    let result = template;

    // Process {{#IF flag}}...{{/IF}} blocks
    result = result.replace(
      /\{\{#IF\s+(\w+)\}\}([\s\S]*?)\{\{\/IF\}\}/g,
      (_match, key: string, body: string) => {
        return vars[key] ? body : "";
      }
    );

    // Process {{#UNLESS flag}}...{{/UNLESS}} blocks
    result = result.replace(
      /\{\{#UNLESS\s+(\w+)\}\}([\s\S]*?)\{\{\/UNLESS\}\}/g,
      (_match, key: string, body: string) => {
        return vars[key] ? "" : body;
      }
    );

    // Process {{VAR_NAME}} substitutions
    result = result.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      const val = vars[key];
      if (val === undefined) return `{{${key}}}`;
      return String(val);
    });

    // Clean up empty lines left by removed conditional blocks
    result = result.replace(/\n{3,}/g, "\n\n");

    return result;
  }
}
