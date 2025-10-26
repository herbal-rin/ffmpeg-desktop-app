import { useState } from 'react';
import { t, getPresetDisplayName, getPresetDescription } from '../i18n';
import { VideoCodec } from '../../shared/types';

/**
 * 预设预估信息
 */
interface PresetEstimate {
  encodingTime: string;
  fileSize: string;
  quality: string;
}

/**
 * 获取预设预估信息
 */
function getPresetEstimate(presetName: string, _codec: VideoCodec | 'auto'): PresetEstimate {
  const estimates: Record<string, PresetEstimate> = {
    'hq_slow': {
      encodingTime: '2-4x',
      fileSize: '最小',
      quality: '最高'
    },
    'balanced': {
      encodingTime: '1-2x',
      fileSize: '中等',
      quality: '良好'
    },
    'fast_small': {
      encodingTime: '0.5-1x',
      fileSize: '较大',
      quality: '一般'
    }
  };

  return estimates[presetName] || {
    encodingTime: '未知',
    fileSize: '未知',
    quality: '未知'
  };
}

/**
 * 自定义预设配置
 */
interface CustomPresetConfig {
  crf: number;
  preset: string;
  maxrate: string;
  bufsize: string;
  bframes: number;
  lookahead: number;
  bitrateK?: number;
}

/**
 * 预设选择组件属性
 */
interface PresetPickerProps {
  value: string;
  onChange: (preset: string, customConfig?: CustomPresetConfig) => void;
  disabled?: boolean;
}

/**
 * 预设选择组件
 */
export function PresetPicker({ value, onChange, disabled = false }: PresetPickerProps) {
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


  return (
    <div className="space-y-4">
      <div>
        <label className="label">
          {t('preset.title')}
        </label>
        
        <div className="grid grid-cols-2 gap-2">
          {presetOptions.map((preset) => {
            const estimate = getPresetEstimate(preset.value, 'auto');
            return (
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
                <div className="text-xs opacity-60 mt-2 space-y-1">
                  <div>⏱️ 耗时: {estimate.encodingTime}</div>
                  <div>📁 大小: {estimate.fileSize}</div>
                  <div>🎯 质量: {estimate.quality}</div>
                </div>
              </button>
            );
          })}
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
