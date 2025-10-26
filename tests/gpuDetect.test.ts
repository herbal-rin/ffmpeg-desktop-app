/**
 * GPU Detection 测试
 * 测试硬件加速器和编码器检测
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GPUDetector } from '../app/main/gpuDetect';
import type { Logger } from '../app/shared/types';

describe('GPUDetector', () => {
  let detector: GPUDetector;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };
    detector = new GPUDetector(mockLogger);
  });

  describe('diagnoseGPU', () => {
    it('应该检测硬件加速器', async () => {
      // Mock FFmpeg output for -hwaccels
      const { spawn } = await import('child_process');
      vi.mocked(spawn).mockImplementationOnce(() => {
        const mockProcess = {
          stdout: {
            on: vi.fn((event: string, callback: Function) => {
              if (event === 'data') {
                callback(Buffer.from('Hardware acceleration methods:\nvideotoolbox\ncuda\nqsv\n'));
              }
            })
          },
          stderr: { on: vi.fn() },
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 10);
            }
          }),
          pid: 12345
        } as any;
        return mockProcess;
      });

      const result = await detector.diagnoseGPU('/fake/ffmpeg/path');
      
      expect(result).toHaveProperty('hwaccels');
      expect(result).toHaveProperty('encoders');
      expect(result).toHaveProperty('videotoolbox');
    });

    it('应该识别 NVENC 支持', async () => {
      const { spawn } = await import('child_process');
      
      // Mock hwaccels response
      vi.mocked(spawn).mockImplementationOnce(() => {
        const mockProcess = {
          stdout: { on: vi.fn((event: string, callback: Function) => {
            if (event === 'data') {
              callback(Buffer.from('Hardware acceleration methods:\ncuda\n'));
            }
          })},
          stderr: { on: vi.fn() },
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 10);
            }
          }),
          pid: 12345
        } as any;
        return mockProcess;
      });

      // Mock encoders response
      vi.mocked(spawn).mockImplementationOnce(() => {
        const mockProcess = {
          stdout: { on: vi.fn((event: string, callback: Function) => {
            if (event === 'data') {
              callback(Buffer.from('V....D h264_nvenc\nV....D hevc_nvenc\n'));
            }
          })},
          stderr: { on: vi.fn() },
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 10);
            }
          }),
          pid: 12345
        } as any;
        return mockProcess;
      });

      const result = await detector.diagnoseGPU('/fake/ffmpeg/path');
      
      expect(result.nvenc).toBe(true);
    });

    it('应该处理自测失败情况', async () => {
      const { spawn } = await import('child_process');
      
      // Mock self-test failure
      vi.mocked(spawn).mockImplementationOnce(() => {
        const mockProcess = {
          stderr: {
            on: vi.fn((event: string, callback: Function) => {
              if (event === 'data') {
                callback(Buffer.from('[ERROR] Encoder not found\n'));
              }
            })
          },
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'close') {
              setTimeout(() => callback(1), 10);
            }
          }),
          pid: 12345
        } as any;
        return mockProcess;
      });

      const result = await detector.testEncoder('h264_nvenc', '/fake/ffmpeg/path');
      
      expect(result.available).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('testEncoder', () => {
    it('应该执行编码器自测', async () => {
      const { spawn } = await import('child_process');
      vi.mocked(spawn).mockImplementationOnce(() => {
        const mockProcess = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 10);
            }
          }),
          pid: 12345
        } as any;
        return mockProcess;
      });

      const result = await detector.testEncoder('h264_nvenc', '/fake/ffmpeg/path');
      
      expect(result).toHaveProperty('encoder');
      expect(result).toHaveProperty('available');
    });
  });
});

