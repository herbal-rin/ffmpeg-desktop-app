 /**
 * 工具相关 IPC 处理器
 */

import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Logger, FfmpegPaths } from '../shared/types';
import { PreviewService } from './previewService';
// 路径转义工具仅在需要时引入（如滤镜字符串）
import { ArgsBuilder } from '../services/ffmpeg/argsBuilder';
import { FFprobeService } from '../services/ffmpeg/probe';
import { MuxingValidator } from '../services/ffmpeg/muxingValidator';
import { 
  TrimPreviewRequest, TrimPreviewResponse,
  TrimExportRequest, TrimExportResponse,
  GifPreviewRequest, GifPreviewResponse,
  GifExportRequest, GifExportResponse,
  AudioExtractRequest, AudioExtractResponse,
  PreviewCancelRequest, PreviewCancelResponse,
  TimeRange
} from '../shared/tools';

// 全局服务实例
let previewService: PreviewService | null = null;
let ffprobeService: FFprobeService | null = null;
let logger: Logger | null = null;
let ffmpegPaths: FfmpegPaths | null = null;

/**
 * 初始化工具服务
 */
export function initializeToolsServices(services: {
  previewService: PreviewService;
  ffprobeService: FFprobeService;
  logger: Logger;
  ffmpegPaths: FfmpegPaths;
}) {
  previewService = services.previewService;
  ffprobeService = services.ffprobeService;
  logger = services.logger;
  ffmpegPaths = services.ffmpegPaths;
}

/**
 * 验证时间范围
 */
function validateTimeRange(range: TimeRange, duration: number): { valid: boolean; error?: string } {
  if (range.startSec < 0) {
    return { valid: false, error: '开始时间不能为负数' };
  }
  
  if (range.endSec <= range.startSec) {
    return { valid: false, error: '结束时间必须大于开始时间' };
  }
  
  if (range.startSec >= duration) {
    return { valid: false, error: '开始时间不能超过视频总时长' };
  }
  
  if (range.endSec > duration) {
    return { valid: false, error: '结束时间不能超过视频总时长' };
  }
  
  const rangeDuration = range.endSec - range.startSec;
  if (rangeDuration < 0.5) {
    return { valid: false, error: '时间范围至少需要 0.5 秒' };
  }
  
  return { valid: true };
}

/**
 * 尝试无损快剪，失败时自动回退到精准剪
 */
