/**
 * Preload API 类型定义
 * 定义渲染进程可以访问的 API 接口
 */

// 基础 API 接口
export interface ElectronAPI {
  /**
   * 调用主进程方法
   */
  invoke<T = any>(channel: string, payload?: any): Promise<T>;

  /**
   * 监听主进程事件
   */
  on(channel: 'queue/events' | 'tools/events', callback: (payload: QueueEventPayload | ToolEventPayload) => void): () => void;

  /**
   * 监听菜单事件
   */
  onMenu(callback: (action: MenuAction) => void): () => void;

  /**
   * 监听应用事件
   */
  onApp(callback: (event: AppEvent) => void): () => void;
}

// 队列事件载荷
export interface QueueEventPayload {
  type: 'job-start' | 'job-progress' | 'job-done' | 'job-error' | 'job-canceled' | 'queue-empty';
  job?: Job;
  progress?: Progress;
  error?: string;
}

// 工具事件载荷
export interface ToolEventPayload {
  type: 'preview-start' | 'preview-progress' | 'preview-done' | 'preview-error' | 'preview-cancelled';
  tempPath?: string;
  progress?: Progress;
  error?: string;
}

// 菜单操作
export type MenuAction = 'add-files' | 'set-output' | 'about';

// 应用事件
export type AppEvent = 'before-quit';

// IPC 通道类型
export type IPCChannel = 
  | 'ffmpeg/probe'
  | 'ffmpeg/queue/enqueue'
  | 'ffmpeg/queue/start'
  | 'ffmpeg/queue/cancel'
  | 'ffmpeg/queue/pause'
  | 'ffmpeg/queue/resume'
  | 'settings/get'
  | 'settings/set'
  | 'gpu/detect'
  | 'dialog/select-videos'
  | 'dialog/select-output-dir'
  | 'dialog/select-subtitle'
  | 'shell/open-path'
  | 'file/save-temp'
  | 'file/cleanup-temp'
  | 'tools/trim/preview'
  | 'tools/trim/export'
  | 'tools/gif/preview'
  | 'tools/gif/export'
  | 'tools/audio/extract'
  | 'tools/preview/cancel';

// IPC 请求/响应类型
export interface ProbeRequest {
  input: string;
}

export interface EnqueueRequest {
  input: string;
  outputDir: string;
  outputName?: string;
  container: 'mp4' | 'mkv';
  videoCodec: string;
  videoPreset: {
    name: string;
    args: string[];
  };
  audio: {
    mode: 'copy' | 'encode';
    codec?: string;
    bitrateK?: number;
  };
  extraArgs?: string[];
  fastStart?: boolean;
}

export interface EnqueueResponse {
  jobId: string;
}

export interface StartResponse {
  started: boolean;
}

export interface CancelRequest {
  jobId: string;
}

export interface CancelResponse {
  ok: boolean;
}

export interface PauseRequest {
  jobId: string;
}

export interface PauseResponse {
  ok: boolean;
}

export interface ResumeRequest {
  jobId: string;
}

export interface ResumeResponse {
  ok: boolean;
}

export interface SettingsResponse {
  ffmpegPath: string;
  ffprobePath: string;
  defaultOutputDir: string;
  language: string;
  theme: string;
  hardwareAcceleration: boolean;
}

export interface SettingsRequest {
  ffmpegPath?: string;
  ffprobePath?: string;
  defaultOutputDir?: string;
  language?: string;
  theme?: string;
  hardwareAcceleration?: boolean;
}

export interface SettingsSetResponse {
  ok: boolean;
}

export interface GPUDetectResponse {
  hwaccels: string[];
  encoders: string[];
}

export interface DialogResponse {
  canceled: boolean;
  filePaths: string[];
}

export interface OpenPathRequest {
  path: string;
}

export interface OpenPathResponse {
  ok: boolean;
}

export interface SaveTempRequest {
  fileData: ArrayBuffer;
  fileName: string;
}

export interface SaveTempResponse {
  tempPath: string;
}

export interface CleanupTempRequest {
  tempPath: string;
}

export interface CleanupTempResponse {
  ok: boolean;
}

// 从共享类型导入
export type { 
  Job, 
  Progress, 
  ProbeResult, 
  TranscodeOptions,
  Container,
  VideoCodec,
  AudioPolicy,
  PresetName,
  VideoPreset,
  JobStatus,
  FfmpegPaths
} from '../shared/types';

// 工具相关类型
export interface TrimPreviewRequest {
  input: string;
  range: { startSec: number; endSec: number };
  previewSeconds?: number;
  scaleHalf?: boolean;
}

export interface TrimPreviewResponse {
  previewPath: string;
}

export interface TrimExportRequest {
  input: string;
  range: { startSec: number; endSec: number };
  mode: 'lossless' | 'precise';
  container: 'mp4' | 'mkv';
  videoCodec?: string;
  audio: 'copy' | 'encode';
  outputDir: string;
  outputName?: string;
}

export interface TrimExportResponse {
  output: string;
}

export interface GifPreviewRequest {
  input: string;
  range: { startSec: number; endSec: number };
  fps: number;
  maxWidth?: number;
  dithering?: 'bayer' | 'floyd';
  outputDir?: string;
  outputName?: string;
}

export interface GifPreviewResponse {
  previewPath: string;
}

export interface GifExportRequest extends GifPreviewRequest {
  outputDir: string;
}

export interface GifExportResponse {
  output: string;
}

export interface AudioExtractRequest {
  input: string;
  range?: { startSec: number; endSec: number };
  mode: 'copy' | 'encode';
  codec?: 'aac' | 'libmp3lame' | 'flac' | 'libopus';
  bitrateK?: number;
  outputDir: string;
  outputName?: string;
}

export interface AudioExtractResponse {
  output: string;
}

export interface PreviewCancelRequest {}

export interface PreviewCancelResponse {
  ok: boolean;
}

// 全局类型声明
declare global {
  interface Window {
    api: ElectronAPI;
  }
}
