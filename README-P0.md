# FFmpeg 视频压缩应用 - P0 核心后端

这是一个基于 Node.js/TypeScript 的桌面端视频压缩应用的核心后端服务，集成了 FFmpeg 进行视频转码处理。

## 🎯 P0 功能特性

### ✅ 已实现功能

- **视频转码核心服务**: 支持多种视频格式输入输出 (mp4/mkv)
- **音频处理**: 支持音频流复制或重编码 (aac/opus/mp3)
- **硬件加速**: 支持 NVIDIA NVENC、Intel QSV、Apple VideoToolbox
- **多种预设**: 高质量慢速、平衡、快速小文件三种预设
- **实时进度**: 显示转码进度、速度、ETA 等信息
- **任务队列**: 支持任务排队、取消、暂停/恢复 (Unix 系统)
- **日志系统**: 完整的日志记录和文件输出
- **配置管理**: 基于 electron-store 的配置持久化
- **单元测试**: 完整的测试覆盖

### 🔧 技术栈

- **Node.js 18+**: 运行时环境
- **TypeScript**: 严格模式类型安全
- **FFmpeg/FFprobe**: 视频处理核心
- **Pino**: 高性能日志库
- **Electron Store**: 配置持久化
- **Vitest**: 单元测试框架

## 📁 项目结构

```
/app
  /services
    ffmpeg/
      ffmpegService.ts    # FFmpeg 核心服务
      argsBuilder.ts      # 参数构建器
      progressParser.ts   # 进度解析器
      probe.ts           # 视频信息探测
    queue/
      jobQueue.ts        # 任务队列管理
    config.ts           # 配置管理
    logger.ts           # 日志服务
  /shared
    types.ts            # TypeScript 类型定义
/tests
  argsBuilder.test.ts   # 参数构建器测试
  progressParser.test.ts # 进度解析器测试
  jobQueue.test.ts     # 任务队列测试
/examples
  p0-demo.ts           # 演示示例
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 FFmpeg 路径

确保系统已安装 FFmpeg 和 FFprobe，并配置环境变量：

```bash
# macOS (使用 Homebrew)
brew install ffmpeg

# Ubuntu/Debian
sudo apt update
sudo apt install ffmpeg

# Windows
# 下载 FFmpeg 并添加到 PATH
```

或设置环境变量：

```bash
export FFMPEG_PATH="/usr/local/bin/ffmpeg"
export FFPROBE_PATH="/usr/local/bin/ffprobe"
```

### 3. 构建项目

```bash
npm run build
```

### 4. 运行演示

#### 真实演示（需要 FFmpeg）

```bash
npm run demo
```

#### 模拟演示（无需 FFmpeg）

```bash
npm run demo:mock
```

### 5. 运行测试

```bash
npm test
```

## 📖 API 使用示例

### 基础使用

```typescript
import { FfmpegService } from './app/services/ffmpeg/ffmpegService';
import { JobQueue } from './app/services/queue/jobQueue';
import { ConsoleLogger } from './app/services/logger';
import { ArgsBuilder } from './app/services/ffmpeg/argsBuilder';

// 创建服务实例
const logger = new ConsoleLogger('info');
const ffmpegService = new FfmpegService({
  ffmpeg: '/usr/local/bin/ffmpeg',
  ffprobe: '/usr/local/bin/ffprobe'
}, logger);

const jobQueue = new JobQueue(ffmpegService, logger);

// 设置事件监听
jobQueue.on('job-progress', ({ job, progress }) => {
  console.log(`[${job.id}] ${(progress.ratio*100).toFixed(1)}% speed=${progress.speed}x ETA=${progress.etaSec}s`);
});

// 创建转码任务
const job = jobQueue.enqueue({
  input: '/path/to/input.mp4',
  outputDir: '/path/to/output',
  container: 'mp4',
  videoCodec: 'libx264',
  videoPreset: ArgsBuilder.toPreset('balanced', 'libx264'),
  audio: { mode: 'copy' },
  fastStart: true,
});

// 开始处理
jobQueue.start();
```

### 高级功能

```typescript
// 硬件加速转码
const nvencJob = jobQueue.enqueue({
  input: '/path/to/input.mkv',
  outputDir: '/path/to/output',
  container: 'mkv',
  videoCodec: 'h264_nvenc',
  videoPreset: ArgsBuilder.toPreset('hq_slow', 'h264_nvenc'),
  audio: { mode: 'encode', codec: 'aac', bitrateK: 128 },
});

// 音频重编码
const audioJob = jobQueue.enqueue({
  input: '/path/to/input.mp4',
  outputDir: '/path/to/output',
  container: 'mp4',
  videoCodec: 'libx265',
  videoPreset: ArgsBuilder.toPreset('fast_small', 'libx265'),
  audio: { mode: 'encode', codec: 'libopus', bitrateK: 96 },
});

