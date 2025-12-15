export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * 预定义的日志颜色主题
 */
export const LogColors = {
  // 渲染管线相关 - 蓝色系
  pipeline: "color: #2196F3; font-weight: bold;",
  pipelineLayer: "color: #64B5F6;",
  pipelineSkip: "color: #90A4AE;",

  // 状态机相关 - 绿色系
  stateMachine: "color: #4CAF50; font-weight: bold;",
  stateTransition: "color: #81C784;",
  stateEnter: "color: #A5D6A7;",
  stateExit: "color: #C8E6C9;",

  // 事件渲染相关 - 橙色系
  eventRender: "color: #FF9800; font-weight: bold;",
  eventInfo: "color: #FFB74D;",
  eventSkip: "color: #FFCC80;",

  // 数据更新相关 - 紫色系
  dataUpdate: "color: #9C27B0; font-weight: bold;",
  dataInfo: "color: #BA68C8;",

  // 调度器相关 - 青色系
  scheduler: "color: #00BCD4; font-weight: bold;",
  schedulerInfo: "color: #4DD0E1;",

  // 插件相关 - 粉色系
  plugin: "color: #E91E63; font-weight: bold;",
  pluginInfo: "color: #F48FB1;",

  // 通用
  reset: "color: inherit; font-weight: normal;",
} as const;

/**
 * 全局日志配置
 */
interface GlobalLogConfig {
  enabled: boolean;
  level: LogLevel;
}

/**
 * 全局日志配置管理
 */
const globalConfig: GlobalLogConfig = {
  enabled: true,
  level: "info",
};

/**
 * Logger 实例缓存
 */
const loggerInstances = new Map<string, Logger>();

export class Logger {
  private enabled: boolean;
  private level: LogLevel;
  private prefix: string;
  private useGlobalConfig: boolean;

  constructor(options?: {
    enabled?: boolean;
    level?: LogLevel;
    prefix?: string;
    useGlobalConfig?: boolean;
  }) {
    this.enabled = options?.enabled ?? true;
    this.level = options?.level ?? "info";
    this.prefix = options?.prefix ?? "Timeline";
    this.useGlobalConfig = options?.useGlobalConfig ?? true;
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
    // 如果使用全局配置，则检查全局开关
    if (this.useGlobalConfig) {
      if (!globalConfig.enabled) return false;
      return this.rank(level) >= this.rank(globalConfig.level);
    }
    return this.enabled && this.rank(level) >= this.rank(this.level);
  }

  debug(...args: unknown[]): void {
    if (!this.shouldLog("debug")) return;
    console.debug(`[${this.prefix}]`, ...args);
  }

  /**
   * 带颜色的 debug 日志
   * @param color LogColors 中的颜色样式
   * @param label 标签文字
   * @param args 额外参数
   */
  debugStyled(color: string, label: string, ...args: unknown[]): void {
    if (!this.shouldLog("debug")) return;
    console.debug(`%c[${this.prefix}] ${label}`, color, ...args);
  }

  info(...args: unknown[]): void {
    if (!this.shouldLog("info")) return;
    console.info(`[${this.prefix}]`, ...args);
  }

  warn(...args: unknown[]): void {
    if (!this.shouldLog("warn")) return;
    console.warn(`[${this.prefix}]`, ...args);
  }

  error(...args: unknown[]): void {
    if (!this.shouldLog("error")) return;
    console.error(`[${this.prefix}]`, ...args);
  }
}

/**
 * 获取或创建指定模块的 Logger 实例
 * @param module 模块名称
 * @returns Logger 实例
 */
export function getLogger(module: string): Logger {
  let logger = loggerInstances.get(module);
  if (!logger) {
    logger = new Logger({
      prefix: module,
      useGlobalConfig: true,
    });
    loggerInstances.set(module, logger);
  }
  return logger;
}

/**
 * 配置全局日志设置
 * @param config 全局配置
 */
export function configureGlobalLogger(config: Partial<GlobalLogConfig>): void {
  if (config.enabled !== undefined) {
    globalConfig.enabled = config.enabled;
  }
  if (config.level !== undefined) {
    globalConfig.level = config.level;
  }
}

/**
 * 获取当前全局日志配置
 */
export function getGlobalLogConfig(): Readonly<GlobalLogConfig> {
  return { ...globalConfig };
}
