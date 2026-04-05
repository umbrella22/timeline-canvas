import type { GuideLine, TimelineConfig, TimelineState } from "../../types";

function createGuideLineCacheKey(
  fromTrackIndex: number,
  eventIndex: number,
  toTrackIndex: number,
  newStartTime: number,
  duration: number
): string {
  return `${fromTrackIndex}-${eventIndex}-${toTrackIndex}-${newStartTime.toFixed(
    3
  )}-${duration.toFixed(3)}`;
}

export class GuideLineService {
  private readonly guideLinesCache = new Map<string, GuideLine[]>();
  private guideLinesCacheTimestamp = 0;

  constructor(
    private readonly config: TimelineConfig,
    private readonly state: TimelineState,
    private readonly cacheTtl = 500
  ) {}

  public calculateGuideLines(
    fromTrackIndex: number,
    eventIndex: number,
    toTrackIndex: number,
    newStartTime: number,
    duration: number
  ): GuideLine[] {
    const cacheKey = createGuideLineCacheKey(
      fromTrackIndex,
      eventIndex,
      toTrackIndex,
      newStartTime,
      duration
    );
    const now = Date.now();

    if (now - this.guideLinesCacheTimestamp < this.cacheTtl) {
      const cachedGuideLines = this.guideLinesCache.get(cacheKey);
      if (cachedGuideLines) {
        return cachedGuideLines;
      }
    } else {
      this.clearCache();
      this.guideLinesCacheTimestamp = now;
    }

    const guideLines: GuideLine[] = [];
    const threshold = this.config.guideLineSnapThreshold;
    const newEndTime = newStartTime + duration;

    for (let trackIndex = 0; trackIndex < this.state.tracks.length; trackIndex++) {
      const track = this.state.tracks[trackIndex];
      if (!track || track.events.length === 0) {
        continue;
      }

      for (let candidateEventIndex = 0; candidateEventIndex < track.events.length; candidateEventIndex++) {
        if (
          trackIndex === fromTrackIndex &&
          candidateEventIndex === eventIndex
        ) {
          continue;
        }

        const otherEvent = track.events[candidateEventIndex];
        if (
          otherEvent.endTime < newStartTime - threshold ||
          otherEvent.startTime > newEndTime + threshold
        ) {
          continue;
        }

        this.addGuideLineIfMatched(
          guideLines,
          otherEvent.startTime,
          newStartTime,
          "start",
          trackIndex,
          threshold
        );
        this.addGuideLineIfMatched(
          guideLines,
          otherEvent.endTime,
          newEndTime,
          "end",
          trackIndex,
          threshold
        );
        this.addGuideLineIfMatched(
          guideLines,
          otherEvent.endTime,
          newStartTime,
          "end",
          trackIndex,
          threshold
        );
        this.addGuideLineIfMatched(
          guideLines,
          otherEvent.startTime,
          newEndTime,
          "start",
          trackIndex,
          threshold
        );
      }
    }

    this.guideLinesCache.set(cacheKey, guideLines);
    return guideLines;
  }

  public clearCache(): void {
    this.guideLinesCache.clear();
  }

  private addGuideLineIfMatched(
    guideLines: GuideLine[],
    referenceTime: number,
    targetTime: number,
    type: GuideLine["type"],
    trackIndex: number,
    threshold: number
  ): void {
    if (Math.abs(referenceTime - targetTime) >= threshold) {
      return;
    }

    const existingGuideLine = guideLines.find(
      (guideLine) =>
        Math.abs(guideLine.time - referenceTime) < 0.0001 &&
        guideLine.type === type
    );

    if (!existingGuideLine) {
      guideLines.push({
        time: referenceTime,
        type,
        trackIndices: [trackIndex],
      });
      return;
    }

    if (!existingGuideLine.trackIndices.includes(trackIndex)) {
      existingGuideLine.trackIndices.push(trackIndex);
    }
  }
}
