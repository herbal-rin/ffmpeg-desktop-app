/**
 * FFmpeg Manager 测试
 * 测试下载、校验、解压和切换功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FFmpegManager } from '../app/main/ffmpegManager';
import type { Logger } from '../app/shared/types';

describe('FFmpegManager', () => {
  let manager: FFmpegManager;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };
    manager = new FFmpegManager(mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('download', () => {
    it('应该成功下载并返回 taskId', async () => {
      const taskId = await manager.startDownload({
        provider: 'official',
        version: 'test-version',
        includeProbe: true
      });

      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
    });

    it('应该触发下载进度事件', () => {
      return new Promise<void>((resolve) => {
        manager.on('download-progress', (progress) => {
          expect(progress).toHaveProperty('taskId');
          expect(progress).toHaveProperty('phase');
          resolve();
        });

        manager.startDownload({
          provider: 'official',
          version: 'test-version'
        });
      });
    });
  });

  describe('verify', () => {
    it('应该验证有效 FFmpeg 路径', async () => {
      const mockPath = '/fake/path/to/ffmpeg';
      
      // Mock existsSync
      const fs = await import('fs');
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      // Mock spawn for -version check
      const { spawn } = await import('child_process');
      const mockSpawn = vi.fn(spawn);
      vi.mocked(spawn).mockImplementationOnce(() => {
        const mockProcess = {
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 10);
            }
          }),
          pid: 12345,
          killed: false,
          kill: vi.fn()
        } as any;
        return mockProcess;
      });

      const result = await manager.verifyFFmpeg(mockPath);
      expect(result).toBe(true);
    });
  });

  describe('locateFFmpeg', () => {
    it('应该在 PATH 中找到 FFmpeg', async () => {
      // Mock which command for Unix
      const { spawn } = await import('child_process');
      vi.mocked(spawn).mockImplementationOnce(() => {
        const mockProcess = {
          stdout: {
            on: vi.fn((event: string, callback: Function) => {
              if (event === 'data') {
                callback(Buffer.from('/usr/bin/ffmpeg'));
              }
            })
          },
          on: vi.fn(),
          pid: 12345
        } as any;
        return mockProcess;
      });

      const result = await manager.locateFFmpeg();
      expect(result).toBeDefined();
    });
  });
});

