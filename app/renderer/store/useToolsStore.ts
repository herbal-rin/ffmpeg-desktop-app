/**
 * 工具页面状态管理
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface FileInfo {
  file: File;
  tempPath: string;
  probeResult?: any; // ProbeResult 类型
}

export interface TimeRange {
  startSec: number;
  endSec: number;
}

export interface ToolsState {
  // 文件信息
  selectedFile: FileInfo | null;
  
  // 时间范围
  timeRange: TimeRange;
  
  // 预览状态
  previewPath: string | null;
  isPreviewing: boolean;
  previewProgress: number;
  
  // 工具选项
  trimMode: 'lossless' | 'precise';
  trimContainer: 'mp4' | 'mkv';
  trimVideoCodec: string;
  trimAudio: 'copy' | 'encode';
  
  gifFps: number;
  gifMaxWidth: number;
  gifDithering: 'bayer' | 'floyd';
  
  audioMode: 'copy' | 'encode';
  audioCodec: string;
  audioBitrate: number;
  
  // 输出目录
  outputDir: string;
  
  // 操作
  setSelectedFile: (file: FileInfo | null) => void;
  setTimeRange: (range: TimeRange) => void;
  setPreviewPath: (path: string | null) => void;
  setIsPreviewing: (isPreviewing: boolean) => void;
  setPreviewProgress: (progress: number) => void;
  setTrimMode: (mode: 'lossless' | 'precise') => void;
  setTrimContainer: (container: 'mp4' | 'mkv') => void;
  setTrimVideoCodec: (codec: string) => void;
  setTrimAudio: (audio: 'copy' | 'encode') => void;
  setGifFps: (fps: number) => void;
  setGifMaxWidth: (width: number) => void;
  setGifDithering: (dithering: 'bayer' | 'floyd') => void;
  setAudioMode: (mode: 'copy' | 'encode') => void;
  setAudioCodec: (codec: string) => void;
  setAudioBitrate: (bitrate: number) => void;
  setOutputDir: (dir: string) => void;
  
  // 重置状态
  reset: () => void;
}

const initialState = {
  selectedFile: null,
  timeRange: { startSec: 0, endSec: 10 },
  previewPath: null,
  isPreviewing: false,
  previewProgress: 0,
  trimMode: 'lossless' as const,
  trimContainer: 'mp4' as const,
  trimVideoCodec: 'libx264',
  trimAudio: 'copy' as const,
  gifFps: 12,
  gifMaxWidth: 640,
  gifDithering: 'bayer' as const,
  audioMode: 'copy' as const,
  audioCodec: 'aac',
  audioBitrate: 128,
  outputDir: ''
};

export const useToolsStore = create<ToolsState>()(
  subscribeWithSelector((set, _get) => ({
    ...initialState,
    
    setSelectedFile: (file) => set({ selectedFile: file }),
    setTimeRange: (range) => set({ timeRange: range }),
    setPreviewPath: (path) => set({ previewPath: path }),
    setIsPreviewing: (isPreviewing) => set({ isPreviewing }),
    setPreviewProgress: (progress) => set({ previewProgress: progress }),
    setTrimMode: (mode) => set({ trimMode: mode }),
    setTrimContainer: (container) => set({ trimContainer: container }),
    setTrimVideoCodec: (codec) => set({ trimVideoCodec: codec }),
    setTrimAudio: (audio) => set({ trimAudio: audio }),
    setGifFps: (fps) => set({ gifFps: fps }),
    setGifMaxWidth: (width) => set({ gifMaxWidth: width }),
    setGifDithering: (dithering) => set({ gifDithering: dithering }),
    setAudioMode: (mode) => set({ audioMode: mode }),
    setAudioCodec: (codec) => set({ audioCodec: codec }),
    setAudioBitrate: (bitrate) => set({ audioBitrate: bitrate }),
    setOutputDir: (dir) => set({ outputDir: dir }),
    
    reset: () => set(initialState)
  }))
);
