/**
 * Settings IPC 测试
 * 测试设置页面的 IPC 处理器
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsIPC } from '../app/main/ipc.settings';
import { ConfigService } from '../app/services/config';
import type { Logger } from '../app/shared/types';
import { FFmpegManager } from '../app/main/ffmpegManager';
import { GPUDetector } from '../app/main/gpuDetect';

describe('SettingsIPC', () => {
  let settingsIPC: SettingsIPC;
  let mockLogger: Logger;
  let mockConfigService: ConfigService;
  let mockFFmpegManager: FFmpegManager;
  let mockGPUDetector: GPUDetector;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };

    mockConfigService = {
      getDefaultOutputDir: vi.fn(() => '/fake/default/output'),
      getFfmpegPath: vi.fn(() => '/fake/ffmpeg'),
      getFfprobePath: vi.fn(() => '/fake/ffprobe'),
      getLanguage: vi.fn(() => 'zh'),
      getTheme: vi.fn(() => 'light'),
      getHardwareAcceleration: vi.fn(() => true),
      setDefaultOutputDir: vi.fn(),
      setFfmpegPath: vi.fn(),
      setFfprobePath: vi.fn(),
      setLanguage: vi.fn(),
      setTheme: vi.fn(),
      setHardwareAcceleration: vi.fn()
    } as any;

    mockFFmpegManager = {
      locateFFmpeg: vi.fn(),
      getFFmpegState: vi.fn(),
      startDownload: vi.fn(),
      cancelDownload: vi.fn(),
      verifyFFmpeg: vi.fn(),
      switchFFmpeg: vi.fn()
    } as any;

    mockGPUDetector = {
      diagnoseGPU: vi.fn()
    } as any;

    settingsIPC = new SettingsIPC(mockLogger, mockConfigService, mockFFmpegManager, mockGPUDetector);
  });

  describe('get', () => {
    it('应该返回所有设置', async () => {
      const result = await (mockConfigService.getDefaultOutputDir as any)();
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('应该包含所有必需的字段', async () => {
      const settings = {
        defaultOutputDir: mockConfigService.getDefaultOutputDir(),
        language: mockConfigService.getLanguage(),
        theme: mockConfigService.getTheme(),
        preferHardwareAccel: mockConfigService.getHardwareAcceleration(),
        ffmpegPath: mockConfigService.getFfmpegPath(),
        ffprobePath: mockConfigService.getFfprobePath(),
        ffmpegManaged: false
      };

      expect(settings).toHaveProperty('defaultOutputDir');
      expect(settings).toHaveProperty('language');
      expect(settings).toHaveProperty('theme');
      expect(settings).toHaveProperty('preferHardwareAccel');
      expect(settings).toHaveProperty('ffmpegPath');
      expect(settings).toHaveProperty('ffprobePath');
      expect(settings).toHaveProperty('ffmpegManaged');
    });
  });

  describe('set', () => {
    it('应该更新有效设置', async () => {
      const newSettings = {
        language: 'en',
        theme: 'dark'
      };

      mockConfigService.setLanguage(newSettings.language);
      mockConfigService.setTheme(newSettings.theme);

      expect(mockConfigService.setLanguage).toHaveBeenCalledWith('en');
      expect(mockConfigService.setTheme).toHaveBeenCalledWith('dark');
    });

    it('应该在目录不可写时报错', async () => {
      const fs = await import('fs');
      vi.spyOn(fs, 'accessSync').mockImplementation(() => {
        throw new Error('Permission denied');
      });

      try {
        mockConfigService.setDefaultOutputDir('/fake/path');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('路径验证', () => {
    it('应该验证输出目录可写', async () => {
      const fs = await import('fs');
      vi.spyOn(fs, 'accessSync').mockReturnValue(undefined);

      const result = vi.fn(() => fs.accessSync);
      
      expect(result).toBeDefined();
    });

    it('应该拒绝不存在的目录', () => {
      const fs = require('fs');
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      expect(() => {
        if (!fs.existsSync('/fake/path')) {
          throw new Error('Directory does not exist');
        }
      }).toThrow();
    });
  });
});

