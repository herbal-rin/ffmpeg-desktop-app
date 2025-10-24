/**
 * 裁剪面板组件
 */

import React from 'react';
import { useToolsStore } from '../store/useToolsStore';

interface TrimPanelProps {
  className?: string;
}

export const TrimPanel: React.FC<TrimPanelProps> = ({ className = '' }) => {
  const {
    trimMode,
    trimContainer,
    trimVideoCodec,
    trimAudio,
    setTrimMode,
    setTrimContainer,
    setTrimVideoCodec,
    setTrimAudio
  } = useToolsStore();

  const videoCodecs = [
    { value: 'libx264', label: 'H.264 (libx264)', description: '兼容性最好，文件较大' },
    { value: 'libx265', label: 'H.265 (libx265)', description: '压缩率高，文件较小' },
    { value: 'h264_nvenc', label: 'H.264 (NVENC)', description: 'NVIDIA 硬件加速' },
    { value: 'hevc_nvenc', label: 'H.265 (NVENC)', description: 'NVIDIA 硬件加速' },
    { value: 'h264_qsv', label: 'H.264 (QSV)', description: 'Intel 硬件加速' },
    { value: 'hevc_qsv', label: 'H.265 (QSV)', description: 'Intel 硬件加速' },
    { value: 'h264_videotoolbox', label: 'H.264 (VideoToolbox)', description: 'macOS 硬件加速' },
    { value: 'hevc_videotoolbox', label: 'H.265 (VideoToolbox)', description: 'macOS 硬件加速' }
  ];

  return (
    <div className={`p-4 bg-white rounded-lg border ${className}`}>
      <h3 className="text-lg font-medium text-gray-900 mb-4">视频裁剪</h3>
      
      {/* 裁剪模式 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          裁剪模式
        </label>
        <div className="space-y-2">
          <label className="flex items-start">
            <input
              type="radio"
              name="trimMode"
              value="lossless"
              checked={trimMode === 'lossless'}
              onChange={(e) => setTrimMode(e.target.value as 'lossless' | 'precise')}
              className="mt-1 mr-3"
            />
            <div>
              <div className="font-medium">无损快剪</div>
              <div className="text-sm text-gray-600">
                直接复制视频流，速度最快，但可能遇到关键帧问题
              </div>
            </div>
          </label>
          <label className="flex items-start">
            <input
              type="radio"
              name="trimMode"
              value="precise"
              checked={trimMode === 'precise'}
              onChange={(e) => setTrimMode(e.target.value as 'lossless' | 'precise')}
              className="mt-1 mr-3"
            />
            <div>
              <div className="font-medium">精准剪</div>
              <div className="text-sm text-gray-600">
                重新编码，精确到帧，文件更小但速度较慢
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* 容器格式 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          输出格式
        </label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="trimContainer"
              value="mp4"
              checked={trimContainer === 'mp4'}
              onChange={(e) => setTrimContainer(e.target.value as 'mp4' | 'mkv')}
              className="mr-2"
            />
            MP4
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="trimContainer"
              value="mkv"
              checked={trimContainer === 'mkv'}
              onChange={(e) => setTrimContainer(e.target.value as 'mp4' | 'mkv')}
              className="mr-2"
            />
            MKV
          </label>
        </div>
      </div>

      {/* 视频编码器（仅精准剪模式） */}
      {trimMode === 'precise' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            视频编码器
          </label>
          <select
            value={trimVideoCodec}
            onChange={(e) => setTrimVideoCodec(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {videoCodecs.map(codec => (
              <option key={codec.value} value={codec.value}>
                {codec.label} - {codec.description}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 音频处理 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          音频处理
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="trimAudio"
              value="copy"
              checked={trimAudio === 'copy'}
              onChange={(e) => setTrimAudio(e.target.value as 'copy' | 'encode')}
              className="mr-2"
            />
            复制音频流（无损，速度快）
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="trimAudio"
              value="encode"
              checked={trimAudio === 'encode'}
              onChange={(e) => setTrimAudio(e.target.value as 'copy' | 'encode')}
              className="mr-2"
            />
            重新编码音频（可压缩文件大小）
          </label>
        </div>
      </div>

      {/* 提示信息 */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <div className="text-sm text-blue-800">
          <div className="font-medium mb-1">💡 使用建议：</div>
          <ul className="list-disc list-inside space-y-1">
            <li>无损快剪适合快速预览和简单裁剪</li>
            <li>如遇首帧花屏，请使用精准剪模式</li>
            <li>精准剪可以精确到帧，适合专业用途</li>
            <li>硬件加速编码器需要相应的显卡支持</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
