/**
 * 预览服务
 * 管理预览任务（单槽），内部 spawn ffmpeg 生成短样片/GIF
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { Logger, FfmpegPaths } from '../shared/types';
import { ProgressParser } from '../services/ffmpeg/progressParser';
// 路径转义工具仅在需要时引入（如滤镜字符串）
import { killProcessTree } from './windowsKillTree';

export class PreviewService extends EventEmitter {
  private currentProcess: ChildProcess | null = null;
  private tempDir: string;
  private logger: Logger;
  private ffmpegPaths: FfmpegPaths;

  constructor(logger: Logger, ffmpegPaths: FfmpegPaths) {
    super();
    this.logger = logger;
    this.ffmpegPaths = ffmpegPaths;
    this.tempDir = path.join(os.homedir(), 'Documents', 'FFmpegApp', 'temp', 'previews');
    this.ensureTempDir();
    this.cleanupOldPreviews();
  }

  /**
   * 确保临时目录存在
   */
  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * 清理超过 24 小时的预览文件
   */
  private cleanupOldPreviews(): void {
    try {
      const files = fs.readdirSync(this.tempDir);
      if (!Array.isArray(files)) {
        this.logger.warn('清理预览文件失败', { error: 'files is not iterable' });
        return;
      }
      
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 小时

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          this.logger.debug('清理过期预览文件', { file });
        }
      }
    } catch (error) {
      this.logger.warn('清理预览文件失败', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * 取消当前预览任务
   */
  async cancelPreview(): Promise<boolean> {
    if (!this.currentProcess) {
      return false;
    }

    try {
      this.logger.info('取消预览任务', { pid: this.currentProcess.pid });
      
      // 使用跨平台进程树清理
      await killProcessTree(this.currentProcess.pid!, this.logger, 3000);
      
      this.currentProcess = null;
      this.emit('preview-cancelled');
      return true;
    } catch (error) {
      this.logger.error('取消预览任务失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  /**
   * 生成视频预览
   */
  async generateVideoPreview(
    input: string,
    range: { startSec: number; endSec: number },
    previewSeconds: number = 8,
    scaleHalf: boolean = true
  ): Promise<string> {
    // 取消当前任务
    await this.cancelPreview();

    const duration = Math.min(range.endSec - range.startSec, previewSeconds);
    const outputPath = path.join(this.tempDir, `${crypto.randomUUID()}.mp4`);
    const tempPath = `${outputPath}.tmp`;

        const args = [
          '-y',
          '-ss', range.startSec.toString(),
          '-i', input,
      '-t', duration.toString(),
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '28',
      '-avoid_negative_ts', 'make_zero', // 避免负时间戳
      '-an', // 移除音频以加快预览
      '-progress', 'pipe:1',
      '-nostats',
      tempPath
    ];

    // 添加缩放滤镜（如果启用）
    if (scaleHalf) {
      args.splice(-2, 0, '-vf', 'scale=iw/2:-1');
    }

    return new Promise((resolve, reject) => {
      this.logger.info('开始生成视频预览', { input, range, duration, args });
      
      try {
        this.currentProcess = spawn(this.ffmpegPaths.ffmpeg, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
          windowsHide: true,
          detached: false
        });

        // 检查spawn是否成功
        if (!this.currentProcess) {
          throw new Error('FFmpeg 进程启动失败');
        }

      let progressBuffer = Buffer.alloc(0);

      this.currentProcess.stdout?.on('data', (chunk: Buffer) => {
        progressBuffer = Buffer.concat([progressBuffer, chunk]);
        
        // 解析进度
        const lines = progressBuffer.toString().split('\n');
        progressBuffer = Buffer.from(lines.pop() || '');
        
        for (const line of lines) {
          const progress = ProgressParser.parseProgressChunk(Buffer.from(line));
          if (progress) {
            this.emit('preview-progress', { progress });
          }
        }
      });

      this.currentProcess.stderr?.on('data', (chunk: Buffer) => {
        // FFmpeg 错误信息
        const errorMsg = chunk.toString();
        this.logger.debug('FFmpeg 预览错误信息', { error: errorMsg });
      });

      this.currentProcess.on('close', (code) => {
        this.currentProcess = null;
        
        if (code === 0) {
          // 原子写入
          try {
            fs.renameSync(tempPath, outputPath);
            this.logger.info('视频预览生成完成', { outputPath });
            this.emit('preview-done', { outputPath });
            resolve(outputPath);
          } catch (error) {
            this.logger.error('重命名预览文件失败', { 
              tempPath, 
              outputPath, 
              error: error instanceof Error ? error.message : String(error) 
            });
            reject(new Error('重命名预览文件失败'));
          }
        } else {
          // 清理临时文件
          this.cleanupTempFile(tempPath);
          const error = new Error(`FFmpeg 预览失败，退出码: ${code}`);
          this.logger.error('视频预览生成失败', { code, tempPath });
          this.emit('preview-error', { error: error.message });
          reject(error);
        }
      });

      this.currentProcess.on('error', (error) => {
        this.currentProcess = null;
        this.cleanupTempFile(tempPath);
        this.logger.error('预览进程启动失败', { 
          error: error.message,
          tempPath 
        });
        this.emit('preview-error', { error: error.message });
        reject(error);
      });

      this.emit('preview-start', { tempPath });

      } catch (error) {
        // spawn失败时的处理
        this.currentProcess = null;
        this.cleanupTempFile(tempPath);
        this.logger.error('预览进程启动失败', { 
          error: error instanceof Error ? error.message : String(error),
          tempPath 
        });
        this.emit('preview-error', { error: error instanceof Error ? error.message : String(error) });
        reject(error);
      }
    });
  }

  /**
   * 生成 GIF 预览
   */
  async generateGifPreview(
    input: string,
    range: { startSec: number; endSec: number },
    fps: number = 12,
    maxWidth: number = 640,
    dithering: 'bayer' | 'floyd' = 'bayer'
  ): Promise<string> {
    // 取消当前任务
    await this.cancelPreview();

    // 限制预览时长（最多10秒）
    const maxPreviewDuration = 10;
    const actualDuration = Math.min(range.endSec - range.startSec, maxPreviewDuration);
    const previewRange = {
      startSec: range.startSec,
      endSec: range.startSec + actualDuration
    };

    // 创建专用的临时目录用于调色板（固定在 {userData}/temp/previews/{jobId}/）
    const jobId = crypto.randomUUID();
    const jobDir = path.join(this.tempDir, jobId);
    fs.mkdirSync(jobDir, { recursive: true });
    
    const outputPath = path.join(this.tempDir, `${crypto.randomUUID()}.gif`);
    const palettePath = path.join(jobDir, 'palette.png');
    const tempPath = `${outputPath}.tmp`;

    // 确保在任务完成/取消时清理jobId目录
    const cleanupJobDir = () => {
      try {
        if (fs.existsSync(jobDir)) {
          fs.rmSync(jobDir, { recursive: true, force: true });
          this.logger.debug('已清理jobId目录', { jobDir });
        }
      } catch (error) {
        this.logger.warn('清理jobId目录失败', { jobDir, error });
      }
    };

    return new Promise(async (resolve, reject) => {
      try {
        // 第一步：生成调色板
        const paletteArgs = [
          '-y',
          '-ss', previewRange.startSec.toString(),
          '-to', previewRange.endSec.toString(),
          '-i', input, // 直接使用原始路径
          '-vf', `fps=${fps},scale='min(${maxWidth},iw)':-1:flags=lanczos,palettegen=max_colors=128`,
          palettePath // 输出到jobId目录
        ];

        this.logger.info('开始生成 GIF 调色板', { paletteArgs, previewDuration: actualDuration });

        const paletteProcess = spawn(this.ffmpegPaths.ffmpeg, paletteArgs, {
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
          windowsHide: true,
          detached: false
        });

        await new Promise<void>((paletteResolve, paletteReject) => {
          paletteProcess.on('close', (code) => {
            if (code === 0) {
              paletteResolve();
            } else {
              paletteReject(new Error(`调色板生成失败，退出码: ${code}`));
            }
          });

          paletteProcess.on('error', paletteReject);
        });

        // 第二步：应用调色板生成 GIF（使用相同的 -ss/-to 区间）
        const gifArgs = [
          '-y',
          '-ss', previewRange.startSec.toString(),
          '-to', previewRange.endSec.toString(),
          '-i', input, // 直接使用原始路径
          '-i', palettePath, // 调色板文件
          '-lavfi', `fps=${fps},scale='min(${maxWidth},iw)':-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=${dithering}:bayer_scale=5`,
          '-loop', '0', // 无限循环
          '-progress', 'pipe:1',
          '-nostats',
          tempPath
        ];

        this.logger.info('开始生成 GIF', { gifArgs });

        this.currentProcess = spawn(this.ffmpegPaths.ffmpeg, gifArgs, {
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
          windowsHide: true,
          detached: false
        });

        let progressBuffer = Buffer.alloc(0);

        this.currentProcess.stdout?.on('data', (chunk: Buffer) => {
          progressBuffer = Buffer.concat([progressBuffer, chunk]);
          
          const lines = progressBuffer.toString().split('\n');
          progressBuffer = Buffer.from(lines.pop() || '');
          
          for (const line of lines) {
            const progress = ProgressParser.parseProgressChunk(Buffer.from(line));
            if (progress) {
              this.emit('preview-progress', { progress });
            }
          }
        });

        this.currentProcess.on('close', (code) => {
          this.currentProcess = null;
          
          // 清理整个jobId目录（包含palette.png）
          cleanupJobDir();
          
          if (code === 0) {
            try {
              fs.renameSync(tempPath, outputPath);
              this.logger.info('GIF 预览生成完成', { outputPath });
              this.emit('preview-done', { outputPath });
              resolve(outputPath);
            } catch (error) {
              this.logger.error('重命名 GIF 预览文件失败', { 
                tempPath, 
                outputPath, 
                error: error instanceof Error ? error.message : String(error) 
              });
              this.cleanupTempFile(tempPath);
              reject(new Error('重命名 GIF 预览文件失败'));
            }
          } else {
            this.cleanupTempFile(tempPath);
            const error = new Error(`GIF 预览生成失败，退出码: ${code}`);
            this.logger.error('GIF 预览生成失败', { code, tempPath });
            this.emit('preview-error', { error: error.message });
            reject(error);
          }
        });

        this.currentProcess.on('error', (error) => {
          this.currentProcess = null;
          this.cleanupTempFile(tempPath);
          // 清理整个jobId目录
          cleanupJobDir();
          this.logger.error('GIF 预览进程启动失败', { 
            error: error.message,
            tempPath 
          });
          this.emit('preview-error', { error: error.message });
          reject(error);
        });

        this.emit('preview-start', { tempPath });
      } catch (error) {
        // 清理整个jobId目录
        cleanupJobDir();
        this.cleanupTempFile(tempPath);
        reject(error);
      }
    });
  }

  /**
   * 清理临时文件
   */
  private cleanupTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.debug('清理临时文件', { filePath });
      }
    } catch (error) {
      this.logger.warn('清理临时文件失败', { 
        filePath, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * 获取当前预览进程状态
   */
  isPreviewing(): boolean {
    return this.currentProcess !== null && !this.currentProcess.killed;
  }

  /**
   * 清理所有预览文件
   */
  cleanupAllPreviews(): void {
    try {
      const files = fs.readdirSync(this.tempDir);
      if (!Array.isArray(files)) {
        this.logger.warn('清理所有预览文件失败', { error: 'files is not iterable' });
        return;
      }
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        fs.unlinkSync(filePath);
      }
      this.logger.info('清理所有预览文件', { count: files.length });
    } catch (error) {
      this.logger.warn('清理所有预览文件失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}