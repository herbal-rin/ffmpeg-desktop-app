import { FfmpegService } from '../app/services/ffmpeg/ffmpegService';
import { JobQueue } from '../app/services/queue/jobQueue';
import { ConsoleLogger } from '../app/services/logger';
import { ArgsBuilder } from '../app/services/ffmpeg/argsBuilder';
import { TranscodeOptions, FfmpegPaths } from '../app/shared/types';
import * as path from 'path';
import * as fs from 'fs';

/**
 * P0 演示示例
 * 展示如何使用 FFmpeg 后端服务进行视频转码
 */
async function runDemo() {
  console.log('🚀 FFmpeg 视频压缩应用 - P0 演示');
  console.log('=====================================\n');

  // 创建日志实例
  const logger = new ConsoleLogger('info');

  // 检查 FFmpeg 路径（这里使用模拟路径，实际使用时需要配置真实路径）
  const ffmpegPaths: FfmpegPaths = {
    ffmpeg: process.env.FFMPEG_PATH || 'ffmpeg',
    ffprobe: process.env.FFPROBE_PATH || 'ffprobe'
  };

  try {
    // 验证 FFmpeg 是否可用
    await validateFFmpeg(ffmpegPaths, logger);
  } catch (error) {
    console.error('❌ FFmpeg 验证失败:', error instanceof Error ? error.message : String(error));
    console.log('\n请确保：');
    console.log('1. FFmpeg 已安装并在 PATH 中');
    console.log('2. 或设置环境变量 FFMPEG_PATH 和 FFPROBE_PATH');
    console.log('3. 或使用 npm run demo:mock 运行模拟演示');
    return;
  }

  // 创建服务实例
  const ffmpegService = new FfmpegService(ffmpegPaths, logger);
  const jobQueue = new JobQueue(ffmpegService, logger);

  // 设置事件监听
  setupEventListeners(jobQueue, logger);

  // 创建示例任务
  const demoJobs = createDemoJobs();

  console.log('📋 创建演示任务...\n');

  // 添加任务到队列
  for (const jobOpts of demoJobs) {
    const job = jobQueue.enqueue(jobOpts);
    console.log(`✅ 任务已加入队列: ${job.id}`);
    console.log(`   输入: ${path.basename(jobOpts.input)}`);
    console.log(`   输出: ${jobOpts.container} (${jobOpts.videoCodec})`);
    console.log(`   预设: ${jobOpts.videoPreset.name}`);
    console.log(`   音频: ${jobOpts.audio.mode === 'copy' ? '复制' : '重编码'}\n`);
  }

  // 开始处理队列
  console.log('🎬 开始处理任务队列...\n');
  jobQueue.start();

  // 等待所有任务完成
  await waitForQueueEmpty(jobQueue);

  console.log('\n🎉 所有任务已完成！');
  console.log('=====================================');
}

/**
 * 验证 FFmpeg 是否可用
 */
async function validateFFmpeg(paths: FfmpegPaths, logger: ConsoleLogger): Promise<void> {
  const { spawn } = await import('child_process');
  
  return new Promise((resolve, reject) => {
    const process = spawn(paths.ffmpeg, ['-version'], { stdio: 'pipe' });
    
    process.on('close', (code) => {
      if (code === 0) {
        logger.info('FFmpeg 验证成功');
        resolve();
      } else {
        reject(new Error(`FFmpeg 验证失败 (退出码: ${code})`));
      }
    });
    
    process.on('error', (error) => {
      reject(new Error(`FFmpeg 启动失败: ${error.message}`));
    });
  });
}

/**
 * 设置事件监听器
 */
function setupEventListeners(jobQueue: JobQueue, logger: ConsoleLogger): void {
  jobQueue.on('job-start', ({ job }) => {
    console.log(`▶️  任务开始: ${job.id}`);
    console.log(`   输入: ${path.basename(job.opts.input)}`);
    console.log(`   编码器: ${job.opts.videoCodec}`);
    console.log('');
  });

  jobQueue.on('job-progress', ({ job, progress }) => {
    const percentage = (progress.ratio * 100).toFixed(1);
    const speed = progress.speed.toFixed(1);
    const eta = progress.etaSec ? formatDuration(progress.etaSec) : '未知';
    
    process.stdout.write(`\r📊 ${job.id}: ${percentage}% | 速度: ${speed}x | ETA: ${eta}`);
  });

  jobQueue.on('job-done', ({ job }) => {
    const duration = job.finishedAt && job.startedAt 
      ? ((job.finishedAt - job.startedAt) / 1000).toFixed(1)
      : '未知';
    
    console.log(`\n✅ 任务完成: ${job.id} (耗时: ${duration}秒)`);
    console.log('');
  });

  jobQueue.on('job-error', ({ job, error }) => {
    console.log(`\n❌ 任务失败: ${job.id}`);
    console.log(`   错误: ${error}`);
    console.log('');
  });

  jobQueue.on('job-canceled', ({ job }) => {
    console.log(`\n⏹️  任务取消: ${job.id}`);
    console.log('');
  });

  jobQueue.on('queue-empty', () => {
    console.log('📭 队列已空');
  });
}

