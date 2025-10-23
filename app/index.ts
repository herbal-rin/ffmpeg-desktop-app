/**
 * FFmpeg 视频压缩应用 - 主入口文件
 * 导出所有核心服务和类型
 */

// 核心服务
export { FfmpegService } from './services/ffmpeg/ffmpegService';
export { FFprobeService } from './services/ffmpeg/probe';
export { ArgsBuilder } from './services/ffmpeg/argsBuilder';
export { ProgressParser } from './services/ffmpeg/progressParser';

// 任务队列
export { JobQueue } from './services/queue/jobQueue';

// 配置和日志
export { ConfigService, configService } from './services/config';
export { PinoLogger, ConsoleLogger, createLogger, logger } from './services/logger';

// 类型定义
export * from './shared/types';

// 版本信息
export const VERSION = '1.0.0';
export const P0_FEATURES = [
  '视频转码核心服务',
  '音频处理 (复制/重编码)',
  '硬件加速支持',
  '多种预设配置',
  '实时进度显示',
  '任务队列管理',
  '暂停/恢复功能 (Unix)',
  '完整日志系统',
  '配置持久化',
  '单元测试覆盖'
] as const;