async function tryLosslessThenPrecise(
  request: TrimExportRequest,
  args: string[],
  outputPath: string,
  tempPath: string
): Promise<TrimExportResponse> {
  return new Promise(async (resolve, reject) => {
    try {
      // 首先尝试无损快剪
      logger!.info('开始执行无损快剪', { 
        args: args.join(' '),
        timeRange: { startSec: request.range.startSec, endSec: request.range.endSec }
      });
      
      const success = await executeFFmpegCommand(args);
      
      if (success) {
        // 无损快剪成功，检查输出文件时长
        const outputProbe = await ffprobeService!.probe(tempPath);
        const expectedDuration = request.range.endSec - request.range.startSec;
        const actualDuration = outputProbe.durationSec;
        const durationError = Math.abs(actualDuration - expectedDuration);
        const durationRatio = durationError / expectedDuration;
        
        logger!.info('无损快剪完成，输出文件信息', { 
          outputPath: tempPath,
          duration: actualDuration,
          expectedDuration,
          durationError,
          durationRatio
        });
        
        // 如果时长误差超过50%，说明无损快剪不精确，应该使用精准剪
        // 注意：无损快剪基于关键帧，有一定偏差是正常的，不要设置过严格
        if (durationRatio > 0.5) {
          logger!.warn('无损快剪时长不精确，切换为精准剪', {
            actualDuration,
            expectedDuration,
            errorPercent: (durationRatio * 100).toFixed(2) + '%'
          });
          
          // 清理临时文件，继续尝试精准剪
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
          
          // 检查是否原本就是无损模式
          const isLosslessMode = request.mode === 'lossless';
          
          if (isLosslessMode) {
            logger!.warn('准备切换到精准剪模式', { 
              reason: '时长不精确',
              originalMode: 'lossless',
              fallbackMode: 'precise'
            });

            // 构建精准剪参数
            const preciseArgs = buildPreciseTrimArgs(request, tempPath);
            
            // 尝试精准剪
            const preciseSuccess = await executeFFmpegCommand(preciseArgs);
            
            if (preciseSuccess) {
              fs.renameSync(tempPath, outputPath);
              logger!.info('精准剪导出完成（无损快剪时长不精确后的回退）', { outputPath });
              resolve({ output: outputPath });
            } else {
              reject(new Error('精准剪导出也失败了，请检查输入文件或调整参数'));
            }
            return;
          }
        }
        
        // 时长误差在可接受范围内，使用无损快剪的结果
        fs.renameSync(tempPath, outputPath);
        logger!.info('无损快剪导出完成', { outputPath });
        resolve({ output: outputPath });
        return;
      }

      // 无损快剪失败，清理临时文件
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }

      // 检查是否原本就是无损模式
      const isLosslessMode = request.mode === 'lossless';
      
      if (isLosslessMode) {
        logger!.warn('无损快剪失败，自动切换到精准剪', { 
          reason: '容器/编解码器不兼容或关键帧问题',
          originalMode: 'lossless',
          fallbackMode: 'precise',
          hint: '小贴士：首帧异常属关键帧特性，换精准剪可解决'
        });

        // 构建精准剪参数
        const preciseArgs = buildPreciseTrimArgs(request, tempPath);
        
        // 尝试精准剪
        const preciseSuccess = await executeFFmpegCommand(preciseArgs);
        
        if (preciseSuccess) {
          fs.renameSync(tempPath, outputPath);
          logger!.info('精准剪导出完成（无损快剪失败后的回退）', { outputPath });
          resolve({ output: outputPath });
        } else {
          reject(new Error('无损快剪和精准剪都失败了，请检查输入文件或调整参数'));
        }
      } else {
        // 原本就是精准剪模式，直接失败
        reject(new Error('精准剪导出失败，请检查输入文件或调整参数'));
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 执行 FFmpeg 命令
 */
async function executeFFmpegCommand(args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    let stderrOutput = '';
    
    const process = spawn(ffmpegPaths!.ffmpeg, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
      detached: false
    });

    // 捕获 stderr
    process.stderr?.on('data', (data) => {
      stderrOutput += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        logger!.error('FFmpeg 命令失败', { 
          code, 
          args: args.join(' '),
          stderr: stderrOutput.slice(-500) // 只保留最后 500 字符
        });
      }
      resolve(code === 0);
    });

    process.on('error', (error) => {
      logger!.error('FFmpeg 命令执行出错', { error: error.message, args: args.join(' ') });
      resolve(false);
    });
  });
}

/**
 * 构建精准剪参数
 */
function buildPreciseTrimArgs(request: TrimExportRequest, tempPath: string): string[] {
  if (!request.videoCodec) {
    throw new Error('精准剪模式需要指定视频编码器');
  }

  // 使用正确的 preset
  const preset = ArgsBuilder.toPreset('balanced', request.videoCodec);
  
  const videoArgs = ArgsBuilder.buildVideoArgs(
    request.videoCodec,
    preset,
    request.container,
    request.audio
  );

  // 添加容器格式参数
  const format = request.container === 'mp4' ? 'mp4' : 'matroska';
  
  const args = [
    '-y',
    '-i', request.input,
    '-ss', request.range.startSec.toString(),
    '-t', (request.range.endSec - request.range.startSec).toString(),
    ...videoArgs,
    '-avoid_negative_ts', 'make_zero', // 避免负时间戳
    '-vsync', '0', // 保持原始帧率，避免帧同步问题
    '-async', '1', // 音频同步
    '-f', format, // 显式指定容器格式
    tempPath
  ];

  if (request.container === 'mp4') {
    args.splice(-1, 0, '-movflags', '+faststart');
  }

  return args;
}

