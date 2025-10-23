import Store from 'electron-store';
import { FfmpegPaths, ERRORS } from '../shared/types';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 配置接口
 */
interface ConfigSchema {
  ffmpegPath: string;
  ffprobePath: string;
  defaultOutputDir: string;
  hardwareAcceleration: boolean;
  language: string;
  theme: string;
}

/**
 * 配置管理服务
 */
export class ConfigService {
  private store: Store<ConfigSchema>;

  constructor() {
    this.store = new Store<ConfigSchema>({
      defaults: {
        ffmpegPath: '',
        ffprobePath: '',
        defaultOutputDir: this.getDefaultOutputPath(),
        hardwareAcceleration: true,
        language: 'zh-CN',
        theme: 'light'
      }
    });
  }

  /**
   * 获取 FFmpeg 可执行文件路径
   */
  getPaths(): FfmpegPaths {
    const ffmpegPath = this.store.get('ffmpegPath');
    const ffprobePath = this.store.get('ffprobePath');

    if (!ffmpegPath || !ffprobePath) {
      const error = new Error('FFmpeg 路径未配置');
      error.name = ERRORS.FFMPEG_NOT_FOUND;
      error.message = `
FFmpeg 可执行文件路径未配置。

请按以下步骤配置：
1. 下载并安装 FFmpeg
2. 在设置页面中配置 FFmpeg 和 FFprobe 的完整路径
3. 或者等待后续版本支持自动下载功能

当前配置：
- FFmpeg: ${ffmpegPath || '未设置'}
- FFprobe: ${ffprobePath || '未设置'}
      `.trim();
      throw error;
    }

    // 验证文件是否存在
    if (!fs.existsSync(ffmpegPath)) {
      const error = new Error(`FFmpeg 文件不存在: ${ffmpegPath}`);
      error.name = ERRORS.FFMPEG_NOT_FOUND;
      throw error;
    }

    if (!fs.existsSync(ffprobePath)) {
      const error = new Error(`FFprobe 文件不存在: ${ffprobePath}`);
      error.name = ERRORS.FFMPEG_NOT_FOUND;
      throw error;
    }

    return { ffmpeg: ffmpegPath, ffprobe: ffprobePath };
  }

  /**
   * 设置 FFmpeg 路径
   */
  setPaths(paths: FfmpegPaths): void {
    this.store.set('ffmpegPath', paths.ffmpeg);
    this.store.set('ffprobePath', paths.ffprobe);
  }

  /**
   * 获取默认输出目录
   */
  getDefaultOutputDir(): string {
    return this.store.get('defaultOutputDir');
  }

  /**
   * 设置默认输出目录
   */
  setDefaultOutputDir(dir: string): void {
    this.store.set('defaultOutputDir', dir);
  }

  /**
   * 获取硬件加速设置
   */
  getHardwareAcceleration(): boolean {
    return this.store.get('hardwareAcceleration');
  }

  /**
   * 设置硬件加速
   */
  setHardwareAcceleration(enabled: boolean): void {
    this.store.set('hardwareAcceleration', enabled);
  }

  /**
   * 获取语言设置
   */
  getLanguage(): string {
    return this.store.get('language');
  }

  /**
   * 设置语言
   */
  setLanguage(lang: string): void {
    this.store.set('language', lang);
  }

  /**
   * 获取主题设置
   */
  getTheme(): string {
    return this.store.get('theme');
  }

  /**
   * 设置主题
   */
  setTheme(theme: string): void {
    this.store.set('theme', theme);
  }

  /**
   * 获取默认输出路径
   */
  private getDefaultOutputPath(): string {
    try {
      // 尝试获取 Electron app 的用户数据目录
      const { app } = require('electron');
      if (app && app.getPath) {
        return path.join(app.getPath('documents'), 'FFmpegApp', 'output');
      }
    } catch {
      // 如果不在 Electron 环境中，使用系统默认路径
    }

    // 回退到系统默认路径
    const homeDir = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
    if (homeDir) {
      return path.join(homeDir, 'Documents', 'FFmpegApp', 'output');
    }

    // 最后的回退
    return path.join(process.cwd(), 'output');
  }

  /**
   * 重置所有配置到默认值
   */
  reset(): void {
    this.store.clear();
  }

  /**
   * 获取所有配置
   */
  getAll(): ConfigSchema {
    return this.store.store;
  }

  /**
   * 设置所有配置
   */
  setAll(config: Partial<ConfigSchema>): void {
    Object.entries(config).forEach(([key, value]) => {
      if (value !== undefined) {
        this.store.set(key as keyof ConfigSchema, value);
      }
    });
  }
}

// 导出单例实例
export const configService = new ConfigService();
