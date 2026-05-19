import type * as vscode from "vscode";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
  show(): void;
}

export class OutputLogger implements Logger {
  public constructor(
    private readonly output: vscode.OutputChannel,
    private level: LogLevel = "debug",
  ) {}

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  public debug(message: string, data?: unknown): void {
    this.write("debug", message, data);
  }

  public info(message: string, data?: unknown): void {
    this.write("info", message, data);
  }

  public warn(message: string, data?: unknown): void {
    this.write("warn", message, data);
  }

  public error(message: string, data?: unknown): void {
    this.write("error", message, data);
  }

  public show(): void {
    this.output.show();
  }

  private write(level: LogLevel, message: string, data?: unknown): void {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.level]) {
      return;
    }

    const payload = data === undefined ? "" : ` ${safeSerialize(data)}`;
    this.output.appendLine(`[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${payload}`);
  }
}

export class MemoryLogger implements Logger {
  public readonly entries: Array<{ level: LogLevel; message: string; data?: unknown }> = [];

  public constructor(private readonly level: LogLevel = "debug") {}

  public debug(message: string, data?: unknown): void {
    this.write("debug", message, data);
  }

  public info(message: string, data?: unknown): void {
    this.write("info", message, data);
  }

  public warn(message: string, data?: unknown): void {
    this.write("warn", message, data);
  }

  public error(message: string, data?: unknown): void {
    this.write("error", message, data);
  }

  public show(): void {
    return;
  }

  private write(level: LogLevel, message: string, data?: unknown): void {
    if (LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[this.level]) {
      this.entries.push({ level, message, data: sanitizeForLog(data) });
    }
  }
}

export function safeSerialize(data: unknown): string {
  return JSON.stringify(sanitizeForLog(data));
}

export function sanitizeForLog(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForLog(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = "[redacted]";
    } else {
      sanitized[key] = sanitizeForLog(value);
    }
  }

  return sanitized;
}

function isSensitiveKey(key: string): boolean {
  return /password|secret|token|key|credential|dsn|url|value/i.test(key) && key !== "file" && key !== "keyName";
}
