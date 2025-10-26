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
      fileSize: '最大（高CRF值18-20）',  // 修正：高质量对应大文件
      quality: '最高'
    },
    'balanced': {
      encodingTime: '1-2x',
      fileSize: '中等',
      quality: '良好'
    },
    'fast_small': {
      encodingTime: '0.5-1x',
      fileSize: '最小（高CRF值28-30）',  // 修正：快速小文件对应最小文件
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
                className={`text-left p-4 h-auto transition-all ${
                  value === preset.value 
                    ? 'border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md ring-2 ring-blue-300' 
                    : 'border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400'
                } rounded-lg`}
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
            <div className="space-y-2">
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
              <div className="text-xs text-gray-500 dark:text-gray-400">
                • 值越低质量越高体积越大<br/>
                • H.264推荐:18-28, H.265推荐:20-30<br/>
                • 18=无损质量(大文件), 28=小文件(质量可接受)
              </div>
            </div>
            
            {/* Preset */}
            <div className="space-y-2">
              <label className="label text-xs">Preset (编码速度)</label>
              <select
                value={customConfig.preset}
                onChange={(e) => handleCustomConfigChange('preset', e.target.value)}
                disabled={disabled}
                className="select text-sm"
              >
                <option value="ultrafast">ultrafast (最快)</option>
                <option value="superfast">superfast</option>
                <option value="veryfast">veryfast</option>
                <option value="faster">faster</option>
                <option value="fast">fast</option>
                <option value="medium">medium (推荐)</option>
                <option value="slow">slow</option>
                <option value="slower">slower</option>
                <option value="veryslow">veryslow (最慢，压缩率最高)</option>
              </select>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                控制编码速度与压缩效率平衡<br/>
                慢速=更好压缩率但耗时更长
              </div>
            </div>
            
            {/* Maxrate */}
            <div className="space-y-2">
              <label className="label text-xs">最大码率 (可选)</label>
              <input
                type="text"
                placeholder="如: 2000k"
                value={customConfig.maxrate}
                onChange={(e) => handleCustomConfigChange('maxrate', e.target.value)}
                disabled={disabled}
                className="input text-sm"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400">
                留空则不限制码率<br/>
                主要用于控制文件大小
              </div>
            </div>
            
            {/* Bufsize */}
            <div className="space-y-2">
              <label className="label text-xs">缓冲区大小 (可选)</label>
              <input
                type="text"
                placeholder="如: 4000k"
                value={customConfig.bufsize}
                onChange={(e) => handleCustomConfigChange('bufsize', e.target.value)}
                disabled={disabled}
                className="input text-sm"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400">
                留空则自动计算<br/>
                与最大码率配合使用
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
