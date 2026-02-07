---
title: Usage & Examples
---

This page provides copy-paste friendly examples covering common configuration, interactions, and plugin usage.

## Basic Configuration

### Timeline Configuration (Seconds-based)

```ts
const timeline = new Timeline("timelineCanvas", {
  startTime: 0,
  endTime: 3600,
  secondWidth: 0.022,
  trackHeight: 46,
  trackMargin: 10,
  enableEventResize: true,
  enableEventSplit: true,
  enableTimeIndicator: true,
});
```

### Event Time Model

Timeline Canvas uses a seconds-based time model. All time values are relative seconds from the timeline start, not absolute timestamps.

#### How the time model works

Timeline Canvas uses relative time (seconds-based), not absolute timestamps:

- **startTime**: timeline start, usually `0` seconds
- **endTime**: timeline end in seconds
- **Event time**: all events use `startTime` and `endTime` as seconds from the start

#### Time conversion examples

```ts
// Timeline config example (seconds-based):
const timelineConfig = {
  startTime: 0, // start (0s)
  endTime: 3600, // end (1 hour = 3600s)
};

// Event time examples:
const events = [
  {
    startTime: 0, // starts at 0s
    endTime: 900, // ends at 15m (15*60=900s)
    title: "Day Shift",
  },
  {
    startTime: 1800, // starts at 30m (30*60=1800s)
    endTime: 3600, // ends at 1h (1*3600=3600s)
    title: "Night Shift",
  },
];
```

#### Common conversions

- 1 minute = 60 seconds
- 1 hour = 3600 seconds
- 1 day = 86400 seconds
- Work hours (9–18): `startTime: 32400`, `endTime: 64800` (9*3600, 18*3600)
- Crossing midnight: `startTime: 82800`, `endTime: 90000` (23:00 to next day 01:00)

```ts
// Load data (each track contains an `events` list)
timeline.loadData({
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 900,
          title: "Development Phase",
          description: "Core feature development",
        },
      ],
    },
    { events: [{ startTime: 1800, endTime: 1800, title: "Requirements Review" }] },
  ],
});
```

## Interactions

### Zoom & Time Indicator

```ts
// Zoom by a factor
timeline.zoom(1.2);
timeline.zoom(0.8);

// Set time indicator position (seconds)
timeline.setTimeIndicator(600);
```

### Event Operations

```ts
// Add an event (track index, start/end seconds, title, etc.)
timeline.addEvent(0, 1200, 1500, "New Task");

// Update an event (track index + event index)
timeline.updateEvent(0, 0, { title: "Updated Title" });

// Delete an event (track index + event index)
timeline.deleteEvent(0, 0);
```

## Plugin Examples

### Performance Overlay Plugin

```ts
import { PerformanceOverlayPlugin } from "timeline-canvas/plugins";

// Basic usage
timeline.usePlugin(PerformanceOverlayPlugin);

// The performance overlay and debug mode are controlled by TimelineConfig:
// enablePerformanceMonitor: true
// debug: true
```

### Context Menu Plugin

```ts
import { ContextMenuPlugin } from "timeline-canvas/plugins";

timeline.config.enableContextMenu = true;
timeline.config.contextMenuItems = [
  { type: "detail", name: "View details" },
  { type: "delete", name: "Delete" },
];

await timeline.usePlugin(ContextMenuPlugin());

// If you want to fully take over menu rendering with HTML, pass `htmlTemplate` (or use `config.contextMenuHtml`)
await timeline.usePlugin(ContextMenuPlugin({ htmlTemplate: "<div>...</div>" }));
```

### Theme Plugins

```ts
import { LightThemePlugin, DarkThemePlugin } from "timeline-canvas/plugins";

// Use light theme
await timeline.usePlugin(LightThemePlugin);

// Or use dark theme
await timeline.usePlugin(DarkThemePlugin);

// Or use the convenience method to switch themes
await timeline.setTheme("dark");
```

### Media Plugin

```ts
import { EventMediaPlugin } from "timeline-canvas/plugins";

await timeline.usePlugin(EventMediaPlugin());

// Load events with media
timeline.loadData({
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 3600,
          title: "Media Event",
          media: {
            images: [
              {
                src: "path/to/image.jpg",
                fit: "cover", // 'cover', 'contain', 'stretch'
                opacity: 0.8,
              },
            ],
            waveform: {
              data: [0.1, 0.5, -0.2], // audio sample data
              color: "#1890ff",
              opacity: 0.6,
            },
          },
        },
      ],
    },
  ],
});
```

## Event Callbacks (Recommended)

```ts
const timeline = new Timeline("timelineCanvas", {
  onEventAdd: (data) => console.log("Event added", data),
  onEventUpdate: (data) => console.log("Event updated", data),
  onEventDelete: (data) => console.log("Event deleted", data),
  onEventMove: (data) => console.log("Event moved", data),
  onEventClick: (data) => console.log("Event clicked", data),
  onEventEdit: (data) => console.log("Event edited", data),
  onTimeIndicatorHighlight: (data) => console.log("Time indicator highlight", data),
  onContextMenu: (data) => console.log("Context menu triggered", data),
  onTrackAdd: (track) => console.log("Track added", track),
  onTrackRemove: (track) => console.log("Track removed", track),
  onTimeIndicatorMove: (data) => console.log("Time indicator moved", data),
  onZoom: (data) => console.log("Zoom changed", data),
  onStatusChange: (text) => console.log("Status", text),
});
```

### Callback Payload Reference

```typescript
// Event add callback payload
interface EventAddData {
  trackIndex: number;
  event: TimelineEvent;
}

// Event update callback payload
interface EventUpdateData {
  type?: "resize" | "split";
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
  oldEvent?: TimelineEvent;
  firstEvent?: TimelineEvent; // only present when type is "split"
  secondEvent?: TimelineEvent; // only present when type is "split"
}

// Event click callback payload
interface EventClickData {
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
  trackName: string;
  formattedTimeRange: string;
}

// Context menu callback payload
interface ContextMenuData {
  menuType: string;
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
}
```

## Theme Switching

```javascript
// Initialize with light theme
timeline.usePlugin(LightThemePlugin);

// Switch to dark theme at runtime
timeline.setTheme("dark");

// Switch back to light
timeline.setTheme("light");
```

## Responsive Layout

```javascript
// Resize manually
window.addEventListener("resize", () => {
  const container = document.getElementById("timeline-container");
  if (container) {
    timeline.setCanvasSize(container.clientWidth, container.clientHeight);
  }
});
```
