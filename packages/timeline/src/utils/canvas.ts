export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  stroke = false
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  if (stroke) {
    ctx.stroke();
  } else {
    ctx.fill();
  }
}

export function getTimeX(
  time: number,
  startTime: number,
  startPaddingTime: number,
  secondWidth: number,
  zoomLevel: number,
  scrollX: number
): number {
  return startPaddingTime + (time - startTime) * secondWidth * zoomLevel - scrollX;
}

export function getEventX(
  event: { startTime: number },
  config: { startTime: number; startPaddingTime: number; secondWidth: number },
  state: { zoomLevel: number; scrollX: number }
): number {
  return getTimeX(event.startTime, config.startTime, config.startPaddingTime, config.secondWidth, state.zoomLevel, state.scrollX);
}