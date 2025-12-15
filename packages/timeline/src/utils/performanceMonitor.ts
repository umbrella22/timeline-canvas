export interface PerformanceStats {
  average: number;
  min: number;
  max: number;
  count: number;
  total: number;
}

export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private startTimes: Map<string, number> = new Map();
  private enabled: boolean = false;
  private maxSamples: number = 100;
  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }
  public enable(): void {
    this.enabled = true;
  }
  public disable(): void {
    this.enabled = false;
  }
  public startMeasurement(name: string): void {
    if (!this.enabled) return;
    this.startTimes.set(name, performance.now());
  }
  public endMeasurement(name: string): void {
    if (!this.enabled) return;
    const startTime = this.startTimes.get(name);
    if (startTime === undefined) return;
    const duration = performance.now() - startTime;
    if (!this.metrics.has(name)) this.metrics.set(name, []);
    const samples = this.metrics.get(name)!;
    samples.push(duration);
    if (samples.length > this.maxSamples) samples.shift();
    this.startTimes.delete(name);
  }
  public getAverage(name: string): number {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) return 0;
    return metrics.reduce((sum, val) => sum + val, 0) / metrics.length;
  }
  public getMin(name: string): number {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) return 0;
    return Math.min(...metrics);
  }
  public getMax(name: string): number {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) return 0;
    return Math.max(...metrics);
  }
  public getStats(name: string): PerformanceStats | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) return null;
    return {
      average: this.getAverage(name),
      min: this.getMin(name),
      max: this.getMax(name),
      count: metrics.length,
      total: metrics.reduce((sum, val) => sum + val, 0),
    };
  }
  public getAllStats(): Map<string, PerformanceStats> {
    const allStats = new Map<string, PerformanceStats>();
    this.metrics.forEach((_, name) => {
      const stats = this.getStats(name);
      if (stats) allStats.set(name, stats);
    });
    return allStats;
  }
  public clear(): void {
    this.metrics.clear();
    this.startTimes.clear();
  }
  public clearMetric(name: string): void {
    this.metrics.delete(name);
    this.startTimes.delete(name);
  }
  public getFPS(): number {
    const drawStats = this.getStats("draw");
    if (!drawStats || drawStats.average === 0) return 0;
    return 1000 / drawStats.average;
  }
}