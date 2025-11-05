import { 
  VideoCodec, 
  VideoPreset, 
  Container, 
  AudioPolicy, 
  PresetName 
} from '../../shared/types';
import { PathEscapeUtils } from './pathEscapeUtils';

/**
 * FFmpeg 参数构建器
 */
export class ArgsBuilder {
  /**
   * 构建视频转码参数
   */
  static buildVideoArgs(
    codec: VideoCodec,
    preset: VideoPreset,
    _container: Container,
    audio: AudioPolicy,
    _fastStart: boolean = true
  ): string[] {
    const args: string[] = [];
    
    // 视频编码器参数
    args.push('-c:v', codec);
    
    // 添加预设参数
    args.push(...preset.args);
    
    // 音频处理
    if (audio.mode === 'copy') {
      args.push('-c:a', 'copy');
    } else {
      args.push('-c:a', audio.codec);
      args.push('-b:a', `${audio.bitrateK}k`);
    }
    
    return args;
  }

  /**
   * 构建完整的 FFmpeg 命令参数
   */
  static buildFullArgs(
    input: string,
    output: string,
    codec: VideoCodec,
    preset: VideoPreset,
    container: Container,
    audio: AudioPolicy,
    fastStart: boolean = true,
    extraArgs: string[] = [],
    subtitlePath?: string
  ): string[] {
    // 验证路径（但不转义，因为spawn使用数组参数）
    const inputValidation = PathEscapeUtils.validatePath(input);
    if (!inputValidation.valid) {
      throw new Error(`输入路径无效: ${inputValidation.reason}`);
    }

    const outputValidation = PathEscapeUtils.validatePath(output);
    if (!outputValidation.valid) {
      throw new Error(`输出路径无效: ${outputValidation.reason}`);
    }

    const args: string[] = [
      '-y', // 覆盖输出文件
      '-i', input, // 直接使用原始路径
      ...this.buildVideoArgs(codec, preset, container, audio, fastStart),
      ...extraArgs
    ];

    // 添加字幕处理
    if (subtitlePath) {
      const subtitleValidation = PathEscapeUtils.validatePath(subtitlePath);
      if (subtitleValidation.valid) {
        // 字幕路径需要在滤镜字符串中转义
        const escapedSubtitle = PathEscapeUtils.escapeSubtitleFilterPath(subtitlePath);
        args.push('-vf', `subtitles='${escapedSubtitle}'`);
      } else {
        throw new Error(`字幕路径无效: ${subtitleValidation.reason}`);
      }
    }

    // 显式指定输出容器格式（解决临时文件扩展名问题）
    const format = container === 'mp4' ? 'mp4' : 'matroska';
    args.push('-f', format);

    // 容器格式特定参数（必须在输出文件之前）
    if (container === 'mp4' && fastStart) {
      args.push('-movflags', '+faststart');
    }

    // 进度和统计参数必须在输出文件之前
    args.push('-progress', 'pipe:1'); // 输出进度到 stdout
    args.push('-nostats'); // 禁用统计信息
    
    // 输出文件必须在最后
    args.push(output); // 直接使用原始路径
    
    return args;
  }

  /**
   * 获取预设配置
   */
  static toPreset(name: PresetName, codec: VideoCodec): VideoPreset {
    switch (name) {
      case 'hq_slow':
        return this.getHQSlowPreset(codec);
      case 'balanced':
        return this.getBalancedPreset(codec);
      case 'fast_small':
        return this.getFastSmallPreset(codec);
      case 'custom':
        return { name: 'custom', args: [] };
      default:
        throw new Error(`未知预设: ${name}`);
    }
  }

  /**
   * 高质量慢速预设
   */
  private static getHQSlowPreset(codec: VideoCodec): VideoPreset {
    switch (codec) {
      case 'libx264':
        return { name: 'hq_slow', args: ['-preset', 'slow', '-crf', '18'] };
      case 'libx265':
        return { name: 'hq_slow', args: ['-preset', 'slow', '-crf', '20'] };
      case 'h264_nvenc':
        return { name: 'hq_slow', args: ['-preset', 'p7', '-rc', 'vbr', '-cq', '19', '-b:v', '0'] };
      case 'hevc_nvenc':
        return { name: 'hq_slow', args: ['-preset', 'p7', '-rc', 'vbr', '-cq', '21', '-b:v', '0'] };
      case 'h264_qsv':
        return { name: 'hq_slow', args: ['-preset', 'slow', '-global_quality', '19'] };
      case 'hevc_qsv':
        return { name: 'hq_slow', args: ['-preset', 'slow', '-global_quality', '21'] };
      case 'h264_videotoolbox':
        // VideoToolbox: 使用固定码率避免文件过大
        return { name: 'hq_slow', args: ['-allow_sw', '1', '-b:v', '2M'] };
      case 'hevc_videotoolbox':
        return { name: 'hq_slow', args: ['-allow_sw', '1', '-b:v', '1.5M'] };
      default:
        throw new Error(`不支持的编码器: ${codec}`);
    }
  }

