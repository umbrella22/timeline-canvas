# Renderers 文件夹结构说明

## 📁 core/ - 核心渲染系统

包含渲染架构的核心组件：

- **types.ts** - 渲染器接口定义、渲染上下文、图层类型等
- **RenderPipeline.ts** - 渲染管道，负责管理和执行多个渲染器
- **index.ts** - 统一导出核心模块

## 📁 layers/ - 图层渲染器

包含各个图层的渲染器类（新架构）：

- **TimelineRenderer.ts** - 时间轴渲染器（时间刻度和标签）
- **TracksRenderer.ts** - 轨道渲染器（轨道背景和事件）
- **EventsRenderer.ts** - 事件渲染器（负责绘制具体事件，被 TracksRenderer 调用）
- **IndicatorRenderer.ts** - 指示器渲染器（时间指示器）
- **GuideLinesRenderer.ts** - 辅助线渲染器（对齐辅助线）
- **ScrollbarRenderer.ts** - 滚动条渲染器
- **InteractionRenderer.ts** - 交互层渲染器（拖拽预览、选中状态）
- **index.ts** - 统一导出所有图层渲染器
