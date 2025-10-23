import React, { useState } from 'react';
import { t, getPresetDisplayName, getPresetDescription } from '../i18n';
import { VideoCodec } from '@types/preload';

/**
 * 自定义预设配置
 */
interface CustomPresetConfig {
  crf: number;
  preset: string;
  maxrate?: string;
  bufsize?: string;
  bframes?: number;
  lookahead?: number;
}

/**
 * 预设选择组件属性
 */
interface PresetPickerProps {
  value: string;
  onChange: (preset: string, customConfig?: CustomPresetConfig) => void;
  codec: VideoCodec | 'auto';
  disabled?: boolean;
}

/**
 * 预设选择组件
 */
export function PresetPicker({ value, onChange, codec, disabled = false }: PresetPickerProps) {
  const [customConfig, setCustomConfig] = useState<CustomPresetConfig>({
    crf: 22,
    preset: 'medium',
    maxrate: '',
    bufsize: '',
    bframes: 2,
    lookahead: 40
  });

  // 获取预设选项
  const getPresetOptions = () => {
    const presets = [
      { value: 'hq_slow', label: getPresetDisplayName('hq_slow'), description: getPresetDescription('hq_slow') },
      { value: 'balanced', label: getPresetDisplayName('balanced'), description: getPresetDescription('balanced') },
      { value: 'fast_small', label: getPresetDisplayName('fast_small'), description: getPresetDescription('fast_small') },
      { value: 'custom', label: getPresetDisplayName('custom'), description: '自定义参数' }
    ];

    return presets;
  };

  const presetOptions = getPresetOptions();

  // 处理预设变化
  const handlePresetChange = (preset: string) => {
    onChange(preset, preset === 'custom' ? customConfig : undefined);
  };

  // 处理自定义配置变化
  const handleCustomConfigChange = (key: keyof CustomPresetConfig, val: string | number) => {
    const newConfig = { ...customConfig, [key]: val };
    setCustomConfig(newConfig);
    onChange('custom', newConfig);
  };

  // 获取预设参数
  const getPresetArgs = (preset: string, codec: VideoCodec | 'auto'): string[] => {
    if (preset === 'custom') {
      const args: string[] = [];
      
      // CRF
      args.push('-crf', customConfig.crf.toString());
      
      // Preset
      args.push('-preset', customConfig.preset);
      
      // Maxrate
      if (customConfig.maxrate) {
        args.push('-maxrate', customConfig.maxrate);
      }
      
      // Bufsize
      if (customConfig.bufsize) {
        args.push('-bufsize', customConfig.bufsize);
      }
      
      // B-frames
      if (customConfig.bframes !== undefined) {
        args.push('-bf', customConfig.bframes.toString());
      }
      
      // Lookahead
      if (customConfig.lookahead !== undefined) {
        args.push('-rc-lookahead', customConfig.lookahead.toString());
      }
      
      return args;
    }

    // 根据编码器返回预设参数
    switch (codec) {
      case 'libx264':
        switch (preset) {
          case 'hq_slow': return ['-preset', 'slow', '-crf', '18'];
          case 'balanced': return ['-preset', 'medium', '-crf', '22'];
          case 'fast_small': return ['-preset', 'veryfast', '-crf', '26'];
          default: return ['-preset', 'medium', '-crf', '22'];
        }
      case 'libx265':
        switch (preset) {
          case 'hq_slow': return ['-preset', 'slow', '-crf', '20'];
          case 'balanced': return ['-preset', 'medium', '-crf', '24'];
          case 'fast_small': return ['-preset', 'veryfast', '-crf', '28'];
          default: return ['-preset', 'medium', '-crf', '24'];
        }
      case 'h264_nvenc':
      case 'hevc_nvenc':
        switch (preset) {
          case 'hq_slow': return ['-preset', 'p7', '-rc', 'vbr', '-cq', '19', '-b:v', '0'];
          case 'balanced': return ['-preset', 'p4', '-cq', '22'];
          case 'fast_small': return ['-preset', 'p3', '-cq', '27'];
          default: return ['-preset', 'p4', '-cq', '22'];
        }
      case 'h264_qsv':
      case 'hevc_qsv':
        switch (preset) {
          case 'hq_slow': return ['-preset', 'slow', '-global_quality', '19'];
          case 'balanced': return ['-preset', 'medium', '-global_quality', '22'];
          case 'fast_small': return ['-preset', 'veryfast', '-global_quality', '27'];
          default: return ['-preset', 'medium', '-global_quality', '22'];
        }
      case 'h264_videotoolbox':
      case 'hevc_videotoolbox':
        switch (preset) {
          case 'hq_slow': return ['-quality', 'best', '-realtime', 'false'];
          case 'balanced': return ['-quality', 'high', '-realtime', 'false'];
          case 'fast_small': return ['-quality', 'medium', '-realtime', 'true'];
          default: return ['-quality', 'high', '-realtime', 'false'];
        }
      default:
        return ['-preset', 'medium', '-crf', '22'];
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="label">
          {t('preset.title')}
        </label>
        
        <div className="grid grid-cols-2 gap-2">
          {presetOptions.map((preset) => (
            <button
              key={preset.value}
              onClick={() => handlePresetChange(preset.value)}
              disabled={disabled}
              className={`btn btn-outline text-left p-3 h-auto ${
                value === preset.value ? 'bg-primary text-primary-foreground' : ''
              }`}
            >
              <div className="font-medium">{preset.label}</div>
              <div className="text-xs opacity-75 mt-1">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 自定义预设配置 */}
      {value === 'custom' && (
        <div className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <h4 className="font-medium text-sm">{t('preset.custom')}</h4>
          
          <div className="grid grid-cols-2 gap-4">
            {/* CRF */}
            <div>
              <label className="label text-xs">CRF (质量)</label>
              <input
                type="number"
                min="0"
                max="51"
                value={customConfig.crf}
                onChange={(e) => handleCustomConfigChange('crf', parseInt(e.target.value) || 22)}
                disabled={disabled}
                className="input text-sm"
              />
            </div>
            
            {/* Preset */}
            <div>
              <label className="label text-xs">Preset</label>
              <select
                value={customConfig.preset}
                onChange={(e) => handleCustomConfigChange('preset', e.target.value)}
                disabled={disabled}
                className="select text-sm"
              >
                <option value="ultrafast">ultrafast</option>
                <option value="superfast">superfast</option>
                <option value="veryfast">veryfast</option>
                <option value="faster">faster</option>
                <option value="fast">fast</option>
                <option value="medium">medium</option>
                <option value="slow">slow</option>
                <option value="slower">slower</option>
                <option value="veryslow">veryslow</option>
              </select>
            </div>
            
            {/* Maxrate */}
            <div>
              <label className="label text-xs">最大码率 (可选)</label>
              <input
                type="text"
                placeholder="如: 2000k"
                value={customConfig.maxrate}
                onChange={(e) => handleCustomConfigChange('maxrate', e.target.value)}
                disabled={disabled}
                className="input text-sm"
              />
            </div>
            
            {/* Bufsize */}
            <div>
              <label className="label text-xs">缓冲区大小 (可选)</label>
              <input
                type="text"
                placeholder="如: 4000k"
                value={customConfig.bufsize}
                onChange={(e) => handleCustomConfigChange('bufsize', e.target.value)}
                disabled={disabled}
                className="input text-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
