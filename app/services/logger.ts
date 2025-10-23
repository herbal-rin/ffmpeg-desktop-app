import pino from 'pino';
import * as path from 'path';
import * as fs from 'fs';
import { Logger, LogLevel } from '../shared/types';

/**
 * 基于 Pino 的日志服务实现
 */
export class PinoLogger implements Logger {
  private logger: pino.Logger;
  private logDir: string;

  constructor(logDir?: string) {
    this.logDir = logDir || this.getDefaultLogDir();
    this.ensureLogDir();
    
    const logFile = path.join(this.logDir, this.getLogFileName());
    
    this.logger = pino({
      level: 'debug',
      transport: {
        targets: [
          {
            target: 'pino-pretty',
            level: 'debug',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname'
            }
          },
          {
            target: 'pino/file',
            level: 'debug',
            options: {
              destination: logFile,
              mkdir: true
            }
          }
        ]
      }
    });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(meta, message);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(meta, message);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(meta, message);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(meta, message);
  }

  child(meta: Record<string, unknown>): Logger {
    const childLogger = this.logger.child(meta);
    return new PinoLoggerChild(childLogger);
  }

  /**
   * 获取默认日志目录
   */
  private getDefaultLogDir(): string {
    try {
      // 尝试获取 Electron app 的用户数据目录
      const { app } = require('electron');
      if (app && app.getPath) {
        return path.join(app.getPath('userData'), 'logs');
      }
    } catch {
      // 如果不在 Electron 环境中，使用系统默认路径
    }

    // 回退到系统默认路径
    const homeDir = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
    if (homeDir) {
      return path.join(homeDir, '.ffmpeg-app', 'logs');
    }

    // 最后的回退
    return path.join(process.cwd(), 'logs');
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 获取日志文件名（按日期）
   */
  private getLogFileName(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `app-${year}${month}${day}.log`;
  }
}

/**
 * Pino Logger 的子实例
 */
class PinoLoggerChild implements Logger {
  constructor(private childLogger: pino.Logger) {}

  debug(message: string, meta?: Record<string, unknown>): void {
    this.childLogger.debug(meta, message);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.childLogger.info(meta, message);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.childLogger.warn(meta, message);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.childLogger.error(meta, message);
  }

  child(meta: Record<string, unknown>): Logger {
    return new PinoLoggerChild(this.childLogger.child(meta));
  }
}

/**
 * 简单的控制台日志实现（用于测试环境）
 */
export class ConsoleLogger implements Logger {
  constructor(private level: LogLevel = 'debug') {}

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, meta || '');
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${message}`, meta || '');
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, meta || '');
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, meta || '');
    }
  }

  child(meta: Record<string, unknown>): Logger {
    return new ConsoleLoggerChild(this.level, meta);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }
}

/**
 * 控制台日志的子实例
 */
class ConsoleLoggerChild implements Logger {
  private metaStr: string;

  constructor(private level: LogLevel, meta: Record<string, unknown>) {
    this.metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      const extraMeta = meta ? ` ${JSON.stringify(meta)}` : '';
      console.debug(`[DEBUG] ${message}${this.metaStr}${extraMeta}`);
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      const extraMeta = meta ? ` ${JSON.stringify(meta)}` : '';
      console.info(`[INFO] ${message}${this.metaStr}${extraMeta}`);
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      const extraMeta = meta ? ` ${JSON.stringify(meta)}` : '';
      console.warn(`[WARN] ${message}${this.metaStr}${extraMeta}`);
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      const extraMeta = meta ? ` ${JSON.stringify(meta)}` : '';
      console.error(`[ERROR] ${message}${this.metaStr}${extraMeta}`);
    }
  }

  child(meta: Record<string, unknown>): Logger {
    const combinedMeta = { ...this.metaStr ? JSON.parse(this.metaStr) : {}, ...meta };
    return new ConsoleLoggerChild(this.level, combinedMeta);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }
}

/**
 * 创建日志实例
 */
export function createLogger(logDir?: string, useConsole = false): Logger {
  if (useConsole) {
    return new ConsoleLogger();
  }
  return new PinoLogger(logDir);
}

// 导出默认日志实例
export const logger = createLogger();
