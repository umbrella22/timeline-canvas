---
title: Plugin Development
---

> This section is for developers who want to extend Timeline Canvas, covering lifecycle, APIs, events, and best practices.

```mermaid
graph TB
    %% Core
    subgraph "Timeline Core"
        TL[Timeline]
        PM[PluginManager]
        RM[RenderManager]
        RP[RenderPipeline]
    end

    subgraph "Plugin System"
        PM --> API[PluginAPI]
        API --> CTX[PluginContext]
        CTX --> PLUGINS[Plugin Instances]
    end

    subgraph "Plugin Types"
        PLUGINS --> THEME[Theme Plugins]
        PLUGINS --> RENDER[Render Plugins]
        PLUGINS --> EVENT[Event Plugins]
        PLUGINS --> TOOL[Tool Plugins]
        PLUGINS --> EXTENSION[Extension Plugins]
    end

    subgraph "Built-in Plugins"
        THEME --> DARK[DarkThemePlugin]
        THEME --> LIGHT[LightThemePlugin]
        RENDER --> CONTEXT_MENU[ContextMenuPlugin]
        RENDER --> PERFORMANCE[PerformanceOverlayPlugin]
        EVENT --> EVENT_MEDIA[EventMediaPlugin]
        EVENT --> EVENT_TOOLTIP[EventTooltipPlugin]
        TOOL --> MUTEX_GUARD[MutexGuardPlugin]
    end

    subgraph "Rendering"
        RM --> RP
        RP --> LAYERS[Layers]
        LAYERS --> BACKGROUND[Background Layer]
        LAYERS --> TIMELINE[Timeline Layer]
        LAYERS --> TRACKS[Tracks Layer]
        LAYERS --> GUIDELINES[Guidelines Layer]
        LAYERS --> INDICATOR[Indicator Layer]
        LAYERS --> INTERACTION[Interaction Layer]
        LAYERS --> SCROLLBAR[Scrollbar Layer]
        LAYERS --> OVERLAY[Overlay Layer]
    end

    %% Data flow
    PM -->|register layers| RM
    PM -->|handle events| TL
    PLUGINS -->|via API| PM
    RM -->|render calls| LAYERS
    BACKGROUND -->|plugin render| PM
    OVERLAY -->|plugin render| PM

    %% Styles
    classDef core fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef plugin fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef render fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef builtin fill:#fff3e0,stroke:#e65100,stroke-width:2px

    class TL,PM,RM,RP core
    class API,CTX,PLUGINS,THEME,RENDER,EVENT,TOOL,EXTENSION plugin
    class RM,RP,LAYERS,BACKGROUND,TIMELINE,TRACKS,GUIDELINES,INDICATOR,INTERACTION,SCROLLBAR,OVERLAY render
    class DARK,LIGHT,CONTEXT_MENU,PERFORMANCE,EVENT_MEDIA,EVENT_TOOLTIP,MUTEX_GUARD builtin
```

This tutorial walks you through building a Timeline Canvas plugin from scratch, including lifecycle, API usage, and best practices.

## 1. Plugin Fundamentals

### 1.1 What is a plugin?

Plugins are independent modules that extend Timeline Canvas. They can:

- Add new render layers
- Listen to and handle events
- Provide custom validation logic
- Extend timeline interactions

### 1.2 Plugin types

```typescript
enum PluginType {
  RENDER = "render", // render plugin
  EVENT_HANDLER = "event_handler", // event handler
  DATA_SOURCE = "data_source", // data source
  THEME = "theme", // theme
  TOOL = "tool", // tool
  EXTENSION = "extension", // extension
}
```

### 1.3 Plugin priority

```typescript
enum PluginPriority {
  LOW = 0, // low priority
  NORMAL = 50, // normal
  HIGH = 100, // high
  CRITICAL = 200, // critical
}
```