  /**
   * 平衡预设
   */
  private static getBalancedPreset(codec: VideoCodec): VideoPreset {
    switch (codec) {
      case 'libx264':
        return { name: 'balanced', args: ['-preset', 'medium', '-crf', '22'] };
      case 'libx265':
        return { name: 'balanced', args: ['-preset', 'medium', '-crf', '24'] };
      case 'h264_nvenc':
        return { name: 'balanced', args: ['-preset', 'p4', '-rc', 'vbr', '-cq', '22', '-b:v', '0'] };
      case 'hevc_nvenc':
        return { name: 'balanced', args: ['-preset', 'p4', '-rc', 'vbr', '-cq', '24', '-b:v', '0'] };
      case 'h264_qsv':
        return { name: 'balanced', args: ['-preset', 'medium', '-global_quality', '22'] };
      case 'hevc_qsv':
        return { name: 'balanced', args: ['-preset', 'medium', '-global_quality', '24'] };
      case 'h264_videotoolbox':
        return { name: 'balanced', args: ['-allow_sw', '1', '-b:v', '1M'] };
      case 'hevc_videotoolbox':
        return { name: 'balanced', args: ['-allow_sw', '1', '-b:v', '800k'] };
      default:
        throw new Error(`不支持的编码器: ${codec}`);
    }
  }

  /**
   * 快速小文件预设
   */
  private static getFastSmallPreset(codec: VideoCodec): VideoPreset {
    switch (codec) {
      case 'libx264':
        return { name: 'fast_small', args: ['-preset', 'veryfast', '-crf', '26'] };
      case 'libx265':
        return { name: 'fast_small', args: ['-preset', 'veryfast', '-crf', '28'] };
      case 'h264_nvenc':
        return { name: 'fast_small', args: ['-preset', 'p3', '-rc', 'vbr', '-cq', '27', '-b:v', '0'] };
      case 'hevc_nvenc':
        return { name: 'fast_small', args: ['-preset', 'p3', '-rc', 'vbr', '-cq', '29', '-b:v', '0'] };
      case 'h264_qsv':
        return { name: 'fast_small', args: ['-preset', 'veryfast', '-global_quality', '27'] };
      case 'hevc_qsv':
        return { name: 'fast_small', args: ['-preset', 'veryfast', '-global_quality', '29'] };
      case 'h264_videotoolbox':
        return { name: 'fast_small', args: ['-allow_sw', '1', '-b:v', '500k'] };
      case 'hevc_videotoolbox':
        return { name: 'fast_small', args: ['-allow_sw', '1', '-b:v', '400k'] };
      default:
        throw new Error(`不支持的编码器: ${codec}`);
    }
  }

  /**
   * 内置预设常量
   */
  static readonly PRESETS = {
    HQ_SLOW: { name: 'hq_slow' as PresetName, args: [] as string[] },
    BALANCED: { name: 'balanced' as PresetName, args: [] as string[] },
    FAST_SMALL: { name: 'fast_small' as PresetName, args: [] as string[] }
  };

  /**
   * 检查编码器是否支持硬件加速
   */
  static isHardwareAccelerated(codec: VideoCodec): boolean {
    return codec.includes('nvenc') || 
           codec.includes('qsv') || 
           codec.includes('videotoolbox');
  }

  /**
   * 获取编码器类型
   */
  static getCodecType(codec: VideoCodec): 'software' | 'nvenc' | 'qsv' | 'videotoolbox' {
    if (codec.includes('nvenc')) return 'nvenc';
    if (codec.includes('qsv')) return 'qsv';
    if (codec.includes('videotoolbox')) return 'videotoolbox';
    return 'software';
  }

  /**
   * 验证音频码率
   */
  static validateAudioBitrate(bitrateK: number): boolean {
    return bitrateK > 0 && bitrateK <= 320;
  }

  /**
   * 获取推荐的音频码率
   */
  static getRecommendedAudioBitrate(codec: 'aac' | 'libopus' | 'libmp3lame'): number {
    switch (codec) {
      case 'aac':
        return 128;
      case 'libopus':
        return 96;
      case 'libmp3lame':
        return 128;
      default:
        return 128;
    }
  }

  /**
   * 构建字幕内嵌参数
   */
  static buildSubtitleArgs(subtitleFile: string, subtitleIndex: number = 0): string[] {
    return [
      '-i', subtitleFile,
      '-c:s', 'mov_text', // 对于 MP4
      '-map', '0:v', // 视频流
      '-map', '0:a', // 音频流
      '-map', `1:${subtitleIndex}` // 字幕流
    ];
  }

  /**
   * 构建视频裁剪参数
   */
  static buildCropArgs(startTime: number, duration: number): string[] {
    return [
      '-ss', startTime.toString(),
      '-t', duration.toString()
    ];
  }

  /**
   * 构建分辨率缩放参数
   */
  static buildScaleArgs(width: number, height: number, algorithm: 'lanczos' | 'bilinear' = 'lanczos'): string[] {
    return [
      '-vf', `scale=${width}:${height}:flags=${algorithm}`
    ];
  }
}
