import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobQueue } from '../app/services/queue/jobQueue';
import { FfmpegService } from '../app/services/ffmpeg/ffmpegService';
import { ConsoleLogger } from '../app/services/logger';
import { TranscodeOptions, Job } from '../app/shared/types';

// Mock FfmpegService
class MockFfmpegService {
  private activeProcesses: number[] = [];
  private mockProcess: any = null;

  async transcode(job: Job, onProgress: (progress: any) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      // 模拟长时间运行的任务
      this.mockProcess = {
        pid: Math.floor(Math.random() * 10000) + 1000,
        killed: false,
        kill: vi.fn()
      };
      
      this.activeProcesses.push(this.mockProcess.pid);
      
      // 模拟进度更新
      let progress = 0;
      const interval = setInterval(() => {
        progress += 0.1;
        if (progress <= 1) {
          onProgress({
            ratio: progress,
            timeMs: progress * 100000,
            speed: 1.0,
            bitrate: '1000kbits/s',
            etaSec: (1 - progress) * 100
          });
        } else {
          clearInterval(interval);
          this.activeProcesses = this.activeProcesses.filter(p => p !== this.mockProcess.pid);
          resolve();
        }
      }, 100);
      
      // 模拟取消
      this.mockProcess.kill = (signal: string) => {
        clearInterval(interval);
        this.activeProcesses = this.activeProcesses.filter(p => p !== this.mockProcess.pid);
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          reject(new Error('Process killed'));
        }
      };
    });
  }

  getActiveProcesses(): number[] {
    return [...this.activeProcesses];
  }

  pause(pid: number): void {
    // Mock implementation
  }

  resume(pid: number): void {
    // Mock implementation
  }

  cancel(pid: number): void {
    if (this.mockProcess) {
      this.mockProcess.kill('SIGTERM');
    }
  }
}

