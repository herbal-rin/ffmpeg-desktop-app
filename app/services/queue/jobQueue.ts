import { EventEmitter } from 'events';
import { 
  Job, 
  TranscodeOptions, 
  Progress
} from '../../shared/types';
import { FfmpegService } from '../ffmpeg/ffmpegService';
import { Logger } from '../../shared/types';

/**
 * 任务队列服务
 */
export class JobQueue extends EventEmitter {
  private queue: Job[] = [];
  private running: Job | null = null;
  private concurrency = 1; // 默认串行执行
  private ffmpegService: FfmpegService;
  private activePid: number | null = null;

  constructor(
    ffmpegService: FfmpegService,
    private logger: Logger
  ) {
    super();
    this.ffmpegService = ffmpegService;
  }

  /**
   * 设置并发数
   */
  setConcurrency(concurrency: number): void {
    if (concurrency < 1) {
      throw new Error('并发数必须大于 0');
    }
    this.concurrency = concurrency;
    this.logger.info('设置任务队列并发数', { concurrency });
  }

  /**
   * 获取当前并发数
   */
  getConcurrency(): number {
    return this.concurrency;
  }

  /**
   * 添加任务到队列
   */
  enqueue(opts: TranscodeOptions): Job {
    const job: Job = {
      id: this.generateJobId(),
      opts,
      status: 'queued',
      createdAt: Date.now()
    };

    this.queue.push(job);
    this.logger.info('任务已加入队列', {
      jobId: job.id,
      queueLength: this.queue.length,
      input: opts.input
    });

    // 如果当前没有运行的任务，立即开始处理
    if (!this.running) {
      this.processNext();
    }

    return job;
  }

  /**
   * 开始处理队列
   */
  start(): void {
    this.logger.info('开始处理任务队列', {
      queueLength: this.queue.length,
      running: !!this.running
    });

    if (!this.running) {
      this.processNext();
    }
  }

  /**
   * 暂停任务
   */
  pause(jobId: string): void {
    const job = this.findJob(jobId);
    if (!job) {
      this.logger.warn('尝试暂停不存在的任务', { jobId });
      return;
    }

    if (job.status !== 'running') {
      this.logger.warn('只能暂停运行中的任务', { 
        jobId, 
        status: job.status 
      });
      return;
    }

    if (!this.activePid) {
      this.logger.warn('没有活跃的进程可以暂停', { jobId });
      return;
    }

    try {
      this.ffmpegService.pause(this.activePid);
      job.status = 'paused';
      this.logger.info('任务已暂停', { jobId });
      this.emit('job-paused', { job });
    } catch (error) {
      this.logger.error('暂停任务失败', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 恢复任务
   */
  resume(jobId: string): void {
    const job = this.findJob(jobId);
    if (!job) {
      this.logger.warn('尝试恢复不存在的任务', { jobId });
      return;
    }

    if (job.status !== 'paused') {
      this.logger.warn('只能恢复暂停的任务', { 
        jobId, 
        status: job.status 
      });
      return;
    }

    if (!this.activePid) {
      this.logger.warn('没有活跃的进程可以恢复', { jobId });
      return;
    }

    try {
      this.ffmpegService.resume(this.activePid);
      job.status = 'running';
      this.logger.info('任务已恢复', { jobId });
      this.emit('job-resumed', { job });
    } catch (error) {
      this.logger.error('恢复任务失败', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 取消任务
   */
  cancel(jobId: string): void {
    const job = this.findJob(jobId);
    if (!job) {
      this.logger.warn('尝试取消不存在的任务', { jobId });
      return;
    }

    if (job.status === 'completed' || job.status === 'failed') {
      this.logger.warn('无法取消已完成的任务', { 
        jobId, 
        status: job.status 
      });
      return;
    }

    if (job.status === 'running' || job.status === 'paused') {
      // 取消正在运行的任务
      if (this.activePid) {
        this.ffmpegService.cancel(this.activePid);
        this.activePid = null;
      }
      job.status = 'canceled';
      job.finishedAt = Date.now();
      this.logger.info('任务已取消', { jobId });
      this.emit('job-canceled', { job });
    } else if (job.status === 'queued') {
      // 从队列中移除
      const index = this.queue.indexOf(job);
      if (index > -1) {
        this.queue.splice(index, 1);
      }
      job.status = 'canceled';
      job.finishedAt = Date.now();
      this.logger.info('队列中的任务已取消', { jobId });
      this.emit('job-canceled', { job });
    }

    // 处理下一个任务
    this.processNext();
  }

  /**
   * 获取队列状态
   */
  getStatus(): {
    queueLength: number;
    running: Job | null;
    activePid: number | null;
  } {
    return {
      queueLength: this.queue.length,
      running: this.running,
      activePid: this.activePid
    };
  }

  /**
   * 获取所有任务
   */
  getAllJobs(): Job[] {
    const allJobs = [...this.queue];
    if (this.running) {
      allJobs.unshift(this.running);
    }
    return allJobs;
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.logger.info('清空任务队列', { 
      queueLength: this.queue.length,
      running: !!this.running 
    });

    // 取消所有队列中的任务
    for (const job of this.queue) {
      job.status = 'canceled';
      job.finishedAt = Date.now();
      this.emit('job-canceled', { job });
    }

    this.queue = [];
  }

  /**
   * 处理下一个任务
   */
  private async processNext(): Promise<void> {
    if (this.running || this.queue.length === 0) {
      if (this.queue.length === 0 && !this.running) {
        this.emit('queue-empty', {});
      }
      return;
    }

    const job = this.queue.shift()!;
    this.running = job;
    job.status = 'running';
    job.startedAt = Date.now();

    this.logger.info('开始执行任务', {
      jobId: job.id,
      input: job.opts.input,
      remainingInQueue: this.queue.length
    });

    this.emit('job-start', { job });

    try {
      await this.executeJob(job);
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.finishedAt = Date.now();

      this.logger.error('任务执行失败', {
        jobId: job.id,
        error: job.error
      });

      this.emit('job-error', { job, error: job.error });
    } finally {
      this.running = null;
      this.activePid = null;
      this.processNext(); // 处理下一个任务
    }
  }

  /**
   * 执行任务
   */
  private async executeJob(job: Job): Promise<void> {
    return new Promise((resolve, reject) => {
      const onProgress = (progress: Progress) => {
        job.lastProgress = progress;
        this.emit('job-progress', { job, progress });
      };

      // 执行转码
      this.ffmpegService.transcode(job, onProgress)
        .then(() => {
          job.status = 'completed';
          job.finishedAt = Date.now();
          this.logger.info('任务执行完成', {
            jobId: job.id,
            duration: job.finishedAt - (job.startedAt || job.createdAt)
          });
          this.emit('job-done', { job });
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  /**
   * 查找任务
   */
  private findJob(jobId: string): Job | null {
    if (this.running && this.running.id === jobId) {
      return this.running;
    }
    return this.queue.find(job => job.id === jobId) || null;
  }

  /**
   * 生成任务 ID
   */
  private generateJobId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `job_${timestamp}_${random}`;
  }

  /**
   * 销毁队列
   */
  destroy(): void {
    this.logger.info('销毁任务队列');
    
    // 取消所有任务
    if (this.running) {
      this.cancel(this.running.id);
    }
    
    this.clear();
    this.removeAllListeners();
  }
}
