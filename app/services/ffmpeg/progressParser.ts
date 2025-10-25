import { Progress } from '../../shared/types';

/**
 * FFmpeg 进度解析器
 * 解析 -progress pipe:1 输出的进度信息
 */
export class ProgressParser {
  /**
   * 解析进度数据块
   */
  static parseProgressChunk(buf: Buffer): Partial<Progress> {
    const text = buf.toString('utf8');
    const lines = text.split('\n');
    
    const result: Partial<Progress> = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const [key, value] = trimmed.split('=');
      if (!key || !value) continue;
      
      switch (key) {
        case 'out_time_ms':
          const timeMs = parseInt(value);
          if (!isNaN(timeMs) && timeMs >= 0) {
            result.timeMs = timeMs;
          }
          break;
          
        case 'speed':
          // 处理各种 speed 格式: "1.2x", "0.5x", "N/A", "0x", "inf"
          if (value === 'N/A' || value === 'inf' || value === '0x') {
            result.speed = 0; // 无效速度设为 0
          } else {
            const speedMatch = value.match(/^(\d+\.?\d*)x$/);
            if (speedMatch) {
              const speed = parseFloat(speedMatch[1]);
              if (!isNaN(speed) && speed >= 0) {
                result.speed = speed;
              }
            }
          }
          break;
          
        case 'bitrate':
          // bitrate 格式: "2145kbits/s" 或 "2.1Mbits/s"
          if (value && value !== 'N/A') {
            result.bitrate = value;
          }
          break;
          
        case 'total_size':
          // 可选：记录总大小用于其他计算
          break;
          
        case 'out_time':
          // 可选：记录输出时间字符串
          break;
      }
    }
    
    return result;
  }

  /**
   * 计算进度比例和 ETA
   */
  static calculateProgress(
    partial: Partial<Progress>, 
    totalDurationMs: number
  ): Progress {
    const timeMs = partial.timeMs || 0;
    const speed = partial.speed || 0;
    
    // 计算进度比例
    let ratio = 0;
    if (totalDurationMs > 0) {
      ratio = Math.min(timeMs / totalDurationMs, 1);
    }
    // 如果总时长未知（duration=0），ratio 保持为 0
    
    // 计算 ETA
    let etaSec: number | undefined;
    if (speed > 0 && totalDurationMs > 0) {
      const remainingMs = totalDurationMs - timeMs;
      etaSec = Math.max(0, remainingMs / (speed * 1000));
    }
    // 如果总时长未知或速度为 0，etaSec 保持为 undefined
    
    return {
      ratio,
      timeMs,
      speed,
      bitrate: partial.bitrate,
      etaSec
    };
  }

  /**
   * 解析完整的进度行
   */
  static parseProgressLine(line: string): Partial<Progress> {
    const result: Partial<Progress> = {};
    
    // 解析 out_time_ms=123456
    const timeMatch = line.match(/out_time_ms=(\d+)/);
    if (timeMatch) {
      result.timeMs = parseInt(timeMatch[1]);
    }
    
    // 解析 speed=1.2x
    const speedMatch = line.match(/speed=(\d+\.?\d*)x/);
    if (speedMatch) {
      result.speed = parseFloat(speedMatch[1]);
    }
    
    // 解析 bitrate=2145kbits\/s
    const bitrateMatch = line.match(/bitrate=([^\s]+)/);
    if (bitrateMatch) {
      result.bitrate = bitrateMatch[1];
    }
    
    return result;
  }

  /**
   * 格式化进度信息为可读字符串
   */
  static formatProgress(progress: Progress): string {
    const percentage = progress.ratio > 0 ? (progress.ratio * 100).toFixed(1) : '未知';
    const speed = progress.speed > 0 ? progress.speed.toFixed(1) : '0.0';
    const eta = progress.etaSec ? this.formatDuration(progress.etaSec) : '未知';
    const bitrate = progress.bitrate || '未知';
    
    return `${percentage}% | 速度: ${speed}x | ETA: ${eta} | 码率: ${bitrate}`;
  }

  /**
   * 格式化时长（秒）为可读字符串
   */
  static formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}秒`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${minutes}分${secs}秒`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.round(seconds % 60);
      return `${hours}小时${minutes}分${secs}秒`;
    }
  }

  /**
   * 格式化时间（毫秒）为可读字符串
   */
  static formatTimeMs(timeMs: number): string {
    return this.formatDuration(timeMs / 1000);
  }

  /**
   * 检查是否为有效的进度行
   */
  static isValidProgressLine(line: string): boolean {
    return line.includes('out_time_ms=') || 
           line.includes('speed=') || 
           line.includes('bitrate=');
  }

  /**
   * 从多行文本中提取进度信息
   */
  static extractProgressFromText(text: string): Partial<Progress> {
    const lines = text.split('\n');
    const result: Partial<Progress> = {};
    
    for (const line of lines) {
      if (this.isValidProgressLine(line)) {
        const parsed = this.parseProgressLine(line);
        Object.assign(result, parsed);
      }
    }
    
    return result;
  }
}
