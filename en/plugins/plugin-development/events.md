## Event Types

### Render events

* `render:background` - background layer render
* `render:overlay` - overlay layer render
* `render:event:media` - event media render

### Validation events

* `validate:event:move` - validate event move
* `validate:event:add` - validate event add
* `validate:event:split` - validate event split

### Interaction events

* `event:click` - event click
* `event:highlight` - event highlight
* `zoom:change` - zoom level change
* `track:add` - track added
* `track:remove` - track removed

## Handlers

### Render handler

```ts
renderOverlay(ctx, canvas, config, state) {
  // draw custom content
  ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
  ctx.fillRect(0, 0, 100, 100);
}
```

### Validation handler

```ts
validateEventMove(payload) {
  const { fromTrackIndex, fromEventIndex, toTrackIndex, newStartTime, duration } = payload;

  // custom validation logic
  if (newStartTime < 0) {
    return false; // block the move
  }

  return true; // allow the move
}
```

## Priority Order

Events are processed in plugin priority order:

1. CRITICAL (200)
2. HIGH (100)
3. NORMAL (50)
4. LOW (0)
