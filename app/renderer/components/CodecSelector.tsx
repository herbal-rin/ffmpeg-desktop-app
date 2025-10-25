import { t, getCodecDisplayName } from '../i18n';
import { VideoCodec } from '../../shared/types';

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
    <div className="space-y-4">
      <div>
        <label className="label">
          {t('file.codec')}
        </label>
        
        <div className="space-y-2">
          {availableCodecs.map((codec) => (
            <label key={codec.value} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="codec"
                value={codec.value}
                checked={value === codec.value}
                onChange={() => onChange(codec.value)}
                disabled={disabled || !codec.available}
                className="radio"
              />
              <div className="flex-1">
                <div className={`font-medium ${!codec.available ? 'text-gray-400' : ''}`}>
                  {codec.label}
                </div>
                {codec.value === 'auto' && (
                  <div className="text-xs text-gray-500 mt-1">
                    🚀 优先使用硬件加速，失败时自动回退到软件编码
                  </div>
                )}
                {!codec.available && (
                  <div className="text-xs text-red-500 mt-1">
                    ❌ 当前系统不支持此编码器
                  </div>
                )}
                {codec.value !== 'auto' && codec.available && (
                  <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                    ✅ 硬件加速支持
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
