/**
 * 音频提取面板组件
 */

import React from 'react';
import { useToolsStore } from '../store/useToolsStore';

interface AudioExtractPanelProps {
  className?: string;
}

export const AudioExtractPanel: React.FC<AudioExtractPanelProps> = ({ className = '' }) => {
  const {
    audioMode,
    audioCodec,
    audioBitrate,
    setAudioMode,
    setAudioCodec,
    setAudioBitrate
  } = useToolsStore();

  const codecOptions = [
    { value: 'aac', label: 'AAC', description: '高质量，兼容性好' },
    { value: 'libmp3lame', label: 'MP3', description: '广泛支持，文件较小' },
    { value: 'flac', label: 'FLAC', description: '无损压缩，文件较大' },
    { value: 'libopus', label: 'Opus', description: '现代编码，效率高' }
  ];

  const bitrateOptions = [
    { value: 64, label: '64 kbps - 低质量' },
    { value: 96, label: '96 kbps - 较低质量' },
    { value: 128, label: '128 kbps - 标准质量' },
    { value: 160, label: '160 kbps - 较高质量' },
    { value: 192, label: '192 kbps - 高质量' },
    { value: 256, label: '256 kbps - 很高质量' },
    { value: 320, label: '320 kbps - 最高质量' }
  ];

  return (
    <div className={`p-4 bg-white rounded-lg border ${className}`}>
      <h3 className="text-lg font-medium text-gray-900 mb-4">音频提取</h3>
      
      {/* 提取模式 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          提取模式
        </label>
        <div className="space-y-2">
          <label className="flex items-start">
            <input
              type="radio"
              name="audioMode"
              value="copy"
              checked={audioMode === 'copy'}
              onChange={(e) => setAudioMode(e.target.value as 'copy' | 'encode')}
              className="mt-1 mr-3"
            />
            <div>
              <div className="font-medium">直接复制</div>
              <div className="text-sm text-gray-600">
                无损提取，速度最快，保持原始质量
              </div>
            </div>
          </label>
          <label className="flex items-start">
            <input
              type="radio"
              name="audioMode"
              value="encode"
              checked={audioMode === 'encode'}
              onChange={(e) => setAudioMode(e.target.value as 'copy' | 'encode')}
              className="mt-1 mr-3"
            />
            <div>
              <div className="font-medium">重新编码</div>
              <div className="text-sm text-gray-600">
                可压缩文件大小，支持多种格式
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* 音频编码器（仅编码模式） */}
      {audioMode === 'encode' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            音频编码器
          </label>
          <select
            value={audioCodec}
            onChange={(e) => setAudioCodec(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {codecOptions.map(codec => (
              <option key={codec.value} value={codec.value}>
                {codec.label} - {codec.description}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 码率设置（仅编码模式且非 FLAC） */}
      {audioMode === 'encode' && audioCodec !== 'flac' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            码率
          </label>
          <select
            value={audioBitrate}
            onChange={(e) => setAudioBitrate(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {bitrateOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="text-sm text-gray-600 mt-1">
            码率越高，音质越好，但文件也越大
          </div>
        </div>
      )}

      {/* 输出格式说明 */}
      <div className="mb-6">
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
          <div className="text-sm text-gray-700">
            <div className="font-medium mb-2">📄 输出格式：</div>
            <div className="space-y-1">
              {audioMode === 'copy' ? (
                <div>输出格式: <span className="font-medium">M4A</span> (保持原始编码)</div>
              ) : (
                <div>
                  输出格式: <span className="font-medium">
                    {audioCodec === 'libmp3lame' ? 'MP3' :
                     audioCodec === 'aac' ? 'AAC' :
                     audioCodec === 'flac' ? 'FLAC' :
                     audioCodec === 'libopus' ? 'OPUS' : 'M4A'}
                  </span>
                </div>
              )}
              {audioMode === 'encode' && audioCodec !== 'flac' && (
                <div>码率: <span className="font-medium">{audioBitrate} kbps</span></div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 使用说明 */}
      <div className="bg-green-50 border border-green-200 rounded-md p-3">
        <div className="text-sm text-green-800">
          <div className="font-medium mb-1">💡 使用建议：</div>
          <ul className="list-disc list-inside space-y-1">
            <li>直接复制模式速度最快，适合快速提取</li>
            <li>重新编码模式可以压缩文件大小</li>
            <li>FLAC 是无损格式，不需要设置码率</li>
            <li>MP3 和 AAC 兼容性最好，适合大多数设备</li>
            <li>Opus 是现代编码格式，效率很高</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
