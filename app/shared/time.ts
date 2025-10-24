/**
 * 时间工具函数
 * 处理时间格式转换：HH:MM:SS.mmm ↔ 秒
 */

/**
 * 将秒数转换为 HH:MM:SS.mmm 格式
 */
export function toHMSms(seconds: number): string {
  if (seconds < 0) {
    return '00:00:00.000';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * 将 HH:MM:SS.mmm 格式转换为秒数
 */
export function parseHMSms(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') {
    return 0;
  }

  // 支持多种格式：HH:MM:SS.mmm, MM:SS.mmm, SS.mmm
  const parts = timeStr.trim().split(':');
  
  if (parts.length === 1) {
    // SS.mmm 格式
    return parseFloat(parts[0]) || 0;
  } else if (parts.length === 2) {
    // MM:SS.mmm 格式
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  } else if (parts.length === 3) {
    // HH:MM:SS.mmm 格式
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return 0;
}

/**
 * 验证时间范围是否有效
 */
export function validateTimeRange(range: { startSec: number; endSec: number }, duration: number): { valid: boolean; error?: string } {
  if (range.startSec < 0) {
    return { valid: false, error: '开始时间不能为负数' };
  }
  
  if (range.endSec <= range.startSec) {
    return { valid: false, error: '结束时间必须大于开始时间' };
  }
  
  if (range.startSec >= duration) {
    return { valid: false, error: '开始时间不能超过视频总时长' };
  }
  
  if (range.endSec > duration) {
    return { valid: false, error: '结束时间不能超过视频总时长' };
  }
  
  const rangeDuration = range.endSec - range.startSec;
  if (rangeDuration < 0.5) {
    return { valid: false, error: '时间范围至少需要 0.5 秒' };
  }
  
  return { valid: true };
}

/**
 * 格式化持续时间
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)} 秒`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes} 分 ${secs} 秒`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} 小时 ${minutes} 分钟`;
  }
}

/**
 * 估算 GIF 文件大小（粗略）
 */
export function estimateGifSize(width: number, height: number, fps: number, duration: number): string {
  // 粗略估算：width * height * fps * duration / 8 / 1024 / 压缩系数
  const compressionFactor = 10; // 经验值
  const estimatedBytes = (width * height * fps * duration) / 8 / 1024 / compressionFactor;
  
  if (estimatedBytes < 1024) {
    return `${Math.round(estimatedBytes)} KB`;
  } else if (estimatedBytes < 1024 * 1024) {
    return `${(estimatedBytes / 1024).toFixed(1)} MB`;
  } else {
    return `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}