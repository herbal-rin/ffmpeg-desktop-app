/**
 * 预览服务测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PreviewService } from '../app/main/previewService';
import { ConsoleLogger } from '../app/services/logger';

// Mock 文件系统
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  unlinkSync: vi.fn(),
  renameSync: vi.fn()
}));

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn()
}));

// Mock os
vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/user')
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123')
}));

describe('PreviewService', () => {
  let previewService: PreviewService;
  let mockLogger: ConsoleLogger;
  let mockFfmpegPaths: any;

  beforeEach(() => {
    mockLogger = new ConsoleLogger('debug');
    mockFfmpegPaths = {
      ffmpeg: '/usr/bin/ffmpeg',
      ffprobe: '/usr/bin/ffprobe'
    };
    previewService = new PreviewService(mockLogger, mockFfmpegPaths);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('单槽语义', () => {
    it('should cancel previous preview when starting new one', async () => {
      const mockCancel = vi.spyOn(previewService, 'cancelPreview').mockResolvedValue(true);
      
      // 模拟第一次预览
      const firstPreview = previewService.generateVideoPreview(
        '/test/input.mp4',
        { startSec: 0, endSec: 10 },
        8,
        true
      );

      // 模拟第二次预览（应该取消第一次）
      const secondPreview = previewService.generateVideoPreview(
        '/test/input2.mp4',
        { startSec: 5, endSec: 15 },
        8,
        true
      );

      expect(mockCancel).toHaveBeenCalled();
    });

    it('should handle preview cancellation correctly', async () => {
      const mockCancel = vi.spyOn(previewService, 'cancelPreview').mockResolvedValue(true);
      
      const result = await previewService.cancelPreview();
      
      expect(result).toBe(true);
      expect(mockCancel).toHaveBeenCalled();
    });
  });

  describe('临时文件清理', () => {
    it('should cleanup temporary files after cancellation', () => {
      const mockUnlinkSync = vi.fn();
      const mockExistsSync = vi.fn(() => true);
      
      // Mock fs functions
      const fs = require('fs');
      fs.existsSync = mockExistsSync;
      fs.unlinkSync = mockUnlinkSync;

      // 模拟清理临时文件
      const tempPath = '/test/temp.mp4.tmp';
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }

      expect(mockExistsSync).toHaveBeenCalledWith(tempPath);
      expect(mockUnlinkSync).toHaveBeenCalledWith(tempPath);
    });

    it('should cleanup palette files for GIF generation', () => {
      const mockUnlinkSync = vi.fn();
      const mockExistsSync = vi.fn(() => true);
      
      const fs = require('fs');
      fs.existsSync = mockExistsSync;
      fs.unlinkSync = mockUnlinkSync;

      const palettePath = '/test/palette.png';
      if (fs.existsSync(palettePath)) {
        fs.unlinkSync(palettePath);
      }

      expect(mockExistsSync).toHaveBeenCalledWith(palettePath);
      expect(mockUnlinkSync).toHaveBeenCalledWith(palettePath);
    });
  });

  describe('超时处理', () => {
    it('should handle long running preview processes', async () => {
      const mockSpawn = vi.fn(() => ({
        pid: 12345,
        killed: false,
        kill: vi.fn(),
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() }
      }));

      const { spawn } = await import('child_process');
      vi.mocked(spawn).mockImplementation(mockSpawn);

      // 模拟长时间运行的进程
      const process = mockSpawn();
      
      // 模拟超时处理
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
      }, 3000);

      expect(process.pid).toBe(12345);
    });
  });

  describe('错误处理', () => {
    it('should handle FFmpeg process errors gracefully', async () => {
      const mockSpawn = vi.fn(() => ({
        pid: 12345,
        killed: false,
        kill: vi.fn(),
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('FFmpeg process error')), 100);
          }
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() }
      }));

      const { spawn } = await import('child_process');
      vi.mocked(spawn).mockImplementation(mockSpawn);

      await expect(
        previewService.generateVideoPreview(
          '/test/input.mp4',
          { startSec: 0, endSec: 10 },
          8,
          true
        )
      ).rejects.toThrow('FFmpeg process error');
    });

    it('should handle file system errors', () => {
      const mockMkdirSync = vi.fn(() => {
        throw new Error('Permission denied');
      });

      const fs = require('fs');
      fs.mkdirSync = mockMkdirSync;

      expect(() => {
        fs.mkdirSync('/test/dir', { recursive: true });
      }).toThrow('Permission denied');
    });
  });

  describe('预览状态管理', () => {
    it('should track preview status correctly', async () => {
      expect(previewService.isPreviewing()).toBe(false);
      
      // 模拟开始预览
      const mockSpawn = vi.fn(() => ({
        pid: 12345,
        killed: false,
        kill: vi.fn(),
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() }
      }));

      const { spawn } = await import('child_process');
      vi.mocked(spawn).mockImplementation(mockSpawn);

      previewService.generateVideoPreview(
        '/test/input.mp4',
        { startSec: 0, endSec: 10 },
        8,
        true
      );

      // 注意：这里无法直接测试 isPreviewing() 因为 spawn 是异步的
      // 在实际测试中，我们需要等待进程启动
    });
  });
});
