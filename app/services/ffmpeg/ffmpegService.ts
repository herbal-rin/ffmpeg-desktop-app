import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { 
  FfmpegPaths, 
  Job, 
  Progress, 
  Logger, 
  ERRORS 
} from '../../shared/types';
import { FFprobeService } from './probe';
import { ArgsBuilder } from './argsBuilder';
import { ProgressParser } from './progressParser';
import { HardwareAccelBlacklist } from './hardwareAccelBlacklist';

/**
 * FFmpeg 服务类
 */
export class FfmpegService {
  private activeProcesses = new Map<number, ChildProcess>();
  private ffprobeService: FFprobeService;
  private blacklist: HardwareAccelBlacklist;

  constructor(
    private paths: FfmpegPaths,
    private logger: Logger
  ) {
    this.ffprobeService = new FFprobeService(paths, logger);
    this.blacklist = HardwareAccelBlacklist.getInstance();
    
    // 启动时清理残留的临时文件
    this.cleanupStaleTempFiles();
    
    // 定期清理过期的黑名单项
    setInterval(() => {
      this.blacklist.cleanupExpired();
    }, 60000); // 每分钟清理一次
  }

  /**
   * 执行视频转码
   */
  async transcode(job: Job, onProgress: (progress: Progress) => void): Promise<number> {
    const { opts } = job;
    
    // 获取输出文件路径
    const outputPath = this.getOutputPath(opts);
    
    // 确保输出目录存在
    this.ensureOutputDir(outputPath);
    
    // 检查输出文件是否已存在，如果存在则重命名
    const finalOutputPath = this.getUniqueOutputPath(outputPath);
    
    // 使用临时文件进行原子写入
    const tempOutputPath = `${finalOutputPath}.tmp`;
    
    this.logger.info('开始转码任务', {
      jobId: job.id,
      input: opts.input,
      output: finalOutputPath,
      tempOutput: tempOutputPath,
      codec: opts.videoCodec,
      preset: opts.videoPreset.name
    });

    try {
      // 先探测视频信息
      const probeResult = await this.ffprobeService.probe(opts.input);
      const totalDurationMs = probeResult.durationSec * 1000;

      // 构建 FFmpeg 参数，使用临时文件
      const args = ArgsBuilder.buildFullArgs(
        opts.input,
        tempOutputPath, // 使用临时文件
        opts.videoCodec,
        opts.videoPreset,
        opts.container,
        opts.audio,
        opts.fastStart ?? true,
        opts.extraArgs
      );

      this.logger.debug('FFmpeg 命令参数', {
        jobId: job.id,
        command: this.paths.ffmpeg,
        args
      });

      // 执行 FFmpeg
      const process = this.spawnProcess(this.paths.ffmpeg, args);
      this.activeProcesses.set(process.pid!, process);

      // 立即返回PID，不等待完成
      const pid = process.pid!;
      
      // 异步处理完成逻辑
      this.handleTranscodeCompletion(process, job, tempOutputPath, finalOutputPath, totalDurationMs, onProgress)
        .catch((error) => {
          this.logger.error('转码任务处理失败', {
            jobId: job.id,
            error: error instanceof Error ? error.message : String(error)
          });
        });

      return pid;

    } catch (error) {
      this.logger.error('转码任务失败', {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // 清理临时文件
      this.cleanupTempFile(tempOutputPath, job.id);

      throw error;
    }
  }

  /**
   * 处理转码完成逻辑
   */
  private async handleTranscodeCompletion(
    process: ChildProcess,
    job: Job,
    tempOutputPath: string,
    finalOutputPath: string,
    totalDurationMs: number,
    onProgress: (progress: Progress) => void
  ): Promise<void> {
    try {
      // 监听进度
      this.setupProgressListener(process, totalDurationMs, onProgress);

      // 等待完成
      await this.waitForCompletion(process, job.id);

      // 原子写入：将临时文件重命名为最终文件
      if (fs.existsSync(tempOutputPath)) {
        fs.renameSync(tempOutputPath, finalOutputPath);
        this.logger.info('原子写入完成', {
          jobId: job.id,
          tempFile: tempOutputPath,
          finalFile: finalOutputPath
        });
      }

      this.logger.info('转码任务完成', {
        jobId: job.id,
        output: finalOutputPath
      });

    } catch (error) {
      this.logger.error('转码任务处理失败', {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // 清理临时文件
      this.cleanupTempFile(tempOutputPath, job.id);
      
      throw error;
    } finally {
      // 清理进程记录
      if (process.pid) {
        this.activeProcesses.delete(process.pid);
      }
    }
  }

  /**
   * 启动 FFmpeg 进程
   */
  private spawnProcess(command: string, args: string[]): ChildProcess {
    const process = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false, // 禁用 shell，防止命令注入
      windowsHide: true, // Windows 下隐藏子进程窗口
      detached: false // 确保进程不会脱离父进程
    });

    this.logger.debug('启动 FFmpeg 进程', {
      pid: process.pid,
      command,
      args,
      platform: require('process').platform
    });

    return process;
  }

  /**
   * 设置进度监听器
   */
  private setupProgressListener(
    process: ChildProcess,
    totalDurationMs: number,
    onProgress: (progress: Progress) => void
  ): void {
    let buffer = Buffer.alloc(0);

    process.stdout?.on('data', (data: Buffer) => {
      buffer = Buffer.concat([buffer, data]);
      
      // 按行分割数据
      const lines = buffer.toString('utf8').split('\n');
      buffer = Buffer.from(lines.pop() || '', 'utf8'); // 保留最后一行（可能不完整）
      
      for (const line of lines) {
        if (ProgressParser.isValidProgressLine(line)) {
          const partial = ProgressParser.parseProgressLine(line);
          const progress = ProgressParser.calculateProgress(partial, totalDurationMs);
          onProgress(progress);
        }
      }
    });

    process.stderr?.on('data', (data: Buffer) => {
      const stderr = data.toString('utf8');
      this.logger.debug('FFmpeg stderr', { stderr });
    });
  }

  /**
   * 等待进程完成
   */
  private async waitForCompletion(process: ChildProcess, jobId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          const error = new Error(`FFmpeg 执行失败 (退出码: ${code})`);
          error.name = `${ERRORS.FFMPEG_EXIT}_${code}`;
          reject(error);
        }
      });

