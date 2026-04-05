export function formatTime(seconds: number, showSeconds = true): string {
  const totalSecs = Math.round(seconds);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (showSeconds) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  } else {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }
}

export function getCurrentTime(): number {
  const now = new Date();
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

export function getSnapInterval(
  zoomLevel: number,
  snapInterval: number,
  snapToSeconds: boolean,
  secondPrecisionThreshold: number,
  scale?: number | null,
  scaleSplitCount?: number
): number {
  // 如果设置了自定义刻度，优先使用刻度细分间隔
  if (scale != null && scale > 0) {
    const splitCount = Math.max(1, Math.floor(scaleSplitCount ?? 10));
    const subInterval = scale / splitCount;
    // 根据缩放级别决定吸附到主刻度还是细分刻度
    if (zoomLevel >= secondPrecisionThreshold) {
      return subInterval; // 高缩放：吸附到细分刻度
    }
    return scale; // 低缩放：吸附到主刻度
  }

  if (!snapToSeconds || zoomLevel < secondPrecisionThreshold) {
    return snapInterval * 60;
  }
  const snapConfigs = [
    { threshold: 10, seconds: 0.5 },
    { threshold: 8, seconds: 1 },
    { threshold: 5, seconds: 2 },
    { threshold: 3, seconds: 5 },
    { threshold: 2, seconds: 10 },
    { threshold: 1.5, seconds: 15 },
    { threshold: 0, seconds: 30 },
  ];
  const config = snapConfigs.find((c) => zoomLevel >= c.threshold);
  return (config?.seconds ?? 30);
}

export function snapToInterval(seconds: number, snapInterval: number): number {
  return Math.round(seconds / snapInterval) * snapInterval;
}

export function fixFloatPrecision(value: number, decimals = 3): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

export function formatTimeRange(startTime: number, endTime: number): string {
  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}

export function formatDuration(duration: number, label?: string): string {
  const accurateDuration = fixFloatPrecision(duration);
  const formattedDuration = formatTime(accurateDuration);

  if (!label) {
    return formattedDuration;
  }

  return `${label} ${formattedDuration}`;
}
