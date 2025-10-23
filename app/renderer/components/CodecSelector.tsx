import React from 'react';
import { t, getCodecDisplayName } from '../i18n';
import { VideoCodec } from '@types/preload';

/**
 * 编码器选择组件属性
 */
interface CodecSelectorProps {
  value: VideoCodec | 'auto';
  onChange: (codec: VideoCodec | 'auto') => void;
  gpuInfo: {
    hwaccels: string[];
    encoders: string[];
  };
  disabled?: boolean;
}

/**
 * 编码器选择组件
 */
export function CodecSelector({ value, onChange, gpuInfo, disabled = false }: CodecSelectorProps) {
  // 获取可用的编码器
  const getAvailableCodecs = (): Array<{ value: VideoCodec | 'auto'; label: string; available: boolean }> => {
    const codecs: Array<{ value: VideoCodec | 'auto'; label: string; available: boolean }> = [
      { value: 'auto', label: t('codec.auto'), available: true }
    ];

    // 软件编码器（总是可用）
    codecs.push(
      { value: 'libx264', label: getCodecDisplayName('libx264'), available: true },
      { value: 'libx265', label: getCodecDisplayName('libx265'), available: true }
    );

    // NVIDIA 编码器
    const hasNvenc = gpuInfo.encoders.some(encoder => encoder.includes('nvenc'));
    codecs.push(
      { value: 'h264_nvenc', label: getCodecDisplayName('h264_nvenc'), available: hasNvenc },
      { value: 'hevc_nvenc', label: getCodecDisplayName('hevc_nvenc'), available: hasNvenc }
    );

    // Intel 编码器
    const hasQsv = gpuInfo.encoders.some(encoder => encoder.includes('qsv'));
    codecs.push(
      { value: 'h264_qsv', label: getCodecDisplayName('h264_qsv'), available: hasQsv },
      { value: 'hevc_qsv', label: getCodecDisplayName('hevc_qsv'), available: hasQsv }
    );

    // Apple 编码器
    const hasVideoToolbox = gpuInfo.encoders.some(encoder => encoder.includes('videotoolbox'));
    codecs.push(
      { value: 'h264_videotoolbox', label: getCodecDisplayName('h264_videotoolbox'), available: hasVideoToolbox },
      { value: 'hevc_videotoolbox', label: getCodecDisplayName('hevc_videotoolbox'), available: hasVideoToolbox }
    );

    return codecs;
  };

  const availableCodecs = getAvailableCodecs();

  return (
    <div className="space-y-2">
      <label className="label">
        {t('file.codec')}
      </label>
      
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as VideoCodec | 'auto')}
        disabled={disabled}
        className="select w-full"
      >
        {availableCodecs.map((codec) => (
          <option
            key={codec.value}
            value={codec.value}
            disabled={!codec.available}
          >
            {codec.label} {!codec.available ? '(不可用)' : ''}
          </option>
        ))}
      </select>
      
      {/* 显示硬件加速信息 */}
      {value !== 'auto' && !availableCodecs.find(c => c.value === value)?.available && (
        <div className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center space-x-1">
          <span>⚠️</span>
          <span>{t('gpu.fallback')}</span>
        </div>
      )}
      
      {/* 显示硬件加速状态 */}
      {value !== 'auto' && availableCodecs.find(c => c.value === value)?.available && (
        <div className="text-sm text-green-600 dark:text-green-400 flex items-center space-x-1">
          <span>✅</span>
          <span>{t('gpu.supported')}</span>
        </div>
      )}
    </div>
  );
}
