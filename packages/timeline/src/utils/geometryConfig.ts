import type { TimelineConfig } from "../types";

/** Reject invalid inputs before installing listeners or computing viewport geometry. */
export function validateGeometryConfig(config: TimelineConfig): void {
  const positive = ["secondWidth", "trackHeight", "minAutoFitZoom", "maxAutoFitZoom"] as const;
  const nonnegative = [
    "timelineHeight",
    "trackMargin",
    "firstTrackTopMargin",
    "startPaddingTime",
    "endPaddingTime",
    "resizeHandleWidth",
    "minEventDuration",
    "snapInterval",
    "secondPrecisionZoomThreshold",
    "timeIndicatorWidth",
    "timeIndicatorSnapThreshold",
    "timeIndicatorHeadSize",
    "timeIndicatorTriangleHeight",
    "guideLineSnapThreshold",
  ] as const;
  for (const key of positive) {
    if (!Number.isFinite(config[key]) || config[key] <= 0)
      throw new RangeError(`${key} must be finite and positive`);
  }
  for (const key of nonnegative) {
    if (!Number.isFinite(config[key]) || config[key] < 0)
      throw new RangeError(`${key} must be finite and non-negative`);
  }
  if (
    !Number.isFinite(config.startTime) ||
    !Number.isFinite(config.endTime) ||
    config.endTime <= config.startTime
  ) {
    throw new RangeError("endTime must be finite and greater than a finite startTime");
  }
  if (
    !Number.isFinite(
      (config.endTime + config.endPaddingTime - config.startTime) * config.secondWidth,
    )
  ) {
    throw new RangeError("timeline width exceeds the finite coordinate range");
  }
  if (
    config.canvasHeight !== undefined &&
    (!Number.isFinite(config.canvasHeight) || config.canvasHeight < 0)
  ) {
    throw new RangeError("canvasHeight must be finite and non-negative");
  }
  if (config.scale != null && (!Number.isFinite(config.scale) || config.scale <= 0)) {
    throw new RangeError("scale must be finite and positive");
  }
  if (!Number.isSafeInteger(config.scaleSplitCount) || config.scaleSplitCount <= 0) {
    throw new RangeError("scaleSplitCount must be a positive integer");
  }
}
