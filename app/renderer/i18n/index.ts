import zh from './zh.json';
import en from './en.json';

/**
 * 语言包类型
 */
type LanguagePack = typeof zh;

/**
 * 支持的语言
 */
export type SupportedLanguage = 'zh-CN' | 'en-US';

/**
 * 语言包映射
 */
const languagePacks: Record<SupportedLanguage, LanguagePack> = {
  'zh-CN': zh,
  'en-US': en,
};

/**
 * 当前语言
 */
let currentLanguage: SupportedLanguage = 'zh-CN';

/**
 * 设置当前语言
 */
export function setLanguage(language: SupportedLanguage): void {
  currentLanguage = language;
}

/**
 * 获取当前语言
 */
export function getCurrentLanguage(): SupportedLanguage {
  return currentLanguage;
}

/**
 * 翻译函数
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const pack = languagePacks[currentLanguage];
  
  // 支持嵌套键，如 'app.title'
  const keys = key.split('.');
  let value: any = pack;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // 如果找不到翻译，返回键名
      return key;
    }
  }
  
  if (typeof value !== 'string') {
    return key;
  }
  
  // 替换参数
  if (params) {
    return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
      return params[paramKey]?.toString() || match;
    });
  }
  
  return value;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  const units = ['bytes', 'kb', 'mb', 'gb', 'tb'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  const unit = t(`units.${units[unitIndex]}`);
  return `${size.toFixed(1)} ${unit}`;
}

/**
 * 格式化时长
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}${t('units.hours')} ${minutes}${t('units.minutes')} ${secs}${t('units.seconds')}`;
  } else if (minutes > 0) {
    return `${minutes}${t('units.minutes')} ${secs}${t('units.seconds')}`;
  } else {
    return `${secs}${t('units.seconds')}`;
  }
}

/**
 * 格式化速度
 */
export function formatSpeed(speed: number): string {
  return `${speed.toFixed(1)}x`;
}

/**
 * 格式化码率
 */
export function formatBitrate(bitrate: string): string {
  // bitrate 通常是 "2145kbits/s" 格式
  return bitrate;
}

/**
 * 格式化进度
 */
export function formatProgress(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/**
 * 格式化 ETA
 */
export function formatETA(etaSec: number): string {
  if (etaSec < 60) {
    return `${Math.round(etaSec)}${t('units.seconds')}`;
  } else if (etaSec < 3600) {
    const minutes = Math.floor(etaSec / 60);
    const seconds = Math.round(etaSec % 60);
    return `${minutes}${t('units.minutes')} ${seconds}${t('units.seconds')}`;
  } else {
    const hours = Math.floor(etaSec / 3600);
    const minutes = Math.floor((etaSec % 3600) / 60);
    return `${hours}${t('units.hours')} ${minutes}${t('units.minutes')}`;
  }
}

/**
 * 获取任务状态文本
 */
export function getJobStatusText(status: string): string {
  return t(`job.status.${status}` as any) || status;
}

/**
 * 获取编码器显示名称
 */
export function getCodecDisplayName(codec: string): string {
  return t(`codec.${codec}` as any) || codec;
}

/**
 * 获取预设显示名称
 */
export function getPresetDisplayName(preset: string): string {
  return t(`preset.${preset}` as any) || preset;
}

/**
 * 获取预设描述
 */
export function getPresetDescription(preset: string): string {
  return t(`preset.description.${preset}` as any) || '';
}

/**
 * 获取容器格式显示名称
 */
export function getContainerDisplayName(container: string): string {
  return t(`container.${container}` as any) || container;
}

/**
 * 获取音频编码器显示名称
 */
export function getAudioCodecDisplayName(codec: string): string {
  return t(`audio.${codec}` as any) || codec;
}

/**
 * 获取字幕模式显示名称
 */
export function getSubtitleModeDisplayName(mode: string): string {
  return t(`subtitle.${mode}` as any) || mode;
}

/**
 * 获取工具提示文本
 */
export function getTooltipText(key: string): string {
  return t(`tooltip.${key}` as any) || '';
}

/**
 * 获取错误信息
 */
export function getErrorMessage(error: string): string {
  // 尝试从错误信息中提取错误类型
  const errorKey = error.toLowerCase().replace(/\s+/g, '');
  return t(`error.${errorKey}` as any) || error;
}

/**
 * 导出所有翻译键（用于开发调试）
 */
export function getAllKeys(): string[] {
  const keys: string[] = [];
  
  function extractKeys(obj: any, prefix = ''): void {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object') {
        extractKeys(obj[key], fullKey);
      } else {
        keys.push(fullKey);
      }
    }
  }
  
  extractKeys(languagePacks[currentLanguage]);
  return keys;
}