/**
 * 创建演示任务
 */
function createDemoJobs(): TranscodeOptions[] {
  const inputDir = process.env.INPUT_DIR || path.join(process.cwd(), 'examples', 'input');
  const outputDir = process.env.OUTPUT_DIR || path.join(process.cwd(), 'examples', 'output');

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const jobs: TranscodeOptions[] = [];

  // 任务1: libx264 高质量预设，音频复制
  jobs.push({
    input: path.join(inputDir, 'sample.mp4'),
    outputDir,
    container: 'mp4',
    videoCodec: 'libx264',
    videoPreset: ArgsBuilder.toPreset('hq_slow', 'libx264'),
    audio: { mode: 'copy' },
    fastStart: true
  });

  // 任务2: h264_nvenc 平衡预设，音频重编码
  jobs.push({
    input: path.join(inputDir, 'sample.mkv'),
    outputDir,
    container: 'mkv',
    videoCodec: 'h264_nvenc',
    videoPreset: ArgsBuilder.toPreset('balanced', 'h264_nvenc'),
    audio: { mode: 'encode', codec: 'aac', bitrateK: 128 },
    fastStart: false
  });

  // 任务3: libx265 快速小文件预设
  jobs.push({
    input: path.join(inputDir, 'sample.mp4'),
    outputDir,
    outputName: 'sample_compressed',
    container: 'mp4',
    videoCodec: 'libx265',
    videoPreset: ArgsBuilder.toPreset('fast_small', 'libx265'),
    audio: { mode: 'encode', codec: 'libopus', bitrateK: 96 },
    fastStart: true
  });

  return jobs;
}

/**
 * 等待队列为空
 */
async function waitForQueueEmpty(jobQueue: JobQueue): Promise<void> {
  return new Promise((resolve) => {
    const checkQueue = () => {
      const status = jobQueue.getStatus();
      if (status.queueLength === 0 && !status.running) {
        resolve();
      } else {
        setTimeout(checkQueue, 1000);
      }
    };
    checkQueue();
  });
}

/**
 * 格式化时长
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}秒`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}分${secs}秒`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.round(seconds % 60);
    return `${hours}小时${minutes}分${secs}秒`;
  }
}

/**
 * 模拟演示（不需要真实的 FFmpeg）
 */
async function runMockDemo(): Promise<void> {
  console.log('🎭 FFmpeg 视频压缩应用 - 模拟演示');
  console.log('=====================================\n');

  const logger = new ConsoleLogger('info');

  // 创建模拟的 FFmpeg 服务
  const mockFfmpegService = {
    async transcode(job: any, onProgress: (progress: any) => void): Promise<void> {
      return new Promise((resolve) => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 0.1;
          if (progress <= 1) {
            onProgress({
              ratio: progress,
              timeMs: progress * 100000,
              speed: 1.0 + Math.random() * 0.5,
              bitrate: `${Math.floor(1000 + Math.random() * 1000)}kbits/s`,
              etaSec: (1 - progress) * 100
            });
          } else {
            clearInterval(interval);
            resolve();
          }
        }, 200);
      });
    },
    getActiveProcesses: () => [],
    pause: () => {},
    resume: () => {},
    cancel: () => {}
  };

  const jobQueue = new JobQueue(mockFfmpegService as any, logger);

  // 设置事件监听
  setupEventListeners(jobQueue, logger);

  // 创建模拟任务
  const mockJobs: TranscodeOptions[] = [
    {
      input: '/path/to/sample1.mp4',
      outputDir: '/path/to/output',
      container: 'mp4',
      videoCodec: 'libx264',
      videoPreset: ArgsBuilder.toPreset('hq_slow', 'libx264'),
      audio: { mode: 'copy' }
    },
    {
      input: '/path/to/sample2.mkv',
      outputDir: '/path/to/output',
      container: 'mkv',
      videoCodec: 'h264_nvenc',
      videoPreset: ArgsBuilder.toPreset('balanced', 'h264_nvenc'),
      audio: { mode: 'encode', codec: 'aac', bitrateK: 128 }
    }
  ];

  console.log('📋 创建模拟任务...\n');

  for (const jobOpts of mockJobs) {
    const job = jobQueue.enqueue(jobOpts);
    console.log(`✅ 任务已加入队列: ${job.id}`);
    console.log(`   输入: ${path.basename(jobOpts.input)}`);
    console.log(`   输出: ${jobOpts.container} (${jobOpts.videoCodec})`);
    console.log(`   预设: ${jobOpts.videoPreset.name}`);
    console.log(`   音频: ${jobOpts.audio.mode === 'copy' ? '复制' : '重编码'}\n`);
  }

  console.log('🎬 开始处理模拟任务...\n');
  jobQueue.start();

  await waitForQueueEmpty(jobQueue);

  console.log('\n🎉 模拟演示完成！');
  console.log('=====================================');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--mock')) {
    await runMockDemo();
  } else {
    await runDemo();
  }
}

// 运行演示
if (require.main === module) {
  main().catch((error) => {
    console.error('演示运行失败:', error);
    process.exit(1);
  });
}

export { runDemo, runMockDemo };
