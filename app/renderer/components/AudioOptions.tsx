import { t, getAudioCodecDisplayName } from '../i18n';
import { AudioPolicy } from '../../shared/types';

/**
 * 音频选项组件属性
 */
interface AudioOptionsProps {
  value: AudioPolicy;
  onChange: (audio: AudioPolicy) => void;
  disabled?: boolean;
}

/**
 * 音频选项组件
 */
export function AudioOptions({ value, onChange, disabled = false }: AudioOptionsProps) {
  const handleModeChange = (mode: 'copy' | 'encode') => {
    if (mode === 'copy') {
      onChange({ mode: 'copy' });
    } else {
      onChange({ 
        mode: 'encode', 
        codec: 'aac', 
        bitrateK: 128 
      });
    }
  };

  const handleCodecChange = (codec: 'aac' | 'libopus' | 'libmp3lame') => {
    if (value.mode === 'encode') {
      onChange({
        ...value,
        codec
      });
    }
  };

  const handleBitrateChange = (bitrateK: number) => {
    if (value.mode === 'encode') {
      onChange({
        ...value,
        bitrateK
      });
    }
  };

  const getRecommendedBitrate = (codec: string): number => {
    switch (codec) {
      case 'aac': return 128;
      case 'libopus': return 96;
      case 'libmp3lame': return 128;
      default: return 128;
    }
  };

  return (
    <div className="space-y-4">
      <label className="label">
        {t('audio.codec')}
      </label>
      
      {/* 音频模式选择 */}
      <div className="space-y-2">
        <div className="flex space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="audioMode"
              value="copy"
              checked={value.mode === 'copy'}
              onChange={() => handleModeChange('copy')}
              disabled={disabled}
              className="text-primary"
            />
            <span className="text-sm">{t('audio.copy')}</span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="audioMode"
              value="encode"
              checked={value.mode === 'encode'}
              onChange={() => handleModeChange('encode')}
              disabled={disabled}
              className="text-primary"
            />
            <span className="text-sm">{t('audio.encode')}</span>
          </label>
        </div>
        
        {/* 复制模式提示 */}
        {value.mode === 'copy' && (
          <div className="text-sm text-blue-600 dark:text-blue-400 flex items-center space-x-1">
            <span>ℹ️</span>
            <span>{t('tooltip.audioCopy')}</span>
          </div>
        )}
      </div>
      
      {/* 编码模式配置 */}
      {value.mode === 'encode' && (
        <div className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
          {/* 编码器选择 */}
          <div>
            <label className="label text-sm">{t('audio.codec')}</label>
            <select
              value={value.codec || 'aac'}
              onChange={(e) => handleCodecChange(e.target.value as 'aac' | 'libopus' | 'libmp3lame')}
              disabled={disabled}
              className="select w-full"
            >
              <option value="aac">{getAudioCodecDisplayName('aac')}</option>
              <option value="libopus">{getAudioCodecDisplayName('opus')}</option>
              <option value="libmp3lame">{getAudioCodecDisplayName('mp3')}</option>
            </select>
          </div>
          
          {/* 码率选择 */}
          <div>
            <label className="label text-sm">{t('audio.bitrate')}</label>
            <div className="grid grid-cols-4 gap-2">
              {[64, 96, 128, 192, 256, 320].map((bitrate) => {
                const isSelected = value.bitrateK === bitrate;
                return (
                  <button
                    key={bitrate}
                    onClick={() => handleBitrateChange(bitrate)}
                    disabled={disabled}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md border-2 border-blue-700' 
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {bitrate}k
                    {isSelected && <span className="ml-1">✓</span>}
                  </button>
                );
              })}
            </div>
            
            {/* 推荐码率提示 */}
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              推荐: {getRecommendedBitrate(value.codec || 'aac')}k
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
