/**
 * 工具相关类型定义
 */

import { VideoCodec, AudioPolicy } from './types';

/**
 * 时间范围
 */
export interface TimeRange {
  startSec: number;
  endSec: number;
}

/**
 * 裁剪模式
 */
export type TrimMode = 'lossless' | 'precise';

/**
 * 裁剪导出选项
 */
export interface TrimExportOptions {
  input: string;
  range: TimeRange;
  mode: TrimMode;
  container: 'mp4' | 'mkv';
  videoCodec?: VideoCodec;          // precise 模式必填；lossless 忽略
  audio: AudioPolicy;               // copy 或 encode
  outputDir: string;
  outputName?: string;
}

/**
 * GIF 选项
 */
export interface GifOptions {
  input: string;
  range: TimeRange;
  fps: number;                      // 默认 12
  maxWidth?: number;                // 默认 640
  dithering?: 'bayer' | 'floyd';    // 默认 bayer
  outputDir?: string;               // 预览可不传 → 写 temp
  outputName?: string;              // 导出时可传
}

/**
 * 音频提取选项
 */
export interface AudioExtractOptions {
  input: string;
  range?: TimeRange;                // 可选，不传则全片
  mode: 'copy' | 'encode';
  codec?: 'aac' | 'libmp3lame' | 'flac' | 'libopus'; // encode 必填
  bitrateK?: number;                // encode 时可选
  outputDir: string;
  outputName?: string;
}

/**
 * 预览选项
 */
export interface PreviewOptions {
  input: string;
  range: TimeRange;
  previewSeconds?: number;
  scaleHalf?: boolean;
}

/**
 * 工具事件类型
 */
export type ToolEventType = 'preview-start' | 'preview-progress' | 'preview-done' | 'preview-error';

/**
 * 工具事件
 */
export interface ToolEvent {
  type: ToolEventType;
  tempPath?: string;
  progress?: any; // Progress 类型
  error?: string;
}

/**
 * IPC 请求/响应类型
 */
export interface TrimPreviewRequest {
  input: string;
  range: TimeRange;
  previewSeconds?: number;
  scaleHalf?: boolean;
}

export interface TrimPreviewResponse {
  previewPath: string;
}

export interface TrimExportRequest extends TrimExportOptions {}

export interface TrimExportResponse {
  output: string;
}

export interface GifPreviewRequest extends GifOptions {}

export interface GifPreviewResponse {
  previewPath: string;
}

export interface GifExportRequest extends GifOptions {
  outputDir: string;
}

export interface GifExportResponse {
  output: string;
}

export interface AudioExtractRequest extends AudioExtractOptions {}

export interface AudioExtractResponse {
  output: string;
}

export interface PreviewCancelRequest {}

export interface PreviewCancelResponse {
  ok: boolean;
}