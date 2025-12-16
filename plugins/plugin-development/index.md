# 插件开发教程

```mermaid
graph TB
    %% 核心组件
    subgraph "Timeline 核心"
        TL[Timeline]
        PM[PluginManager]
        RM[RenderManager]
        RP[RenderPipeline]
    end

    subgraph "插件系统"
        PM --> API[PluginAPI]
        API --> CTX[PluginContext]
        CTX --> PLUGINS[插件实例]
    end

    subgraph "插件类型"
        PLUGINS --> THEME[主题插件]
        PLUGINS --> RENDER[渲染插件]
        PLUGINS --> EVENT[事件插件]
        PLUGINS --> TOOL[工具插件]
        PLUGINS --> EXTENSION[扩展插件]
    end

    subgraph "内置插件"
        THEME --> DARK[DarkThemePlugin]
        THEME --> LIGHT[LightThemePlugin]
        RENDER --> CONTEXT_MENU[ContextMenuPlugin]
        RENDER --> PERFORMANCE[PerformanceOverlayPlugin]
        EVENT --> EVENT_MEDIA[EventMediaPlugin]
        EVENT --> EVENT_TOOLTIP[EventTooltipPlugin]
        TOOL --> MUTEX_GUARD[MutexGuardPlugin]
    end

    subgraph "渲染系统"
        RM --> RP
        RP --> LAYERS[渲染层]
        LAYERS --> BACKGROUND[背景层]
        LAYERS --> TIMELINE[时间轴层]
        LAYERS --> TRACKS[轨道层]
        LAYERS --> GUIDELINES[参考线层]
        LAYERS --> INDICATOR[指示器层]
        LAYERS --> INTERACTION[交互层]
        LAYERS --> SCROLLBAR[滚动条层]
        LAYERS --> OVERLAY[覆盖层]
    end

    %% 数据流
    PM -->|注册渲染层| RM
    PM -->|事件处理| TL
    PLUGINS -->|通过API| PM
    RM -->|渲染调用| LAYERS
    BACKGROUND -->|插件渲染| PM
    OVERLAY -->|插件渲染| PM

    %% 样式定义
    classDef core fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef plugin fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef render fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef builtin fill:#fff3e0,stroke:#e65100,stroke-width:2px

    class TL,PM,RM,RP core
    class API,CTX,PLUGINS,THEME,RENDER,EVENT,TOOL,EXTENSION plugin
    class RM,RP,LAYERS,BACKGROUND,TIMELINE,TRACKS,GUIDELINES,INDICATOR,INTERACTION,SCROLLBAR,OVERLAY render
    class DARK,LIGHT,CONTEXT_MENU,PERFORMANCE,EVENT_MEDIA,EVENT_TOOLTIP,MUTEX_GUARD builtin
```

本教程将带你从零开始开发一个 Timeline Canvas 插件，详细介绍插件生命周期、API 使用方法和最佳实践。

## 1. 插件基础概念

### 1.1 什么是插件

插件是扩展 Timeline Canvas 功能的独立模块，可以：

* 添加新的渲染层
* 监听和处理事件
* 提供自定义验证逻辑
* 扩展时间轴的交互能力

### 1.2 插件类型

```typescript
enum PluginType {
  RENDER = "render", // 渲染插件
  EVENT_HANDLER = "event_handler", // 事件处理器
  DATA_SOURCE = "data_source", // 数据源
  THEME = "theme", // 主题
  TOOL = "tool", // 工具
  EXTENSION = "extension", // 扩展
}
```

### 1.3 插件优先级

```typescript
enum PluginPriority {
  LOW = 0, // 低优先级
  NORMAL = 50, // 普通优先级
  HIGH = 100, // 高优先级
  CRITICAL = 200, // 关键优先级
}
```
