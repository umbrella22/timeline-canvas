export type LogLevel = "debug" | "info" | "warn" | "error";

export class Logger {
  private enabled: boolean;
  private level: LogLevel;
  private prefix: string;

  constructor(options?: { enabled?: boolean; level?: LogLevel; prefix?: string }) {
    this.enabled = options?.enabled ?? true;
    this.level = options?.level ?? "info";
    this.prefix = options?.prefix ?? "Timeline";
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  private rank(level: LogLevel): number {
    switch (level) {
      case "debug":
        return 10;
      case "info":
        return 20;
      case "warn":
        return 30;
      case "error":
        return 40;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.enabled && this.rank(level) >= this.rank(this.level);
  }

  debug(...args: unknown[]): void {
    if (!this.shouldLog("debug")) return;
    console.debug(this.prefix, ...args);
  }

  info(...args: unknown[]): void {
    if (!this.shouldLog("info")) return;
    console.info(this.prefix, ...args);
  }

  warn(...args: unknown[]): void {
    if (!this.shouldLog("warn")) return;
    console.warn(this.prefix, ...args);
  }

  error(...args: unknown[]): void {
    if (!this.shouldLog("error")) return;
    console.error(this.prefix, ...args);
  }
}