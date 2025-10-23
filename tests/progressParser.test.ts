import { describe, it, expect } from 'vitest';
import { ProgressParser } from '../app/services/ffmpeg/progressParser';
import { Progress } from '../app/shared/types';

describe('ProgressParser', () => {
  describe('parseProgressChunk', () => {
    it('应该解析包含 out_time_ms 的数据块', () => {
      const buffer = Buffer.from('out_time_ms=123456\n');
      const result = ProgressParser.parseProgressChunk(buffer);
      
      expect(result.timeMs).toBe(123456);
    });

    it('应该解析包含 speed 的数据块', () => {
      const buffer = Buffer.from('speed=1.2x\n');
      const result = ProgressParser.parseProgressChunk(buffer);
      
      expect(result.speed).toBe(1.2);
    });

    it('应该解析包含 bitrate 的数据块', () => {
      const buffer = Buffer.from('bitrate=2145kbits/s\n');
      const result = ProgressParser.parseProgressChunk(buffer);
      
      expect(result.bitrate).toBe('2145kbits/s');
    });

    it('应该解析包含多个字段的数据块', () => {
      const buffer = Buffer.from('out_time_ms=123456\nspeed=1.2x\nbitrate=2145kbits/s\n');
      const result = ProgressParser.parseProgressChunk(buffer);
      
      expect(result.timeMs).toBe(123456);
      expect(result.speed).toBe(1.2);
      expect(result.bitrate).toBe('2145kbits/s');
    });

    it('应该处理空数据块', () => {
      const buffer = Buffer.from('');
      const result = ProgressParser.parseProgressChunk(buffer);
      
      expect(result).toEqual({});
    });

    it('应该处理无效格式的数据', () => {
      const buffer = Buffer.from('invalid_data\nout_time_ms=123456\n');
      const result = ProgressParser.parseProgressChunk(buffer);
      
      expect(result.timeMs).toBe(123456);
    });
  });

  describe('calculateProgress', () => {
    it('应该计算正确的进度比例', () => {
      const partial = { timeMs: 50000, speed: 1.0 };
      const totalDurationMs = 100000;
      
      const progress = ProgressParser.calculateProgress(partial, totalDurationMs);
      
      expect(progress.ratio).toBe(0.5);
      expect(progress.timeMs).toBe(50000);
      expect(progress.speed).toBe(1.0);
    });

    it('应该计算 ETA', () => {
      const partial = { timeMs: 50000, speed: 2.0 };
      const totalDurationMs = 100000;
      
      const progress = ProgressParser.calculateProgress(partial, totalDurationMs);
      
      expect(progress.etaSec).toBeCloseTo(25); // (100000 - 50000) / (2.0 * 1000)
    });

    it('应该处理零时长的情况', () => {
      const partial = { timeMs: 50000, speed: 1.0 };
      const totalDurationMs = 0;
      
      const progress = ProgressParser.calculateProgress(partial, totalDurationMs);
      
      expect(progress.ratio).toBe(0);
      expect(progress.etaSec).toBeUndefined();
    });

    it('应该限制进度比例不超过 1', () => {
      const partial = { timeMs: 150000, speed: 1.0 };
      const totalDurationMs = 100000;
      
      const progress = ProgressParser.calculateProgress(partial, totalDurationMs);
      
      expect(progress.ratio).toBe(1);
    });

    it('应该处理负 ETA', () => {
      const partial = { timeMs: 100000, speed: 1.0 };
      const totalDurationMs = 100000;
      
      const progress = ProgressParser.calculateProgress(partial, totalDurationMs);
      
      expect(progress.etaSec).toBe(0);
    });
  });

  describe('parseProgressLine', () => {
    it('应该解析单行进度数据', () => {
      const line = 'out_time_ms=123456 speed=1.2x bitrate=2145kbits/s';
      const result = ProgressParser.parseProgressLine(line);
      
      expect(result.timeMs).toBe(123456);
      expect(result.speed).toBe(1.2);
      expect(result.bitrate).toBe('2145kbits/s');
    });

    it('应该处理部分字段缺失的情况', () => {
      const line = 'out_time_ms=123456';
      const result = ProgressParser.parseProgressLine(line);
      
      expect(result.timeMs).toBe(123456);
      expect(result.speed).toBeUndefined();
      expect(result.bitrate).toBeUndefined();
    });
  });

  describe('formatProgress', () => {
    it('应该格式化进度信息', () => {
      const progress: Progress = {
        ratio: 0.5,
        timeMs: 50000,
        speed: 1.2,
        bitrate: '2145kbits/s',
        etaSec: 25
      };
      
      const formatted = ProgressParser.formatProgress(progress);
      
      expect(formatted).toContain('50.0%');
      expect(formatted).toContain('速度: 1.2x');
      expect(formatted).toContain('码率: 2145kbits/s');
    });

    it('应该处理未知 ETA', () => {
      const progress: Progress = {
        ratio: 0.5,
        timeMs: 50000,
        speed: 0,
        bitrate: '2145kbits/s'
      };
      
      const formatted = ProgressParser.formatProgress(progress);
      
      expect(formatted).toContain('ETA: 未知');
    });
  });

  describe('formatDuration', () => {
    it('应该格式化秒数', () => {
      expect(ProgressParser.formatDuration(30)).toBe('30秒');
      expect(ProgressParser.formatDuration(90)).toBe('1分30秒');
      expect(ProgressParser.formatDuration(3661)).toBe('1小时1分1秒');
    });

    it('应该处理小数秒数', () => {
      expect(ProgressParser.formatDuration(30.7)).toBe('31秒');
    });
  });

  describe('isValidProgressLine', () => {
    it('应该识别有效的进度行', () => {
      expect(ProgressParser.isValidProgressLine('out_time_ms=123456')).toBe(true);
      expect(ProgressParser.isValidProgressLine('speed=1.2x')).toBe(true);
      expect(ProgressParser.isValidProgressLine('bitrate=2145kbits/s')).toBe(true);
    });

    it('应该识别无效的进度行', () => {
      expect(ProgressParser.isValidProgressLine('frame=123')).toBe(false);
      expect(ProgressParser.isValidProgressLine('invalid line')).toBe(false);
    });
  });

  describe('extractProgressFromText', () => {
    it('应该从多行文本中提取进度信息', () => {
      const text = `
frame=123
out_time_ms=50000
speed=1.2x
bitrate=2145kbits/s
frame=124
      `;
      
      const result = ProgressParser.extractProgressFromText(text);
      
      expect(result.timeMs).toBe(50000);
      expect(result.speed).toBe(1.2);
      expect(result.bitrate).toBe('2145kbits/s');
    });
  });
});
