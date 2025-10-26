import { ipcMain, dialog, shell } from 'electron';
import { FfmpegService } from '../services/ffmpeg/ffmpegService';
import { JobQueue } from '../services/queue/jobQueue';
import { ConsoleLogger } from '../services/logger';
import { configService } from '../services/config';
import { mainWindow } from './main';
import { 
  TranscodeOptions,
  ERRORS 
} from '../shared/types';

// 全局服务实例
let ffmpegService: FfmpegService | null = null;
let jobQueue: JobQueue | null = null;
let logger: ConsoleLogger | null = null;

/**
 * 初始化服务
 */
function initializeServices(): void {
  if (!logger) {
    logger = new ConsoleLogger('info');
  }

  try {
    const paths = configService.getPaths();
    
    if (!ffmpegService) {
      ffmpegService = new FfmpegService(paths, logger);
    }
    
    if (!jobQueue) {
      jobQueue = new JobQueue(ffmpegService, logger);
      
      // 订阅队列事件并转发到渲染进程
      jobQueue.on('job-start', (data) => {
        mainWindow?.webContents.send('queue/events', {
          type: 'job-start',
          job: data.job
        });
      });
      
      jobQueue.on('job-progress', (data) => {
        mainWindow?.webContents.send('queue/events', {
          type: 'job-progress',
          job: data.job,
          progress: data.progress
        });
      });
      
      jobQueue.on('job-done', (data) => {
        mainWindow?.webContents.send('queue/events', {
          type: 'job-done',
          job: data.job
        });
      });
      
      jobQueue.on('job-error', (data) => {
        mainWindow?.webContents.send('queue/events', {
          type: 'job-error',
          job: data.job,
          error: data.error
        });
      });
      
      jobQueue.on('job-canceled', (data) => {
        mainWindow?.webContents.send('queue/events', {
          type: 'job-canceled',
          job: data.job
        });
      });
      
      jobQueue.on('queue-empty', () => {
        mainWindow?.webContents.send('queue/events', {
          type: 'queue-empty'
        });
      });
    }
    
    logger.info('IPC服务已初始化');
  } catch (error) {
    // FFmpeg 未配置时，延迟初始化服务
    logger.warn('FFmpeg未配置，延迟初始化服务', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    // 不抛出错误，允许用户进入设置页配置 FFmpeg
  }
}

/**
 * 重新初始化服务（在设置FFmpeg路径后调用）
 */
function reinitializeServices(): boolean {
  try {
    logger?.info('尝试重新初始化服务');
    
    // 销毁旧实例
    if (ffmpegService) {
      logger?.info('销毁旧的FfmpegService实例');
      ffmpegService = null;
    }
    
    if (jobQueue) {
      logger?.info('销毁旧的JobQueue实例');
      jobQueue = null;
    }
    
    // 重新初始化服务
    initializeServices();
    
    return ffmpegService !== null && jobQueue !== null;
  } catch (error) {
    logger?.error('重新初始化服务失败', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/**
 * 验证转码选项
 */
function validateTranscodeOptions(options: TranscodeOptions): void {
  const { input, outputDir, container, videoCodec, audio } = options;
  
  // 检查输入文件
  if (!input || typeof input !== 'string') {
    throw new Error('输入文件路径无效');
  }
  
  // 检查输出目录
  if (!outputDir || typeof outputDir !== 'string') {
    throw new Error('输出目录路径无效');
  }
  
  // 检查容器格式
  if (!['mp4', 'mkv'].includes(container)) {
    throw new Error('不支持的容器格式');
  }
  
  // 检查视频编码器
  const validCodecs = [
    'libx264', 'libx265',
    'h264_nvenc', 'hevc_nvenc',
    'h264_qsv', 'hevc_qsv',
    'h264_videotoolbox', 'hevc_videotoolbox'
  ];
  if (!validCodecs.includes(videoCodec)) {
    throw new Error('不支持的视频编码器');
  }
  
  // 检查音频设置
  if (audio.mode === 'encode') {
    if (!['aac', 'libopus', 'libmp3lame'].includes(audio.codec)) {
      throw new Error('不支持的音频编码器');
    }
    if (audio.bitrateK < 32 || audio.bitrateK > 320) {
      throw new Error('音频码率超出范围 (32-320k)');
    }
  }
}

/**
 * 设置 IPC 处理器
 */
export function setupIPC(): void {
  // 初始化服务
  initializeServices();

  // FFmpeg 相关 IPC
  
  /**
   * 探测视频文件信息
   */
  ipcMain.handle('ffmpeg/probe', async (_event, { input }: { input: string }) => {
    try {
      // 如果服务未初始化，尝试重新初始化
      if (!ffmpegService) {
        logger?.warn('FFmpeg服务未初始化，尝试重新初始化');
        const reinitSuccess = reinitializeServices();
        if (!reinitSuccess || !ffmpegService) {
          throw new Error('FFmpeg 服务未配置，请在设置页配置 FFmpeg 路径');
        }
      }
      
      const result = await ffmpegService.probe(input);
      return result;
    } catch (error) {
      logger?.error('视频探测失败', { 
        input, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  });

  /**
   * 添加任务到队列
   */
  ipcMain.handle('ffmpeg/queue/enqueue', async (_event, options: TranscodeOptions) => {
    try {
      // 如果服务未初始化，尝试重新初始化
      if (!jobQueue) {
        logger?.warn('任务队列未初始化，尝试重新初始化');
        const reinitSuccess = reinitializeServices();
        if (!reinitSuccess || !jobQueue) {
          throw new Error('任务队列未配置，请在设置页配置 FFmpeg 路径');
        }
      }
      
      // 验证参数
      validateTranscodeOptions(options);
      
      const job = jobQueue.enqueue(options);
      logger?.info('任务已加入队列', { jobId: job.id, input: options.input });
      
      return { jobId: job.id };
    } catch (error) {
      logger?.error('添加任务失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  });

  /**
   * 开始处理队列
   */
  ipcMain.handle('ffmpeg/queue/start', async (_event) => {
    try {
      if (!jobQueue) {
        throw new Error('任务队列未初始化');
      }
      
      jobQueue.start();
      logger?.info('任务队列已开始处理');
      
      return { started: true };
    } catch (error) {
      logger?.error('启动队列失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  });

  /**
   * 取消任务
   */
  ipcMain.handle('ffmpeg/queue/cancel', async (_event, { jobId }: { jobId: string }) => {
    try {
      if (!jobQueue) {
        throw new Error('任务队列未初始化');
      }
      
      jobQueue.cancel(jobId);
      logger?.info('任务已取消', { jobId });
      
      return { ok: true };
    } catch (error) {
      logger?.error('取消任务失败', { 
        jobId, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  });

  /**
   * 暂停任务
   */
  ipcMain.handle('ffmpeg/queue/pause', async (_event, { jobId }: { jobId: string }) => {
    try {
      if (!jobQueue) {
        throw new Error('任务队列未初始化');
      }
      
      // Windows 平台检查
      if (process.platform === 'win32') {
        const error = new Error('Windows 系统暂不支持暂停功能');
        error.name = ERRORS.PAUSE_UNSUPPORTED_WINDOWS;
        throw error;
      }
      
      jobQueue.pause(jobId);
      logger?.info('任务已暂停', { jobId });
      
      return { ok: true };
    } catch (error) {
      logger?.error('暂停任务失败', { 
        jobId, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  });

  /**
   * 恢复任务
   */
  ipcMain.handle('ffmpeg/queue/resume', async (_event, { jobId }: { jobId: string }) => {
    try {
      if (!jobQueue) {
        throw new Error('任务队列未初始化');
      }
      
      // Windows 平台检查
      if (process.platform === 'win32') {
        const error = new Error('Windows 系统暂不支持恢复功能');
        error.name = ERRORS.PAUSE_UNSUPPORTED_WINDOWS;
        throw error;
      }
      
      jobQueue.resume(jobId);
      logger?.info('任务已恢复', { jobId });
      
      return { ok: true };
    } catch (error) {
      logger?.error('恢复任务失败', { 
        jobId, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  });

  /**
   * 清空任务队列
   */
  ipcMain.handle('ffmpeg/queue/clear', async (_event) => {
    try {
      if (!jobQueue) {
        throw new Error('任务队列未初始化');
      }
      
      jobQueue.clear();
      logger?.info('任务队列已清空');
      
      return { ok: true };
    } catch (error) {
      logger?.error('清空队列失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  });

  // 注意：设置相关IPC已移至SettingsIPC类处理

  // GPU 检测相关 IPC
  
  /**
   * 检测硬件加速支持
   */
  ipcMain.handle('gpu/detect', async (_event) => {
    try {
      const { spawn } = await import('child_process');
      const paths = configService.getPaths();
      
      const results = await Promise.allSettled([
        // 检测硬件加速器
        new Promise<string[]>((resolve, reject) => {
          const process = spawn(paths.ffmpeg, ['-hwaccels'], { stdio: 'pipe' });
          let output = '';
          
          process.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          process.on('close', (code) => {
            if (code === 0) {
              const hwaccels = output
                .split('\n')
                .filter(line => line.trim() && !line.includes('Hardware acceleration methods:'))
                .map(line => line.trim())
                .filter(Boolean);
              resolve(hwaccels);
            } else {
              reject(new Error(`FFmpeg 退出码: ${code}`));
            }
          });
          
          process.on('error', reject);
          
          // 5秒超时
          setTimeout(() => {
            process.kill();
            reject(new Error('检测超时'));
          }, 5000);
        }),
        
        // 检测编码器
        new Promise<string[]>((resolve, reject) => {
          const process = spawn(paths.ffmpeg, ['-encoders'], { stdio: 'pipe' });
          let output = '';
          
          process.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          process.on('close', (code) => {
            if (code === 0) {
              const encoders = output
                .split('\n')
                .filter(line => line.includes('_nvenc') || line.includes('_qsv') || line.includes('_videotoolbox'))
                .map(line => line.trim().split(/\s+/)[1])
                .filter((encoder): encoder is string => Boolean(encoder));
              resolve(encoders);
            } else {
              reject(new Error(`FFmpeg 退出码: ${code}`));
            }
          });
          
          process.on('error', reject);
          
          // 5秒超时
          setTimeout(() => {
            process.kill();
            reject(new Error('检测超时'));
          }, 5000);
        })
      ]);
      
      const hwaccels = results[0].status === 'fulfilled' ? results[0].value : [];
      const encoders = results[1].status === 'fulfilled' ? results[1].value : [];
      
      logger?.info('GPU 检测完成', { hwaccels, encoders });
      
      return { hwaccels, encoders };
    } catch (error) {
      logger?.error('GPU 检测失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return { hwaccels: [], encoders: [] };
    }
  });

  /**
   * GPU 自测
   */
  ipcMain.handle('gpu/selfTest', async (_event, { encoder }: { encoder: string }) => {
    try {
      const { spawn } = await import('child_process');
      const paths = configService.getPaths();
      
      // 执行1秒快速自测
      return new Promise<{ available: boolean; error?: string }>((resolve) => {
        const process = spawn(paths.ffmpeg, [
          '-hide_banner',
          '-y',
          '-f', 'lavfi',
          '-i', 'testsrc=size=128x72:rate=30',
          '-t', '1',
          '-c:v', encoder,
          '-f', 'null',
          '-'
        ], { stdio: 'pipe' });
        
        let stderr = '';
        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        process.on('close', (code) => {
          if (code === 0) {
            resolve({ available: true });
          } else {
            // 返回前40行错误信息用于显示
            const errorLines = stderr.split('\n').slice(0, 40).join('\n');
            resolve({ 
              available: false, 
              error: errorLines || `编码器测试失败，退出码: ${code}` 
            });
          }
        });
        
        process.on('error', (error) => {
          resolve({ 
            available: false, 
            error: error.message 
          });
        });
        
        // 3秒超时
        setTimeout(() => {
          process.kill();
          resolve({ 
            available: false, 
            error: '测试超时' 
          });
        }, 3000);
      });
    } catch (error) {
      logger?.error('GPU 自测失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return { available: false, error: '自测启动失败' };
    }
  });

  // 文件对话框相关 IPC
  
  /**
   * 选择视频文件
   */
  ipcMain.handle('dialog/select-videos', async (_event, {}) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: '选择视频文件',
        filters: [
          { name: '视频文件', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'] },
          { name: '所有文件', extensions: ['*'] }
        ],
        properties: ['openFile', 'multiSelections']
      });
      
      return result;
    } catch (error) {
      logger?.error('选择视频文件失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  });

  /**
   * 选择输出目录
   */
  ipcMain.handle('dialog/select-output-dir', async (_event) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: '选择输出目录',
        properties: ['openDirectory', 'createDirectory']
      });
      
      return result;
    } catch (error) {
      logger?.error('选择输出目录失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  });

  /**
   * 选择字幕文件
   */
  ipcMain.handle('dialog/select-subtitle', async (_event, {}) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: '选择字幕文件',
        filters: [
          { name: '字幕文件', extensions: ['srt', 'ass', 'ssa', 'vtt'] },
          { name: '所有文件', extensions: ['*'] }
        ],
        properties: ['openFile']
      });
      
      return result;
    } catch (error) {
      logger?.error('选择字幕文件失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  });

  /**
   * 打开文件所在目录
   */
  ipcMain.handle('shell/open-path', async (_event, { path }: { path: string }) => {
    try {
      await shell.showItemInFolder(path);
      return { ok: true };
    } catch (error) {
      logger?.error('打开文件目录失败', { 
        path, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  });

  /**
   * 分块保存大文件到临时目录
   */
  ipcMain.handle('file/save-temp-chunk', async (_event, { fileData, fileName, isFirstChunk, isLastChunk }: { 
    fileData: number[], 
    fileName: string, 
    isFirstChunk: boolean,
    isLastChunk: boolean 
  }) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      
      // 获取临时目录
      const tempDir = path.join(os.tmpdir(), 'ffmpeg-app-temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // 生成唯一文件名（只在第一个chunk时）
      let tempFilePath: string;
      if (isFirstChunk) {
        const timestamp = Date.now();
        const ext = path.extname(fileName);
        const baseName = path.basename(fileName, ext);
        const tempFileName = `${baseName}_${timestamp}${ext}`;
        tempFilePath = path.join(tempDir, tempFileName);
        
        // 清理旧文件（如果存在）
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } else {
        // 获取之前保存的临时文件路径
        const files = fs.readdirSync(tempDir).filter(f => f.startsWith(path.basename(fileName, path.extname(fileName))));
        if (files.length === 0) {
          throw new Error('临时文件丢失');
        }
        tempFilePath = path.join(tempDir, files[0]);
      }
      
      // 追加写入数据
      const buffer = Buffer.from(fileData);
      fs.appendFileSync(tempFilePath, buffer);
      
      if (isLastChunk) {
        logger?.info('文件已完整保存到临时目录', { 
          originalName: fileName,
          tempPath: tempFilePath,
          size: fs.statSync(tempFilePath).size
        });
      }
      
      return { tempPath: tempFilePath, isComplete: isLastChunk };
    } catch (error) {
      logger?.error('分块保存失败', { 
        fileName,
        isFirstChunk,
        isLastChunk,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  });

  /**
   * 保存文件到临时目录并返回路径
   */
  ipcMain.handle('file/save-temp', async (_event, { fileData, fileName }: { fileData: number[], fileName: string }) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      
      // 创建临时目录
      const tempDir = path.join(os.tmpdir(), 'ffmpeg-app-temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // 生成唯一文件名
      const timestamp = Date.now();
      const ext = path.extname(fileName);
      const baseName = path.basename(fileName, ext);
      const tempFileName = `${baseName}_${timestamp}${ext}`;
      const tempFilePath = path.join(tempDir, tempFileName);
      
      logger?.info('开始保存文件', { 
        originalName: fileName,
        tempPath: tempFilePath,
        dataSize: fileData.length
      });
      
      // 写入文件 - 直接使用Buffer.from处理数字数组
      const buffer = Buffer.from(fileData);
      fs.writeFileSync(tempFilePath, buffer);
      
      logger?.info('文件已保存到临时目录', { 
        originalName: fileName,
        tempPath: tempFilePath,
        size: buffer.length 
      });
      
      return { tempPath: tempFilePath };
    } catch (error) {
      logger?.error('保存临时文件失败', { 
        fileName,
        dataSize: fileData?.length,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  });

  /**
   * 清理临时文件
   */
  ipcMain.handle('file/cleanup-temp', async (_event, { tempPath }: { tempPath: string }) => {
    try {
      const fs = await import('fs');
      
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
        logger?.debug('临时文件已清理', { tempPath });
      }
      
      return { ok: true };
    } catch (error) {
      logger?.warn('清理临时文件失败', { 
        tempPath,
        error: error instanceof Error ? error.message : String(error) 
      });
      // 不抛出错误，清理失败不应该阻断流程
      return { ok: true };
    }
  });

  logger?.info('IPC 处理器已设置完成');
}
