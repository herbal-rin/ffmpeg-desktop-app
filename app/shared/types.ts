/**
 * 视频容器格式
 */
export type Container = 'mp4' | 'mkv';

/**
 * 视频编码器
 */
export type VideoCodec =
  | 'libx264' | 'libx265'
  | 'h264_nvenc' | 'hevc_nvenc'
  | 'h264_qsv'  | 'hevc_qsv'
  | 'h264_videotoolbox' | 'hevc_videotoolbox';

/**
 * 音频处理策略
 */
export type AudioPolicy =
  | { mode: 'copy' }
  | { mode: 'encode', codec: 'aac' | 'libopus' | 'libmp3lame', bitrateK: number };

/**
 * 预设名称
 */
export type PresetName = 'hq_slow' | 'balanced' | 'fast_small' | 'custom';

/**
 * 视频预设配置
 */
export interface VideoPreset {
  name: PresetName;
  // x264/x265: CRF + preset；NVENC/QSV/VT: CQ/bitrate 等
  args: string[]; // 不含 -i / 输出
}

/**
 * 转码选项
 */
export interface TranscodeOptions {
  input: string;
  outputDir: string;
  outputName?: string; // 默认与 input 同名改后缀
  container: Container;
  videoCodec: VideoCodec;
  videoPreset: VideoPreset;
  audio: AudioPolicy;
  extraArgs?: string[]; // 预留高级参数
  fastStart?: boolean; // mp4 默认 true => -movflags +faststart
}

/**
 * ffprobe 探测结果
 */
export interface ProbeResult {
  durationSec: number;
  width?: number;
  height?: number;
  streams?: Array<{ type: 'video' | 'audio' | 'subtitle'; codec?: string; index: number }>;
  formatName?: string;
}

/**
 * 任务状态
 */
export type JobStatus = 'queued' | 'running' | 'paused' | 'canceled' | 'failed' | 'completed';

/**
 * 进度信息
 */
export interface Progress {
  ratio: number;         // 0..1
  timeMs: number;        // out_time_ms
  speed: number;         // 倍速
  bitrate?: string;      // 例如 "2145kbits/s"
  etaSec?: number;       // 估算剩余秒数
}

/**
 * 任务对象
 */
export interface Job {
  id: string;
  opts: TranscodeOptions;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  lastProgress?: Progress;
  error?: string;
}

/**
 * FFmpeg 可执行文件路径
 */
export interface FfmpegPaths { 
  ffmpeg: string; 
  ffprobe: string; 
}

/**
 * 错误类型常量
 */
export const ERRORS = {
  FFMPEG_NOT_FOUND: 'ERR_FFMPEG_NOT_FOUND',
  BAD_OPTIONS: 'ERR_BAD_OPTIONS',
  PAUSE_UNSUPPORTED_WINDOWS: 'ERR_PAUSE_UNSUPPORTED_WINDOWS',
  FFMPEG_EXIT: 'FFMPEG_EXIT'
} as const;

/**
 * 任务队列事件类型
 */
export interface JobQueueEvents {
  'job-start': { job: Job };
  'job-progress': { job: Job; progress: Progress };
  'job-done': { job: Job };
  'job-error': { job: Job; error: string };
  'job-canceled': { job: Job };
  'queue-empty': {};
}

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 日志接口
 */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(meta: Record<string, unknown>): Logger;
}

/**
 * 队列事件载荷
 */
export interface QueueEventPayload {
  type: 'job-start' | 'job-progress' | 'job-done' | 'job-failed' | 'job-canceled' | 'queue-empty';
  job?: Job;
  error?: string;
  progress?: Progress;
}

/**
 * 设置数据
 */
export interface SettingsData {
  defaultOutputDir: string;
  language: 'zh' | 'en';
  theme: 'light' | 'dark' | 'system';
  preferHardwareAccel: boolean;
  ffmpegPath: string;
  ffprobePath: string;
  ffmpegManaged: boolean;
}

/**
 * 设置请求
 */
export interface SettingsRequest {
  defaultOutputDir?: string;
  language?: 'zh' | 'en';
  theme?: 'light' | 'dark' | 'system';
  preferHardwareAccel?: boolean;
  ffmpegPath?: string;
  ffprobePath?: string;
  ffmpegManaged?: boolean;
}

/**
 * 设置响应
 */
export interface SettingsResponse {
  defaultOutputDir: string;
  language: 'zh' | 'en';
  theme: 'light' | 'dark' | 'system';
  preferHardwareAccel: boolean;
  ffmpegPath: string;
  ffprobePath: string;
  ffmpegManaged: boolean;
}
