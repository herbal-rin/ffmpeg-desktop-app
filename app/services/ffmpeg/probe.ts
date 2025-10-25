import { spawn } from 'child_process';
import { FfmpegPaths, ProbeResult, Logger } from '../../shared/types';

/**
 * FFprobe 服务类
 */
export class FFprobeService {
  constructor(
    private paths: FfmpegPaths,
    private logger: Logger
  ) {}

  /**
   * 探测视频文件信息
   */
  async probe(input: string): Promise<ProbeResult> {
    const args = [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      input
    ];

    this.logger.debug('执行 ffprobe 命令', { 
      command: this.paths.ffprobe, 
      args, 
      input 
    });

    return new Promise((resolve, reject) => {
      const process = spawn(this.paths.ffprobe, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          const error = new Error(`FFprobe 执行失败 (退出码: ${code})`);
          this.logger.error('FFprobe 执行失败', { 
            code, 
            stderr, 
            input 
          });
          reject(error);
          return;
        }

        try {
          const result = this.parseProbeOutput(stdout);
          this.logger.debug('FFprobe 执行成功', { 
            input, 
            duration: result.durationSec,
            streams: result.streams?.length 
          });
          resolve(result);
        } catch (error) {
          this.logger.error('解析 FFprobe 输出失败', { 
            error: error instanceof Error ? error.message : String(error),
            stdout,
            input 
          });
          reject(error);
        }
      });

      process.on('error', (error) => {
        this.logger.error('FFprobe 进程启动失败', { 
          error: error.message, 
          input 
        });
        reject(error);
      });
    });
  }

  /**
   * 解析 ffprobe 的 JSON 输出
   */
  private parseProbeOutput(output: string): ProbeResult {
    try {
      const data = JSON.parse(output);
      
      const format = data.format || {};
      const streams = data.streams || [];

      // 解析时长
      let durationSec = 0;
      if (format.duration) {
        durationSec = parseFloat(format.duration);
      }

      // 解析视频流信息
      let width: number | undefined;
      let height: number | undefined;
      
      const videoStream = streams.find((s: any) => s.codec_type === 'video');
      if (videoStream) {
        width = videoStream.width ? parseInt(videoStream.width) : undefined;
        height = videoStream.height ? parseInt(videoStream.height) : undefined;
      }

      // 解析所有流信息
      const streamInfo = streams.map((stream: any) => ({
        type: stream.codec_type as 'video' | 'audio' | 'subtitle',
        codec: stream.codec_name,
        index: stream.index
      }));

      return {
        durationSec,
        width: width || 0,
        height: height || 0,
        streams: streamInfo,
        formatName: format.format_name || 'unknown'
      };
    } catch (error) {
      throw new Error(`解析 FFprobe 输出失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 快速获取视频时长（用于进度计算）
   */
  async getDuration(input: string): Promise<number> {
    const result = await this.probe(input);
    return result.durationSec;
  }

  /**
   * 检查文件是否为有效的视频文件
   */
  async isValidVideo(input: string): Promise<boolean> {
    try {
      const result = await this.probe(input);
      return result.durationSec > 0 && Boolean(result.streams?.some((s: any) => s.type === 'video'));
    } catch {
      return false;
    }
  }

  /**
   * 获取视频分辨率
   */
  async getResolution(input: string): Promise<{ width: number; height: number } | null> {
    try {
      const result = await this.probe(input);
      if (result.width && result.height) {
        return { width: result.width, height: result.height };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 获取音频流信息
   */
  async getAudioStreams(input: string): Promise<Array<{ codec: string; index: number }>> {
    try {
      const result = await this.probe(input);
      return result.streams
        ?.filter((s: any) => s.type === 'audio')
        .map((s: any) => ({ codec: s.codec || 'unknown', index: s.index })) || [];
    } catch {
      return [];
    }
  }

  /**
   * 获取字幕流信息
   */
  async getSubtitleStreams(input: string): Promise<Array<{ codec: string; index: number }>> {
    try {
      const result = await this.probe(input);
      return result.streams
        ?.filter((s: any) => s.type === 'subtitle')
        .map((s: any) => ({ codec: s.codec || 'unknown', index: s.index })) || [];
    } catch {
      return [];
    }
  }
}
