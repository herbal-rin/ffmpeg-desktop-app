/**
 * 工具相关 IPC 处理器
 */

import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Logger } from '../shared/types';
import { PreviewService } from './previewService';
import { PathEscapeUtils } from '../services/ffmpeg/pathEscapeUtils';
import { ArgsBuilder } from '../services/ffmpeg/argsBuilder';
import { FFprobeService } from '../services/ffmpeg/probe';
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

/**
 * 初始化工具服务
 */
export function initializeToolsServices(services: {
  previewService: PreviewService;
  ffprobeService: FFprobeService;
  logger: Logger;
}) {
  previewService = services.previewService;
  ffprobeService = services.ffprobeService;
  logger = services.logger;
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

      // 生成输出文件名
      const outputName = request.outputName || `trimmed_${Date.now()}.${request.container}`;
      const outputPath = getUniqueOutputPath(request.outputDir, outputName);
      const tempPath = `${outputPath}.tmp`;

      let args: string[];

      if (request.mode === 'lossless') {
        // 无损快剪
        args = [
          '-y',
          '-ss', request.range.startSec.toString(),
          '-to', request.range.endSec.toString(),
          '-i', PathEscapeUtils.escapeInputPath(request.input),
          '-c', 'copy',
          '-avoid_negative_ts', 'make_zero',
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

        args = [
          '-y',
          '-ss', request.range.startSec.toString(),
          '-to', request.range.endSec.toString(),
          '-i', PathEscapeUtils.escapeInputPath(request.input),
          ...videoArgs,
          tempPath
        ];

        // MP4 优化
        if (request.container === 'mp4') {
          args.push('-movflags', '+faststart');
        }
      }

      logger!.info('开始视频裁剪导出', { args });

      return new Promise((resolve, reject) => {
        const process = spawn('ffmpeg', args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
          windowsHide: true,
          detached: false
        });

        process.on('close', (code) => {
          if (code === 0) {
            try {
              fs.renameSync(tempPath, outputPath);
              logger!.info('视频裁剪导出完成', { outputPath });
              resolve({ output: outputPath } as TrimExportResponse);
            } catch (error) {
              logger!.error('重命名输出文件失败', { 
                tempPath, 
                outputPath, 
                error: error instanceof Error ? error.message : String(error) 
              });
              reject(new Error('重命名输出文件失败'));
            }
          } else {
            // 清理临时文件
            if (fs.existsSync(tempPath)) {
              fs.unlinkSync(tempPath);
            }
            const error = new Error(`视频裁剪导出失败，退出码: ${code}`);
            logger!.error('视频裁剪导出失败', { code, tempPath });
            reject(error);
          }
        });

        process.on('error', (error) => {
          // 清理临时文件
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
          logger!.error('视频裁剪导出进程启动失败', { 
            error: error.message,
            tempPath 
          });
          reject(error);
        });
      });
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

      // 生成输出文件名
      const outputName = request.outputName || `gif_${Date.now()}.gif`;
      const outputPath = getUniqueOutputPath(request.outputDir, outputName);
      const palettePath = path.join(request.outputDir, `${crypto.randomUUID()}_palette.png`);
      const tempPath = `${outputPath}.tmp`;

      logger!.info('开始 GIF 导出', { request });

      return new Promise(async (resolve, reject) => {
        try {
          // 第一步：生成调色板
          const paletteArgs = [
            '-y',
            '-ss', request.range.startSec.toString(),
            '-to', request.range.endSec.toString(),
            '-i', PathEscapeUtils.escapeInputPath(request.input),
            '-vf', `fps=${request.fps},scale='min(${request.maxWidth || 640},iw)':-1:flags=lanczos,palettegen=max_colors=128`,
            palettePath
          ];

          const paletteProcess = spawn('ffmpeg', paletteArgs, {
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
            '-i', PathEscapeUtils.escapeInputPath(request.input),
            '-i', palettePath,
            '-lavfi', `fps=${request.fps},scale='min(${request.maxWidth || 640},iw)':-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=${request.dithering || 'bayer'}:bayer_scale=5`,
            tempPath
          ];

          const gifProcess = spawn('ffmpeg', gifArgs, {
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
            windowsHide: true,
            detached: false
          });

          gifProcess.on('close', (code) => {
            // 清理调色板文件
            if (fs.existsSync(palettePath)) {
              fs.unlinkSync(palettePath);
            }

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
            // 清理临时文件
            if (fs.existsSync(tempPath)) {
              fs.unlinkSync(tempPath);
            }
            if (fs.existsSync(palettePath)) {
              fs.unlinkSync(palettePath);
            }
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

        if (request.codec === 'libmp3lame' || request.codec === 'aac') {
          if (!request.bitrateK || request.bitrateK < 48 || request.bitrateK > 320) {
            throw new Error('MP3/AAC 码率必须在 48-320 kbps 之间');
          }
        }
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

      args.push('-i', PathEscapeUtils.escapeInputPath(request.input));
      args.push('-map', 'a'); // 只提取音频

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
        const process = spawn('ffmpeg', args, {
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