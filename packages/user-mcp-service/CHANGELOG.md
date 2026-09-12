# timeline-canvas-user-mcp

## 0.1.1

### Patch Changes

- 7cf401b: 将 timeline-canvas 1.6.0 标记为已验证版本（此前 1.5.0），旧版本保持兼容标记。
  
  Mark timeline-canvas 1.6.0 as a tested version (previously 1.5.0); older versions keep their compatibility marking.

## 0.1.0

### New Features

- Provide three read-only MCP tools for application integration guides, external plugin generation, and static plugin validation.
- Include Vanilla TypeScript, React, and Vue examples with resource cleanup and container resizing.
- Generate basic, render, and event-handler plugin factories using public timeline-canvas APIs.
- Validate exported plugins against the consumer project's installed declarations without executing plugin code. Report type and contract checks separately from lifecycle review and runtime verification.
- Verify templates against timeline-canvas 1.4.1 and 1.5.0, including source and packaged MCP protocol checks.
