# builtin-plugin

此目录是 `timeline-canvas/builtin-plugin/*` 子路径导出的入口层。

- 这里的文件只负责把稳定的导出路径映射到 `src/plugins/builtin/` 下的真实实现
- 保留这层转发可以避免内部目录调整时影响外部按子路径导入的代码
- 如果需要修改内置插件逻辑，请优先编辑 `d:/workspaces/timeline-canvas/packages/timeline/src/plugins/builtin/`

示例：

```ts
import { ContextMenuPlugin } from "timeline-canvas/builtin-plugin/ContextMenuPlugin";
```