      process.on('error', (error) => {
        this.logger.error('FFmpeg 进程错误', {
          jobId,
          error: error.message
        });
        reject(error);
      });
    });
  }

  /**
   * 取消任务
   */
  cancel(pid: number): void {
    const process = this.activeProcesses.get(pid);
    if (!process) {
      this.logger.warn('尝试取消不存在的进程', { pid });
      return;
    }

    this.logger.info('取消 FFmpeg 进程', { pid });

    // 发送 SIGTERM
    process.kill('SIGTERM');

    // 5秒后如果还没退出，强制终止
    setTimeout(() => {
      if (!process.killed) {
        this.logger.warn('强制终止 FFmpeg 进程', { pid });
        
        if (require('process').platform === 'win32') {
          // Windows 使用 taskkill 兜底
          this.killWindowsProcess(pid);
        } else {
          // Unix 系统使用 SIGKILL
          process.kill('SIGKILL');
        }
      }
    }, 5000);

    this.activeProcesses.delete(pid);
  }

  /**
   * Windows 下强制终止进程
   */
  private killWindowsProcess(pid: number): void {
    const { spawn } = require('child_process');
    
    try {
      const taskkill = spawn('taskkill', ['/PID', pid.toString(), '/T', '/F'], {
        stdio: 'ignore',
        shell: false,
        windowsHide: true
      });
      
      taskkill.on('close', (code: number) => {
        if (code === 0) {
          this.logger.debug('Windows 进程已强制终止', { pid });
        } else {
          this.logger.warn('Windows taskkill 失败', { pid, code });
        }
      });
      
      taskkill.on('error', (error: Error) => {
        this.logger.error('Windows taskkill 错误', { pid, error: error.message });
      });
    } catch (error) {
      this.logger.error('Windows 进程终止失败', { 
        pid, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * 暂停任务（仅支持 Unix 系统）
   */
  pause(pid: number): void {
    if (require('process').platform === 'win32') {
      const error = new Error('Windows 系统暂不支持暂停功能');
      error.name = ERRORS.PAUSE_UNSUPPORTED_WINDOWS;
      throw error;
    }

    const process = this.activeProcesses.get(pid);
    if (!process) {
      this.logger.warn('尝试暂停不存在的进程', { pid });
      return;
    }

    this.logger.info('暂停 FFmpeg 进程', { pid });
    process.kill('SIGSTOP');
  }

  /**
   * 恢复任务（仅支持 Unix 系统）
   */
  resume(pid: number): void {
    if (require('process').platform === 'win32') {
      const error = new Error('Windows 系统暂不支持恢复功能');
      error.name = ERRORS.PAUSE_UNSUPPORTED_WINDOWS;
      throw error;
    }

    const process = this.activeProcesses.get(pid);
    if (!process) {
      this.logger.warn('尝试恢复不存在的进程', { pid });
      return;
    }

    this.logger.info('恢复 FFmpeg 进程', { pid });
    process.kill('SIGCONT');
  }

  /**
   * 获取输出文件路径
   */
  private getOutputPath(opts: any): string {
    const inputName = path.basename(opts.input, path.extname(opts.input));
    const outputName = opts.outputName || inputName;
    const extension = opts.container === 'mp4' ? '.mp4' : '.mkv';
    return path.join(opts.outputDir, `${outputName}${extension}`);
  }

  /**
   * 确保输出目录存在
   */
  private ensureOutputDir(outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      this.logger.debug('创建输出目录', { dir });
    }
  }

  /**
   * 获取唯一的输出文件路径（避免覆盖）
   */
  private getUniqueOutputPath(outputPath: string): string {
    if (!fs.existsSync(outputPath)) {
      return outputPath;
    }

    const dir = path.dirname(outputPath);
    const ext = path.extname(outputPath);
    const name = path.basename(outputPath, ext);

    let counter = 1;
    let newPath: string;

    do {
      newPath = path.join(dir, `${name} (${counter})${ext}`);
      counter++;
    } while (fs.existsSync(newPath));

    this.logger.debug('输出文件已存在，使用新名称', {
      original: outputPath,
      new: newPath
    });

    return newPath;
  }

  /**
   * 获取活跃进程列表
   */
  getActiveProcesses(): number[] {
    return Array.from(this.activeProcesses.keys());
  }

  /**
   * 检查进程是否活跃
   */
  isProcessActive(pid: number): boolean {
    return this.activeProcesses.has(pid);
  }

  /**
   * 清理所有活跃进程
   */
  cleanup(): void {
    this.logger.info('清理所有活跃进程', { 
      count: this.activeProcesses.size 
    });

    for (const [pid, process] of this.activeProcesses) {
      try {
        process.kill('SIGTERM');
      } catch (error) {
        this.logger.warn('清理进程失败', { 
          pid, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    this.activeProcesses.clear();
  }

  /**
   * 清理临时文件
   */
  private cleanupTempFile(tempPath: string, jobId: string): void {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
        this.logger.debug('已删除临时文件', { 
          jobId,
          tempFile: tempPath 
        });
      } catch (cleanupError) {
        this.logger.warn('删除临时文件失败', { 
          jobId,
          tempFile: tempPath,
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        });
      }
    }
  }

  /**
   * 启动时清理残留的临时文件
   */
  cleanupStaleTempFiles(): void {
    // 使用默认输出目录
    const outputDir = path.join(require('os').homedir(), 'Documents', 'FFmpegApp', 'output');
    
    try {
      if (fs.existsSync(outputDir)) {
        const files = fs.readdirSync(outputDir);
        const tempFiles = files.filter(file => file.endsWith('.tmp'));
        
        for (const tempFile of tempFiles) {
          const tempPath = path.join(outputDir, tempFile);
          try {
            fs.unlinkSync(tempPath);
            this.logger.debug('清理残留临时文件', { tempFile });
          } catch (error) {
            this.logger.warn('清理残留临时文件失败', { 
              tempFile,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        
        if (tempFiles.length > 0) {
          this.logger.info('启动时清理完成', { 
            cleanedCount: tempFiles.length,
            outputDir 
          });
        }
      }
    } catch (error) {
      this.logger.error('清理残留临时文件失败', { 
        outputDir,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 处理硬件加速失败，自动回退到软件编码
   */
  handleHardwareAccelFailure(codec: string, error: Error): string {
    this.logger.warn('硬件加速失败，加入黑名单', { 
      codec, 
      error: error.message 
    });
    
    // 将失败的编码器加入黑名单
    this.blacklist.addToBlacklist(codec);
    
    // 返回回退的软件编码器
    switch (codec) {
      case 'h264_nvenc':
        return 'libx264';
      case 'hevc_nvenc':
        return 'libx265';
      case 'h264_qsv':
        return 'libx264';
      case 'hevc_qsv':
        return 'libx265';
      case 'h264_videotoolbox':
        return 'libx264';
      case 'hevc_videotoolbox':
        return 'libx265';
      default:
        return 'libx264'; // 默认回退到 H.264
    }
  }

  /**
   * 检查编码器是否应该被跳过（在黑名单中）
   */
  shouldSkipCodec(codec: string): boolean {
    return this.blacklist.isBlacklisted(codec);
  }

  /**
   * 获取黑名单状态（用于调试）
   */
  getBlacklistStatus(): Array<{ codec: string; timestamp: number; remainingMs: number }> {
    return this.blacklist.getBlacklistStatus();
  }

  /**
   * 探测视频文件信息（公开 API）
   */
  async probe(input: string): Promise<any> {
    return this.ffprobeService.probe(input);
  }
}
