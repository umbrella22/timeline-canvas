# Timeline Canvas

A powerful, high-performance timeline component built with HTML5 Canvas and TypeScript.

## Features

- 🚀 **High Performance**: Built with Canvas API for smooth rendering of large datasets.
- 🎨 **Themable**: Built-in Light and Dark themes, with support for custom themes.
- 🖱️ **Interactive**:
  - Drag and drop events to move them.
  - Resize events from both ends.
  - Split events with double-click.
  - Zooming (Ctrl/Cmd + Scroll) and Panning.
  - Context menu support.
- 📏 **Smart Guides**: Alignment guides and snapping for precise event placement.
- ⏱️ **Time Indicator**: Draggable time head with snapping support.
- 🔌 **Plugin System**: Extensible architecture with built-in plugins for themes, context menus, and more.
- 📝 **TypeScript**: Written in TypeScript with full type definitions.

## Installation

```bash
npm install timeline-canvas
# or
pnpm add timeline-canvas
# or
yarn add timeline-canvas
```

## Basic Usage

1. Create a container with a canvas element in your HTML:

```html
<div style="width: 100%; height: 500px;">
  <canvas id="timeline-canvas"></canvas>
</div>
```

1. Initialize the Timeline:

```typescript
import { Timeline } from "timeline-canvas";

// Initialize
const timeline = new Timeline("timeline-canvas", {
  startTime: 0,
  endTime: 100,
  trackHeight: 40,
  // ... other options
});

// Add a track
timeline.addTrack();

// Add an event (trackIndex, startTime, endTime, title)
timeline.addEvent(0, 10, 30, "My Event", "Description");
```

## Configuration

The `Timeline` constructor accepts an options object:

```typescript
interface TimelineOptions {
  // Dimensions
  canvasHeight?: number;
  trackHeight?: number;
  trackMargin?: number;
  timelineHeight?: number;

  // Time Settings
  startTime?: number;
  endTime?: number;
  secondWidth?: number; // Pixels per second
  snapInterval?: number;
  snapToSeconds?: boolean;

  // Features
  enableTimeIndicator?: boolean;
  enableEventResize?: boolean;
  enableEventSplit?: boolean;
  enableContextMenu?: boolean;
  readOnly?: boolean;
  autoAddTrack?: boolean;

  // Styling
  colors?: Partial<TimelineColors>;
  eventTextStyle?: Partial<EventTextStyle>;
  theme?: TimelinePlugin; // Initial theme

  // Callbacks
  onEventAdd?: (data: EventAddData) => void;
  onEventUpdate?: (data: EventUpdateData) => void;
  onEventClick?: (data: EventClickData) => void;
  // ... and more
}
```

## API Reference

### Core Methods

- **`addTrack()`**: Adds a new empty track.
- **`removeTrack()`**: Removes the last track.
- **`addEvent(trackIndex, startTime, endTime, title, ...)`**: Adds an event to a specific track.
- **`updateEvent(trackIndex, eventIndex, updates)`**: Updates an existing event.
- **`deleteEvent(trackIndex, eventIndex)`**: Deletes an event.
- **`loadData(data)`**: Loads tracks and events from a JSON object.
- **`setZoomLevel(level)`**: Sets the zoom level (1.0 is default).
- **`setTimeIndicator(seconds)`**: Moves the time indicator to a specific time.
- **`setTheme('light' | 'dark')`**: Switches between built-in themes.

### Plugins

The library comes with several built-in plugins:

- **`DarkThemePlugin`**: Dark mode theme.
- **`LightThemePlugin`**: Light mode theme (default).
- **`ContextMenuPlugin`**: Adds right-click context menu support.
- **`PerformanceOverlayPlugin`**: Displays FPS and render time for debugging.
- **`EventMediaPlugin`**: Support for rendering media (images, waveforms) inside events.

Usage:

```typescript
import { Timeline, PerformanceOverlayPlugin } from "timeline-canvas";

const timeline = new Timeline("canvas-id");
timeline.usePlugin(new PerformanceOverlayPlugin());
```

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build the library
pnpm build

# Run documentation site
pnpm docs:dev
```

## License

MIT
