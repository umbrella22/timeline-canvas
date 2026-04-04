import { Logger } from "./Logger";

export class ErrorHandler {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  throw(message: string): never {
    this.logger.error(message);
    throw new Error(message);
  }

  debug(message: string, error: unknown): void {
    this.logger.error(message, error);
  }

  debugIf(enabled: boolean, message: string, error: unknown): void {
    if (!enabled) return;
    this.debug(message, error);
  }

  fail(enabled: boolean, message: string, error: unknown): false {
    this.debugIf(enabled, message, error);
    return false;
  }

  error(message: string): void {
    this.logger.error(message);
  }

  warn(message: string): void {
    this.logger.warn(message);
  }
}
