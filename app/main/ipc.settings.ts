/**
 * 设置页 IPC 处理器
 */

import { ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Logger, SettingsData } from '../shared/types';
import { FFmpegManager, DownloadProgress } from './ffmpegManager';
import { GPUDetector } from './gpuDetect';
import { ConfigService } from '../services/config';

export interface DownloadRequest {
  provider: 'official' | 'mirrorA' | 'mirrorB';
  version: string;
  platform?: 'win' | 'mac' | 'linux';
  arch?: 'x64' | 'arm64';
  includeProbe?: boolean;
}

export interface SwitchRequest {
  ffmpegPath: string;
  ffprobePath?: string;
  managed?: boolean;
}

export class SettingsIPC {
  private ffmpegManager: FFmpegManager;
  private gpuDetector: GPUDetector;
  private configService: ConfigService;

  constructor(
    private logger: Logger,
    configService: ConfigService,
    webContents?: Electron.WebContents
  ) {
    this.configService = configService;
    this.ffmpegManager = new FFmpegManager(logger, webContents);
    this.gpuDetector = new GPUDetector(logger);
    
    this.setupIPC();
    this.setupEventListeners();
  }

  /**
   * 设置IPC处理器
   */
  private setupIPC(): void {
    // 获取设置
    ipcMain.handle('settings/get', async (_event) => {
      try {
        return await this.getSettings();
      } catch (error) {
        this.logger.error('获取设置失败', { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    });

    // 设置设置
    ipcMain.handle('settings/set', async (_event, settings: Partial<SettingsData>) => {
      try {
        return await this.setSettings(settings);
      } catch (error) {
        this.logger.error('设置设置失败', { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    });

    // GPU体检
    ipcMain.handle('gpu/diagnose', async (_event) => {
      try {
        const ffmpegPath = this.configService.getFfmpegPath();
        return await this.gpuDetector.diagnoseGPU(ffmpegPath);
      } catch (error) {
        this.logger.error('GPU体检失败', { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    });

    // 定位FFmpeg
    ipcMain.handle('ffmpeg/locate', async (_event) => {
      try {
        return await this.ffmpegManager.locateFFmpeg();
      } catch (error) {
        this.logger.error('定位FFmpeg失败', { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    });

    // 获取FFmpeg状态
    ipcMain.handle('ffmpeg/getState', async (_event) => {
      try {
        return await this.ffmpegManager.getFFmpegState(this.configService);
      } catch (error) {
        this.logger.error('获取FFmpeg状态失败', { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    });

    // 下载FFmpeg
    ipcMain.handle('ffmpeg/download', async (_event, request: DownloadRequest) => {
      try {
        return await this.ffmpegManager.startDownload(request);
      } catch (error) {
        this.logger.error('下载FFmpeg失败', { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    });

    // 取消下载
    ipcMain.handle('ffmpeg/cancelDownload', async (_event, request: { taskId: string }) => {
      try {
        return await this.ffmpegManager.cancelDownload(request.taskId);
      } catch (error) {
        this.logger.error('取消下载失败', { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    });

    // 验证FFmpeg
    ipcMain.handle('ffmpeg/verify', async (_event, request: { path: string; sha256?: string }) => {
      try {
        return await this.ffmpegManager.verifyFFmpeg(request.path, request.sha256);
      } catch (error) {
        this.logger.error('验证FFmpeg失败', { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    });

    // 切换FFmpeg
    ipcMain.handle('ffmpeg/switch', async (_event, request: SwitchRequest) => {
      try {
        const success = await this.ffmpegManager.switchFFmpeg(request.ffmpegPath, request.ffprobePath, request.managed);
        
        if (success) {
          // 更新配置
          this.configService.setFfmpegPath(request.ffmpegPath);
          if (request.ffprobePath) {
            this.configService.setFfprobePath(request.ffprobePath);
          }
        }
        
        return { ok: success };
      } catch (error) {
        this.logger.error('切换FFmpeg失败', { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    });

    // 选择输出目录
    ipcMain.handle('settings/selectOutputDir', async (_event) => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory'],
          title: '选择默认输出目录'
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
          const selectedPath = result.filePaths[0]!;
          
          // 验证目录可写
          if (this.isDirectoryWritable(selectedPath)) {
            return { success: true, path: selectedPath };
          } else {
            return { success: false, error: '目录不可写' };
          }
        }
        
        return { success: false, error: '未选择目录' };
      } catch (error) {
        this.logger.error('选择输出目录失败', { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    });

    // 选择FFmpeg路径
    ipcMain.handle('settings/selectFFmpegPath', async (_event) => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openFile'],
          title: '选择FFmpeg可执行文件',
          filters: [
            { name: '可执行文件', extensions: process.platform === 'win32' ? ['exe'] : [''] },
            { name: '所有文件', extensions: ['*'] }
          ]
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
          const selectedPath = result.filePaths[0]!;
          
          // 验证FFmpeg可执行
          const isValid = await this.ffmpegManager.verifyFFmpeg(selectedPath);
          if (isValid) {
            return { success: true, path: selectedPath };
          } else {
            return { success: false, error: '无效的FFmpeg可执行文件' };
          }
        }
        
        return { success: false, error: '未选择文件' };
      } catch (error) {
        this.logger.error('选择FFmpeg路径失败', { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    });

    // 选择FFprobe路径
    ipcMain.handle('settings/selectFFprobePath', async (_event) => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openFile'],
          title: '选择FFprobe可执行文件',
          filters: [
            { name: '可执行文件', extensions: process.platform === 'win32' ? ['exe'] : [''] },
            { name: '所有文件', extensions: ['*'] }
          ]
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
          const selectedPath = result.filePaths[0]!;
          
          // 验证FFprobe可执行
          const isValid = await this.ffmpegManager.verifyFFmpeg(selectedPath);
          if (isValid) {
            return { success: true, path: selectedPath };
          } else {
            return { success: false, error: '无效的FFprobe可执行文件' };
          }
        }
        
        return { success: false, error: '未选择文件' };
      } catch (error) {
        this.logger.error('选择FFprobe路径失败', { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    });
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听FFmpeg下载进度
    this.ffmpegManager.on('download-progress', (_progress: DownloadProgress) => {
      // 发送到渲染进程
      // 这里需要通过webContents发送事件
    });
  }

  /**
   * 获取设置
   */
  private async getSettings(): Promise<SettingsData> {
    const defaultOutputDir = this.configService.getDefaultOutputDir();
    const ffmpegPath = this.configService.getFfmpegPath();
    const ffprobePath = this.configService.getFfprobePath();
    const language = this.configService.getLanguage();
    const theme = this.configService.getTheme();
    const preferHardwareAccel = this.configService.getHardwareAcceleration();
    
    return {
      defaultOutputDir,
      language: language === 'zh-CN' ? 'zh' : 'en', // 转换格式
      theme: theme === 'light' ? 'light' : theme === 'dark' ? 'dark' : 'system', // 转换格式
      preferHardwareAccel,
      ffmpegPath,
      ffprobePath,
      ffmpegManaged: false // TODO: 从配置中获取
    };
  }

  /**
   * 设置设置
   */
  private async setSettings(settings: Partial<SettingsData>): Promise<{ ok: boolean }> {
    try {
      if (settings.defaultOutputDir !== undefined) {
        if (!this.isDirectoryWritable(settings.defaultOutputDir)) {
          throw new Error('输出目录不可写');
        }
        this.configService.setDefaultOutputDir(settings.defaultOutputDir);
      }
      
      if (settings.ffmpegPath !== undefined) {
        const isValid = await this.ffmpegManager.verifyFFmpeg(settings.ffmpegPath);
        if (!isValid) {
          throw new Error('FFmpeg路径无效');
        }
        this.configService.setFfmpegPath(settings.ffmpegPath);
      }
      
      if (settings.ffprobePath !== undefined) {
        const isValid = await this.ffmpegManager.verifyFFmpeg(settings.ffprobePath);
        if (!isValid) {
          throw new Error('FFprobe路径无效');
        }
        this.configService.setFfprobePath(settings.ffprobePath);
      }
      
      if (settings.language !== undefined) {
        // 转换格式：'zh' -> 'zh-CN', 'en' -> 'en'
        const configLanguage = settings.language === 'zh' ? 'zh-CN' : 'en';
        this.configService.setLanguage(configLanguage);
      }
      
      if (settings.theme !== undefined) {
        // 转换格式：'system' -> 'light' (默认)
        const configTheme = settings.theme === 'system' ? 'light' : settings.theme;
        this.configService.setTheme(configTheme);
      }
      
      if (settings.preferHardwareAccel !== undefined) {
        this.configService.setHardwareAcceleration(settings.preferHardwareAccel);
      }
      
      return { ok: true };
    } catch (error) {
      this.logger.error('设置设置失败', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * 检查目录是否可写
   */
  private isDirectoryWritable(dirPath: string): boolean {
    try {
      if (!fs.existsSync(dirPath)) {
        return false;
      }
      
      const stats = fs.statSync(dirPath);
      if (!stats.isDirectory()) {
        return false;
      }
      
      // 尝试创建临时文件测试写权限
      const testFile = path.join(dirPath, '.write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 清理资源
   */
  destroy(): void {
    // 清理事件监听器
    this.ffmpegManager.removeAllListeners();
  }
}