// 任务控制
jobQueue.pause(job.id);    // 暂停任务 (Unix only)
jobQueue.resume(job.id);   // 恢复任务 (Unix only)
jobQueue.cancel(job.id);    // 取消任务
```

## 🎛️ 支持的编码器和预设

### 视频编码器

| 编码器 | 类型 | 平台支持 |
|--------|------|----------|
| libx264 | 软件 | 全平台 |
| libx265 | 软件 | 全平台 |
| h264_nvenc | 硬件 | NVIDIA GPU |
| hevc_nvenc | 硬件 | NVIDIA GPU |
| h264_qsv | 硬件 | Intel GPU |
| hevc_qsv | 硬件 | Intel GPU |
| h264_videotoolbox | 硬件 | Apple Silicon |
| hevc_videotoolbox | 硬件 | Apple Silicon |

### 预设配置

| 预设 | 描述 | libx264 | h264_nvenc |
|------|------|---------|------------|
| hq_slow | 高质量慢速 | -preset slow -crf 18 | -preset p7 -cq 19 |
| balanced | 平衡 | -preset medium -crf 22 | -preset p4 -cq 22 |
| fast_small | 快速小文件 | -preset veryfast -crf 26 | -preset p3 -cq 27 |

### 音频编码器

| 编码器 | 推荐码率 | 描述 |
|--------|----------|------|
| aac | 128k | 通用兼容性好 |
| libopus | 96k | 高质量压缩 |
| libmp3lame | 128k | 广泛支持 |

## 🔧 配置选项

### 环境变量

```bash
# FFmpeg 路径
FFMPEG_PATH=/usr/local/bin/ffmpeg
FFPROBE_PATH=/usr/local/bin/ffprobe

# 输入输出目录
INPUT_DIR=/path/to/input/videos
OUTPUT_DIR=/path/to/output/videos
```

### 配置管理

```typescript
import { configService } from './app/services/config';

// 设置 FFmpeg 路径
configService.setPaths({
  ffmpeg: '/usr/local/bin/ffmpeg',
  ffprobe: '/usr/local/bin/ffprobe'
});

// 设置默认输出目录
configService.setDefaultOutputDir('/path/to/output');

// 启用硬件加速
configService.setHardwareAcceleration(true);
```

## 📊 事件系统

任务队列支持以下事件：

```typescript
jobQueue.on('job-start', ({ job }) => {
  console.log('任务开始:', job.id);
});

jobQueue.on('job-progress', ({ job, progress }) => {
  console.log('进度更新:', progress.ratio);
});

jobQueue.on('job-done', ({ job }) => {
  console.log('任务完成:', job.id);
});

jobQueue.on('job-error', ({ job, error }) => {
  console.log('任务失败:', error);
});

jobQueue.on('job-canceled', ({ job }) => {
  console.log('任务取消:', job.id);
});

jobQueue.on('queue-empty', () => {
  console.log('队列已空');
});
```

## 🧪 测试

### 运行所有测试

```bash
npm test
```

### 运行特定测试

```bash
# 参数构建器测试
npm test argsBuilder

# 进度解析器测试
npm test progressParser

# 任务队列测试
npm test jobQueue
```

### 测试覆盖率

```bash
npm run test:coverage
```

## 📝 日志

日志文件位置：
- macOS/Linux: `~/.ffmpeg-app/logs/app-YYYYMMDD.log`
- Windows: `%USERPROFILE%\.ffmpeg-app\logs\app-YYYYMMDD.log`

日志级别：
- `debug`: 详细调试信息
- `info`: 一般信息
- `warn`: 警告信息
- `error`: 错误信息

## ⚠️ 已知限制

1. **Windows 暂停/恢复**: Windows 系统暂不支持任务暂停和恢复功能
2. **FFmpeg 依赖**: 需要手动安装和配置 FFmpeg 路径
3. **并发限制**: 默认串行执行，避免资源冲突

## 🐛 故障排除

### FFmpeg 未找到

```
Error: FFmpeg 路径未配置
```

**解决方案**:
1. 安装 FFmpeg: `brew install ffmpeg` (macOS) 或 `sudo apt install ffmpeg` (Ubuntu)
2. 设置环境变量: `export FFMPEG_PATH=/usr/local/bin/ffmpeg`
3. 或在代码中配置路径

### 硬件加速失败

```
Error: 硬件编码器不可用
```

**解决方案**:
1. 检查 GPU 驱动是否最新
2. 验证 FFmpeg 是否支持硬件编码器
3. 使用软件编码器作为备选

### 权限错误

```
Error: EACCES: permission denied
```

**解决方案**:
1. 检查输入文件读取权限
2. 检查输出目录写入权限
3. 使用管理员权限运行

## 🔮 后续计划

- [ ] P1: Electron 主进程集成
- [ ] P2: React 渲染进程 UI
- [ ] P3: FFmpeg 自动下载功能
- [ ] P4: 视频预览和裁剪工具
- [ ] P5: GIF 制作和音频提取

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**注意**: 这是 P0 阶段的核心后端实现，专注于 FFmpeg 服务、任务队列和基础功能。UI 界面将在后续阶段实现。
