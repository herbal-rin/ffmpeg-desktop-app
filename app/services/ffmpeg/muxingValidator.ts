/**
 * 容器/编解码器兼容性校验工具
 * 确保容器、视频编码、音频编码的组合是合法的
 */

export interface MuxingOptions {
  container: 'mp4' | 'mkv';
  videoCodec?: string | undefined;
  audio: { mode: 'copy' } | { mode: 'encode'; codec: string };
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
  recommendedMode?: 'lossless' | 'precise';
}

/**
 * 容器与编解码器兼容性校验
 */
export class MuxingValidator {
  /**
   * 验证容器/编解码器组合的合法性
   */
  static validateMuxing(options: MuxingOptions): ValidationResult {
    const { container, videoCodec, audio } = options;

    // MP4 容器限制
    if (container === 'mp4') {
      // MP4 不支持 Opus 音频
      if (audio.mode === 'encode' && audio.codec === 'libopus') {
        return {
          valid: false,
          error: 'MP4 容器不支持 Opus 音频编码',
          suggestion: '请改用 AAC 或 MP3，或切换为 MKV 容器',
          recommendedMode: 'precise'
        };
      }

      // MP4 对某些视频编码的限制
      if (videoCodec === 'libx265' || videoCodec === 'hevc') {
        // HEVC 在 MP4 中可能有兼容性问题
        return {
          valid: true,
          recommendedMode: 'precise',
          suggestion: 'HEVC 编码建议使用 MKV 容器以获得更好兼容性'
        };
      }

      // MP4 推荐使用 H.264 + AAC
      if (videoCodec === 'libx264' && audio.mode === 'encode' && audio.codec === 'aac') {
        return {
          valid: true,
          recommendedMode: 'lossless'
        };
      }
    }

    // MKV 容器限制较少
    if (container === 'mkv') {
      // MKV 支持几乎所有编码组合
      return {
        valid: true,
        recommendedMode: videoCodec ? 'precise' : 'lossless'
      };
    }

    return {
      valid: true,
      recommendedMode: 'precise'
    };
  }

  /**
   * 检查是否适合无损快剪
   */
  static isSuitableForLossless(options: MuxingOptions): boolean {
    const validation = this.validateMuxing(options);
    
    if (!validation.valid) {
      return false;
    }

    // 无损快剪的条件：
    // 1. MP4 容器
    // 2. H.264 视频编码（或兼容的编码）
    // 3. 音频为 copy 模式
    if (options.container === 'mp4') {
      if (options.videoCodec && !['libx264', 'h264'].includes(options.videoCodec)) {
        return false;
      }
      if (options.audio.mode !== 'copy') {
        return false;
      }
      return true;
    }

    // MKV 容器通常也支持无损快剪
    if (options.container === 'mkv') {
      return options.audio.mode === 'copy';
    }

    return false;
  }

  /**
   * 获取推荐的编码设置
   */
  static getRecommendedSettings(container: 'mp4' | 'mkv'): {
    videoCodec: string;
    audioCodec: string;
    preset: string;
  } {
    if (container === 'mp4') {
      return {
        videoCodec: 'libx264',
        audioCodec: 'aac',
        preset: 'medium'
      };
    } else {
      return {
        videoCodec: 'libx264',
        audioCodec: 'aac',
        preset: 'medium'
      };
    }
  }

  /**
   * 获取音频编码的推荐码率
   */
  static getRecommendedBitrate(codec: string): number {
    switch (codec) {
      case 'aac':
        return 128; // 128 kbps
      case 'libmp3lame':
        return 192; // 192 kbps
      case 'libopus':
        return 96;  // 96 kbps
      case 'flac':
        return 0;   // 无损
      default:
        return 128;
    }
  }

  /**
   * 检查音频编码是否被容器支持
   */
  static isAudioCodecSupported(container: 'mp4' | 'mkv', codec: string): boolean {
    if (container === 'mp4') {
      return ['aac', 'libmp3lame', 'mp3'].includes(codec);
    } else if (container === 'mkv') {
      return ['aac', 'libmp3lame', 'mp3', 'libopus', 'flac'].includes(codec);
    }
    return false;
  }

  /**
   * 获取不支持的音频编码的错误信息
   */
  static getAudioCodecError(container: 'mp4' | 'mkv', codec: string): string | null {
    if (container === 'mp4' && codec === 'libopus') {
      return 'MP4 容器不支持 Opus 音频编码，请改用 AAC 或 MP3';
    }
    if (container === 'mp4' && codec === 'flac') {
      return 'MP4 容器不支持 FLAC 音频编码，请改用 AAC 或 MP3';
    }
    return null;
  }
}