describe('JobQueue', () => {
  let jobQueue: JobQueue;
  let mockFfmpegService: MockFfmpegService;
  let logger: ConsoleLogger;

  beforeEach(() => {
    mockFfmpegService = new MockFfmpegService();
    logger = new ConsoleLogger('debug');
    jobQueue = new JobQueue(mockFfmpegService as any, logger);
  });

  afterEach(() => {
    jobQueue.destroy();
  });

  describe('enqueue', () => {
    it('应该添加任务到队列', () => {
      const opts: TranscodeOptions = {
        input: '/path/to/input.mp4',
        outputDir: '/path/to/output',
        container: 'mp4',
        videoCodec: 'libx264',
        videoPreset: { name: 'balanced', args: ['-preset', 'medium', '-crf', '22'] },
        audio: { mode: 'copy' }
      };

      const job = jobQueue.enqueue(opts);

      expect(job.id).toBeDefined();
      expect(job.status).toBe('queued');
      expect(job.opts).toEqual(opts);
      expect(jobQueue.getStatus().queueLength).toBe(1);
    });

    it('应该自动开始处理队列中的任务', async () => {
      const opts: TranscodeOptions = {
        input: '/path/to/input.mp4',
        outputDir: '/path/to/output',
        container: 'mp4',
        videoCodec: 'libx264',
        videoPreset: { name: 'balanced', args: ['-preset', 'medium', '-crf', '22'] },
        audio: { mode: 'copy' }
      };

      const events: any[] = [];
      jobQueue.on('job-start', (data) => events.push({ type: 'job-start', data }));
      jobQueue.on('job-progress', (data) => events.push({ type: 'job-progress', data }));
      jobQueue.on('job-done', (data) => events.push({ type: 'job-done', data }));

      const job = jobQueue.enqueue(opts);

      // 等待任务完成
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(events.some(e => e.type === 'job-start')).toBe(true);
      expect(events.some(e => e.type === 'job-progress')).toBe(true);
      expect(events.some(e => e.type === 'job-done')).toBe(true);
    });
  });

  describe('cancel', () => {
    it('应该取消队列中的任务', () => {
      const opts: TranscodeOptions = {
        input: '/path/to/input.mp4',
        outputDir: '/path/to/output',
        container: 'mp4',
        videoCodec: 'libx264',
        videoPreset: { name: 'balanced', args: ['-preset', 'medium', '-crf', '22'] },
        audio: { mode: 'copy' }
      };

      const job = jobQueue.enqueue(opts);
      expect(jobQueue.getStatus().queueLength).toBe(1);

      jobQueue.cancel(job.id);
      expect(jobQueue.getStatus().queueLength).toBe(0);
      expect(job.status).toBe('canceled');
    });

    it('应该取消正在运行的任务', async () => {
      const opts: TranscodeOptions = {
        input: '/path/to/input.mp4',
        outputDir: '/path/to/output',
        container: 'mp4',
        videoCodec: 'libx264',
        videoPreset: { name: 'balanced', args: ['-preset', 'medium', '-crf', '22'] },
        audio: { mode: 'copy' }
      };

      const events: any[] = [];
      jobQueue.on('job-canceled', (data) => events.push({ type: 'job-canceled', data }));

      const job = jobQueue.enqueue(opts);
      
      // 等待任务开始
      await new Promise(resolve => setTimeout(resolve, 200));
      
      jobQueue.cancel(job.id);
      
      expect(job.status).toBe('canceled');
      expect(events.some(e => e.type === 'job-canceled')).toBe(true);
    });
  });

  describe('pause/resume', () => {
    it('应该暂停和恢复任务', async () => {
      const opts: TranscodeOptions = {
        input: '/path/to/input.mp4',
        outputDir: '/path/to/output',
        container: 'mp4',
        videoCodec: 'libx264',
        videoPreset: { name: 'balanced', args: ['-preset', 'medium', '-crf', '22'] },
        audio: { mode: 'copy' }
      };

      const job = jobQueue.enqueue(opts);
      
      // 等待任务开始
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (process.platform !== 'win32') {
        jobQueue.pause(job.id);
        expect(job.status).toBe('paused');
        
        jobQueue.resume(job.id);
        expect(job.status).toBe('running');
      }
    });
  });

  describe('getStatus', () => {
    it('应该返回正确的状态信息', () => {
      const opts: TranscodeOptions = {
        input: '/path/to/input.mp4',
        outputDir: '/path/to/output',
        container: 'mp4',
        videoCodec: 'libx264',
        videoPreset: { name: 'balanced', args: ['-preset', 'medium', '-crf', '22'] },
        audio: { mode: 'copy' }
      };

      const job = jobQueue.enqueue(opts);
      const status = jobQueue.getStatus();

      expect(status.queueLength).toBe(1);
      expect(status.running).toBeNull();
      expect(status.activePid).toBeNull();
    });
  });

  describe('clear', () => {
    it('应该清空队列', () => {
      const opts: TranscodeOptions = {
        input: '/path/to/input.mp4',
        outputDir: '/path/to/output',
        container: 'mp4',
        videoCodec: 'libx264',
        videoPreset: { name: 'balanced', args: ['-preset', 'medium', '-crf', '22'] },
        audio: { mode: 'copy' }
      };

      jobQueue.enqueue(opts);
      jobQueue.enqueue(opts);
      
      expect(jobQueue.getStatus().queueLength).toBe(2);
      
      jobQueue.clear();
      
      expect(jobQueue.getStatus().queueLength).toBe(0);
    });
  });

  describe('setConcurrency', () => {
    it('应该设置并发数', () => {
      jobQueue.setConcurrency(3);
      expect(jobQueue.getConcurrency()).toBe(3);
    });

    it('应该拒绝无效的并发数', () => {
      expect(() => jobQueue.setConcurrency(0)).toThrow('并发数必须大于 0');
      expect(() => jobQueue.setConcurrency(-1)).toThrow('并发数必须大于 0');
    });
  });

  describe('queue-empty event', () => {
    it('应该在队列为空时触发事件', async () => {
      const events: any[] = [];
      jobQueue.on('queue-empty', (data) => events.push({ type: 'queue-empty', data }));

      const opts: TranscodeOptions = {
        input: '/path/to/input.mp4',
        outputDir: '/path/to/output',
        container: 'mp4',
        videoCodec: 'libx264',
        videoPreset: { name: 'balanced', args: ['-preset', 'medium', '-crf', '22'] },
        audio: { mode: 'copy' }
      };

      jobQueue.enqueue(opts);
      
      // 等待任务完成
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      expect(events.some(e => e.type === 'queue-empty')).toBe(true);
    });
  });
});
