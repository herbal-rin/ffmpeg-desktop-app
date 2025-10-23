import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FfmpegService } from '../../app/services/ffmpeg/ffmpegService';
import { JobQueue } from '../../app/services/queue/jobQueue';
import { createLogger } from '../../app/services/logger';
import { PathEscapeUtils } from '../../app/services/ffmpeg/pathEscapeUtils';
import { HardwareAccelBlacklist } from '../../app/services/ffmpeg/hardwareAccelBlacklist';

describe('平台特定功能测试', () => {
  let tempDir: string;
  let testInputFile: string;
  let testOutputFile: string;

  beforeEach(() => {
    // 创建临时目录
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffmpeg-test-'));
    testInputFile = path.join(tempDir, 'test-input.mp4');
    testOutputFile = path.join(tempDir, 'test-output.mp4');

    // 创建一个小的测试视频文件（1秒的黑色视频）
    const testVideoContent = Buffer.from([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, // ftyp box
      0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00,
      0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
      0x61, 0x76, 0x63, 0x31, 0x6D, 0x70, 0x34, 0x31
    ]);
    fs.writeFileSync(testInputFile, testVideoContent);
  });

  afterEach(() => {
    // 清理临时文件
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('清理临时文件失败:', error);
    }
  });

  describe('Windows 特定功能', () => {
    it('Windows 暂停功能应该抛出错误', () => {
      if (process.platform !== 'win32') {
        console.log('跳过 Windows 特定测试（当前平台:', process.platform, ')');
        return;
      }

      const logger = createLogger(undefined, true);
      const ffmpegService = new FfmpegService(
        { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' },
        logger
      );

      expect(() => {
        ffmpegService.pause(12345);
      }).toThrow('Windows 系统暂不支持暂停功能');
    });

    it('Windows 路径转义应该正确处理反斜杠', () => {
      if (process.platform !== 'win32') {
        console.log('跳过 Windows 路径转义测试（当前平台:', process.platform, ')');
        return;
      }

      const testPath = 'C:\\Users\\测试\\视频文件.mp4';
      const escaped = PathEscapeUtils.escapeSubtitlePath(testPath);
      
      expect(escaped).toContain('/');
      expect(escaped).not.toContain('\\');
      expect(escaped).toContain('\\:');
    });
  });

  describe('Unix 特定功能', () => {
    it('Unix 系统暂停功能应该正常工作', () => {
      if (process.platform === 'win32') {
        console.log('跳过 Unix 暂停测试（当前平台:', process.platform, ')');
        return;
      }

      const logger = createLogger(undefined, true);
      const ffmpegService = new FfmpegService(
        { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' },
        logger
      );

      // Unix 系统应该不抛出错误
      expect(() => {
        ffmpegService.pause(12345);
      }).not.toThrow();
    });

    it('Unix 路径转义应该正确处理特殊字符', () => {
      if (process.platform === 'win32') {
        console.log('跳过 Unix 路径转义测试（当前平台:', process.platform, ')');
        return;
      }

      const testPath = '/home/user/测试视频/视频文件.mp4';
      const escaped = PathEscapeUtils.escapeSubtitlePath(testPath);
      
      expect(escaped).toContain('\\ ');
      expect(escaped).toContain('\\:');
    });
  });

  describe('跨平台功能', () => {
    it('路径验证应该拒绝危险字符', () => {
      const dangerousPaths = [
        'file.txt<script>',
        'file.txt|command',
        'file.txt&command',
        'file.txt;command',
        'file.txt`command`',
        'file.txt$variable',
        'file.txt!command'
      ];

      for (const dangerousPath of dangerousPaths) {
        const validation = PathEscapeUtils.validatePath(dangerousPath);
        expect(validation.valid).toBe(false);
        expect(validation.reason).toContain('包含危险字符');
      }
    });

    it('硬件加速黑名单应该正确管理', () => {
      const blacklist = HardwareAccelBlacklist.getInstance();
      
      // 清空黑名单
      blacklist.clear();
      
      // 添加编码器到黑名单
      blacklist.addToBlacklist('h264_nvenc');
      expect(blacklist.isBlacklisted('h264_nvenc')).toBe(true);
      
      // 检查状态
      const status = blacklist.getBlacklistStatus();
      expect(status).toHaveLength(1);
      expect(status[0].codec).toBe('h264_nvenc');
      
      // 移除黑名单
      blacklist.removeFromBlacklist('h264_nvenc');
      expect(blacklist.isBlacklisted('h264_nvenc')).toBe(false);
    });

    it('取消任务后临时文件应该被清理', async () => {
      const logger = createLogger(undefined, true);
      const ffmpegService = new FfmpegService(
        { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' },
        logger
      );

      // 创建一个任务
      const job = {
        id: 'test-job-1',
        input: testInputFile,
        output: testOutputFile,
        videoCodec: 'libx264' as const,
        videoPreset: { name: 'fast', args: ['-preset', 'fast'] },
        container: 'mp4' as const,
        audio: { policy: 'copy' as const },
        fastStart: true,
        extraArgs: []
      };

      const tempOutputPath = `${testOutputFile}.tmp`;
      
      // 模拟创建临时文件
      fs.writeFileSync(tempOutputPath, 'test content');
      expect(fs.existsSync(tempOutputPath)).toBe(true);

      // 模拟取消任务（清理临时文件）
      try {
        ffmpegService['cleanupTempFile'](tempOutputPath, job.id);
      } catch (error) {
        // 忽略错误，因为这只是测试清理功能
      }

      // 检查临时文件是否被删除
      expect(fs.existsSync(tempOutputPath)).toBe(false);
    });

    it('原子写入应该使用临时文件', () => {
      const finalPath = path.join(tempDir, 'final-output.mp4');
      const tempPath = `${finalPath}.tmp`;
      
      // 创建临时文件
      fs.writeFileSync(tempPath, 'test content');
      expect(fs.existsSync(tempPath)).toBe(true);
      expect(fs.existsSync(finalPath)).toBe(false);
      
      // 模拟原子写入（重命名）
      fs.renameSync(tempPath, finalPath);
      
      expect(fs.existsSync(tempPath)).toBe(false);
      expect(fs.existsSync(finalPath)).toBe(true);
    });

    it('进度解析应该处理各种异常情况', () => {
      const { ProgressParser } = require('../../app/services/ffmpeg/progressParser');
      
      // 测试无效的 speed 值
      const invalidSpeedData = Buffer.from('speed=N/A\nspeed=0x\nspeed=inf\n');
      const result1 = ProgressParser.parseProgressChunk(invalidSpeedData);
      expect(result1.speed).toBe(0);
      
      // 测试无效的 time 值
      const invalidTimeData = Buffer.from('out_time_ms=invalid\nout_time_ms=-100\n');
      const result2 = ProgressParser.parseProgressChunk(invalidTimeData);
      expect(result2.timeMs).toBeUndefined();
      
      // 测试未知时长的情况
      const progress = ProgressParser.calculateProgress(
        { timeMs: 5000, speed: 1.5 },
        0 // 总时长为 0（未知）
      );
      expect(progress.ratio).toBe(0);
      expect(progress.etaSec).toBeUndefined();
    });
  });

  describe('错误处理', () => {
    it('应该正确处理文件不存在的情况', () => {
      const nonExistentFile = path.join(tempDir, 'non-existent.mp4');
      const validation = PathEscapeUtils.validatePath(nonExistentFile);
      
      // 路径验证应该通过（只检查格式，不检查存在性）
      expect(validation.valid).toBe(true);
    });

    it('应该正确处理空路径', () => {
      const validation = PathEscapeUtils.validatePath('');
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('路径为空');
    });

    it('应该正确处理过长路径', () => {
      const longPath = 'a'.repeat(300); // 超过 260 字符限制
      const validation = PathEscapeUtils.validatePath(longPath);
      
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('路径过长');
    });
  });
});