/**
 * 清理临时目录
 */
function cleanupTempDirectory(tempDir: string): void {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      logger!.debug('清理临时目录', { tempDir });
    }
  } catch (error) {
    logger!.warn('清理临时目录失败', { 
      tempDir, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

/**
 * 获取唯一输出文件名
 */
function getUniqueOutputPath(outputDir: string, fileName: string): string {
  const baseName = path.parse(fileName).name;
  const ext = path.parse(fileName).ext;
  let outputPath = path.join(outputDir, fileName);
  let counter = 1;

  while (fs.existsSync(outputPath)) {
    const newFileName = `${baseName} (${counter})${ext}`;
    outputPath = path.join(outputDir, newFileName);
    counter++;
  }

  return outputPath;
}

/**
 * 设置工具 IPC 处理器
 */
export function setupToolsIPC() {
  if (!previewService || !ffprobeService || !logger) {
    throw new Error('工具服务未初始化');
  }

  // 视频裁剪预览
  ipcMain.handle('tools/trim/preview', async (_event, request: TrimPreviewRequest) => {
    try {
      // 验证输入文件
      if (!fs.existsSync(request.input)) {
        throw new Error('输入文件不存在');
      }

      // 获取视频信息
      const probeResult = await ffprobeService!.probe(request.input);
      const duration = probeResult.durationSec;

      // 验证时间范围
      const validation = validateTimeRange(request.range, duration);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 生成预览
      const previewPath = await previewService!.generateVideoPreview(
        request.input,
        request.range,
        request.previewSeconds,
        request.scaleHalf
      );

      return { previewPath } as TrimPreviewResponse;
    } catch (error) {
      logger!.error('视频裁剪预览失败', { 
        error: error instanceof Error ? error.message : String(error),
        request 
      });
      throw error;
    }
  });

  // 视频裁剪导出
  ipcMain.handle('tools/trim/export', async (_event, request: TrimExportRequest) => {
    try {
      // 验证输入文件
      if (!fs.existsSync(request.input)) {
        throw new Error('输入文件不存在');
      }

      // 验证输出目录
      if (!fs.existsSync(request.outputDir)) {
        fs.mkdirSync(request.outputDir, { recursive: true });
      }

      // 获取视频信息
      const probeResult = await ffprobeService!.probe(request.input);
      const duration = probeResult.durationSec;

      // 验证时间范围
      const validation = validateTimeRange(request.range, duration);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 验证容器/编解码器兼容性
      const muxingValidation = MuxingValidator.validateMuxing({
        container: request.container,
        videoCodec: request.videoCodec,
        audio: request.audio
      });

      if (!muxingValidation.valid) {
        throw new Error(`ERR_BAD_OPTIONS: ${muxingValidation.error}`);
      }

      // 检查是否适合无损快剪
      const isLosslessSuitable = MuxingValidator.isSuitableForLossless({
        container: request.container,
        videoCodec: request.videoCodec,
        audio: request.audio
      });

      // 如果用户选择无损但条件不满足，建议使用精准剪
      if (request.mode === 'lossless' && !isLosslessSuitable) {
        logger!.warn('无损快剪条件不满足，建议使用精准剪', { 
          container: request.container,
          videoCodec: request.videoCodec,
          audio: request.audio
        });
      }

      // 生成输出文件名
      const outputName = request.outputName || `trimmed_${Date.now()}.${request.container}`;
      const outputPath = getUniqueOutputPath(request.outputDir, outputName);
      const tempPath = `${outputPath}.tmp`;

      let args: string[];

      if (request.mode === 'lossless' && isLosslessSuitable) {
        // 无损快剪：将 -ss/-to 放在 -i 后以确保精确剪切，使用 -c copy 避免重编码
        // 添加容器格式参数
        const format = request.container === 'mp4' ? 'mp4' : 'matroska';
        
        args = [
          '-y',
          '-i', request.input,
          '-ss', request.range.startSec.toString(),
          '-to', request.range.endSec.toString(),
          '-c', 'copy',
          '-map', '0', // 映射所有流
          '-avoid_negative_ts', 'make_zero',
          '-f', format, // 显式指定容器格式
          tempPath
        ];
      } else {
        // 精准剪（重编码）
        if (!request.videoCodec) {
          throw new Error('精准剪模式需要指定视频编码器');
        }

        const videoArgs = ArgsBuilder.buildVideoArgs(
          request.videoCodec,
          { name: 'balanced', args: [] },
          request.container,
          request.audio
        );

        // 添加容器格式参数
        const format = request.container === 'mp4' ? 'mp4' : 'matroska';
        
        args = [
          '-y',
          '-ss', request.range.startSec.toString(),
          '-accurate_seek', // 精准定位
          '-i', request.input, // 直接使用原始路径
          '-to', (request.range.endSec - request.range.startSec).toString(), // 使用持续时间
          ...videoArgs,
          '-force_key_frames', 'expr:gte(t,0)', // 强制关键帧
          '-f', format, // 显式指定容器格式
          tempPath
        ];

        // MP4 优化
        if (request.container === 'mp4') {
          args.splice(-1, 0, '-movflags', '+faststart');
        }
      }

      logger!.info('开始视频裁剪导出', { 
        mode: request.mode,
        args: args.join(' '), // 记录最终命令行参数
        inputFile: request.input,
        outputPath: tempPath
      });

      // 尝试无损快剪，失败时自动回退到精准剪
      return tryLosslessThenPrecise(request, args, outputPath, tempPath);
    } catch (error) {
      logger!.error('视频裁剪导出失败', { 
        error: error instanceof Error ? error.message : String(error),
        request 
      });
      throw error;
    }
  });

  // GIF 预览
  ipcMain.handle('tools/gif/preview', async (_event, request: GifPreviewRequest) => {
    try {
      // 验证输入文件
      if (!fs.existsSync(request.input)) {
        throw new Error('输入文件不存在');
      }

      // 获取视频信息
      const probeResult = await ffprobeService!.probe(request.input);
      const duration = probeResult.durationSec;

      // 验证时间范围
      const validation = validateTimeRange(request.range, duration);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 限制预览时长
      const rangeDuration = request.range.endSec - request.range.startSec;
      if (rangeDuration > 30) {
        throw new Error('GIF 预览时长不能超过 30 秒');
      }

      // 验证参数
      if (request.fps < 1 || request.fps > 30) {
        throw new Error('帧率必须在 1-30 之间');
      }

      if (request.maxWidth && (request.maxWidth < 128 || request.maxWidth > 2048)) {
        throw new Error('最大宽度必须在 128-2048 之间');
      }

      // 生成预览
      const previewPath = await previewService!.generateGifPreview(
        request.input,
        request.range,
        request.fps,
        request.maxWidth,
        request.dithering
      );

      return { previewPath } as GifPreviewResponse;
    } catch (error) {
      logger!.error('GIF 预览失败', { 
        error: error instanceof Error ? error.message : String(error),
        request 
      });
      throw error;
    }
  });

  // GIF 导出
  ipcMain.handle('tools/gif/export', async (_event, request: GifExportRequest) => {
    try {
      // 验证输入文件
      if (!fs.existsSync(request.input)) {
        throw new Error('输入文件不存在');
      }

      // 验证输出目录
      if (!fs.existsSync(request.outputDir)) {
        fs.mkdirSync(request.outputDir, { recursive: true });
      }

      // 获取视频信息
      const probeResult = await ffprobeService!.probe(request.input);
      const duration = probeResult.durationSec;

      // 验证时间范围
      const validation = validateTimeRange(request.range, duration);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 验证参数
      if (request.fps < 1 || request.fps > 30) {
        throw new Error('帧率必须在 1-30 之间');
      }

      if (request.maxWidth && (request.maxWidth < 128 || request.maxWidth > 2048)) {
        throw new Error('最大宽度必须在 128-2048 之间');
      }

      // 生成输出文件名和临时目录
      const outputName = request.outputName || `gif_${Date.now()}.gif`;
      const outputPath = getUniqueOutputPath(request.outputDir, outputName);
      const tempPath = `${outputPath}.tmp`;
      
      // 创建专用的临时目录用于调色板
      const jobId = crypto.randomUUID();
      const tempDir = path.join(request.outputDir, 'temp', jobId);
      const palettePath = path.join(tempDir, 'palette.png');
      
      // 确保临时目录存在
      fs.mkdirSync(tempDir, { recursive: true });

      logger!.info('开始 GIF 导出', { request, tempDir });

      return new Promise(async (resolve, reject) => {
        try {
          // 第一步：生成调色板
          const paletteArgs = [
            '-y',
            '-ss', request.range.startSec.toString(),
            '-to', request.range.endSec.toString(),
            '-i', request.input,
            '-vf', `fps=${request.fps},scale='min(${request.maxWidth || 640},iw)':-1:flags=lanczos,palettegen=max_colors=128`,
            palettePath
          ];

          logger!.info('生成调色板', { args: paletteArgs });

          const paletteProcess = spawn(ffmpegPaths!.ffmpeg, paletteArgs, {
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

          // 第二步：应用调色板生成 GIF
          const gifArgs = [
            '-y',
            '-ss', request.range.startSec.toString(),
            '-to', request.range.endSec.toString(),
            '-i', request.input,
            '-i', palettePath,
            '-lavfi', `fps=${request.fps},scale='min(${request.maxWidth || 640},iw)':-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=${request.dithering || 'bayer'}:bayer_scale=5`,
            '-loop', '0', // 无限循环
            tempPath
          ];

          logger!.info('生成 GIF', { args: gifArgs });

          const gifProcess = spawn(ffmpegPaths!.ffmpeg, gifArgs, {
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
            windowsHide: true,
            detached: false
          });

          gifProcess.on('close', (code) => {
            // 清理临时目录（包含调色板文件）
            cleanupTempDirectory(tempDir);

            if (code === 0) {
              try {
                fs.renameSync(tempPath, outputPath);
                logger!.info('GIF 导出完成', { outputPath });
                resolve({ output: outputPath } as GifExportResponse);
              } catch (error) {
                logger!.error('重命名 GIF 输出文件失败', { 
                  tempPath, 
                  outputPath, 
                  error: error instanceof Error ? error.message : String(error) 
                });
                reject(new Error('重命名 GIF 输出文件失败'));
              }
            } else {
              // 清理临时文件
              if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
              }
              const error = new Error(`GIF 导出失败，退出码: ${code}`);
              logger!.error('GIF 导出失败', { code, tempPath });
              reject(error);
            }
          });

          gifProcess.on('error', (error) => {
            // 清理临时文件和目录
            if (fs.existsSync(tempPath)) {
              fs.unlinkSync(tempPath);
            }
            cleanupTempDirectory(tempDir);
            logger!.error('GIF 导出进程启动失败', { 
              error: error.message,
              tempPath 
            });
            reject(error);
          });
        } catch (error) {
          // 清理临时文件
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
          if (fs.existsSync(palettePath)) {
            fs.unlinkSync(palettePath);
          }
          reject(error);
        }
      });
    } catch (error) {
      logger!.error('GIF 导出失败', { 
        error: error instanceof Error ? error.message : String(error),
        request 
      });
      throw error;
    }
  });

  // 音频提取
  ipcMain.handle('tools/audio/extract', async (_event, request: AudioExtractRequest) => {
    try {
      // 验证输入文件
      if (!fs.existsSync(request.input)) {
        throw new Error('输入文件不存在');
      }

      // 验证输出目录
      if (!fs.existsSync(request.outputDir)) {
        fs.mkdirSync(request.outputDir, { recursive: true });
      }

      // 获取视频信息
      const probeResult = await ffprobeService!.probe(request.input);
      const duration = probeResult.durationSec;

      // 验证时间范围（如果提供）
      if (request.range) {
        const validation = validateTimeRange(request.range, duration);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
      }

      // 验证编码参数
      if (request.mode === 'encode') {
        if (!request.codec) {
          throw new Error('编码模式需要指定音频编码器');
        }

        // 验证码率范围
        const recommendedBitrate = MuxingValidator.getRecommendedBitrate(request.codec);
        if (recommendedBitrate > 0 && (!request.bitrateK || request.bitrateK < 48 || request.bitrateK > 320)) {
          throw new Error(`${request.codec} 码率必须在 48-320 kbps 之间`);
        }
      }

      // 验证音轨选择
      const audioTrack = request.audioTrack || 0;
      if (audioTrack < 0) {
        throw new Error('音轨索引不能为负数');
      }

      // 生成输出文件名
      const ext = request.mode === 'copy' ? 'm4a' : 
                  request.codec === 'libmp3lame' ? 'mp3' :
                  request.codec === 'aac' ? 'aac' :
                  request.codec === 'flac' ? 'flac' :
                  request.codec === 'libopus' ? 'opus' : 'm4a';
      
      const outputName = request.outputName || `audio_${Date.now()}.${ext}`;
      const outputPath = getUniqueOutputPath(request.outputDir, outputName);
      const tempPath = `${outputPath}.tmp`;

      const args = ['-y'];

      // 时间范围
      if (request.range) {
        args.push('-ss', request.range.startSec.toString());
        args.push('-to', request.range.endSec.toString());
      }

      args.push('-i', request.input);
      
      // 音轨选择：默认 a:0，支持指定音轨
      args.push('-map', `0:a:${audioTrack}`);

      if (request.mode === 'copy') {
        args.push('-c:a', 'copy');
      } else {
        args.push('-c:a', request.codec!);
        if (request.bitrateK) {
          args.push('-b:a', `${request.bitrateK}k`);
        }
      }

      args.push(tempPath);

      logger!.info('开始音频提取', { args });

      return new Promise((resolve, reject) => {
        const process = spawn(ffmpegPaths!.ffmpeg, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
          windowsHide: true,
          detached: false
        });

        process.on('close', (code) => {
          if (code === 0) {
            try {
              fs.renameSync(tempPath, outputPath);
              logger!.info('音频提取完成', { outputPath });
              resolve({ output: outputPath } as AudioExtractResponse);
            } catch (error) {
              logger!.error('重命名音频输出文件失败', { 
                tempPath, 
                outputPath, 
                error: error instanceof Error ? error.message : String(error) 
              });
              reject(new Error('重命名音频输出文件失败'));
            }
          } else {
            // 清理临时文件
            if (fs.existsSync(tempPath)) {
              fs.unlinkSync(tempPath);
            }
            const error = new Error(`音频提取失败，退出码: ${code}`);
            logger!.error('音频提取失败', { code, tempPath });
            reject(error);
          }
        });

        process.on('error', (error) => {
          // 清理临时文件
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
          logger!.error('音频提取进程启动失败', { 
            error: error.message,
            tempPath 
          });
          reject(error);
        });
      });
    } catch (error) {
      logger!.error('音频提取失败', { 
        error: error instanceof Error ? error.message : String(error),
        request 
      });
      throw error;
    }
  });

  // 取消预览
  ipcMain.handle('tools/preview/cancel', async (_event, _request: PreviewCancelRequest) => {
    try {
      const cancelled = await previewService!.cancelPreview();
      return { ok: cancelled } as PreviewCancelResponse;
    } catch (error) {
      logger!.error('取消预览失败', { 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  });
}