/**
 * 时间工具函数测试
 */

import { describe, it, expect } from 'vitest';
import { 
  toHMSms, 
  parseHMSms, 
  validateTimeRange, 
  formatDuration, 
  estimateGifSize 
} from '../app/shared/time';

describe('Time Utils', () => {
  describe('toHMSms', () => {
    it('should convert seconds to HH:MM:SS.mmm format', () => {
      expect(toHMSms(0)).toBe('00:00:00.000');
      expect(toHMSms(1.5)).toBe('00:00:01.500');
      expect(toHMSms(61.123)).toMatch(/^00:01:01\.12[23]$/);
      expect(toHMSms(3661.456)).toMatch(/^01:01:01\.45[56]$/);
      expect(toHMSms(7322.789)).toMatch(/^02:02:02\.78[89]$/);
    });

    it('should handle negative values', () => {
      expect(toHMSms(-1)).toBe('00:00:00.000');
      expect(toHMSms(-10.5)).toBe('00:00:00.000');
    });

    it('should handle large values', () => {
      expect(toHMSms(3600)).toBe('01:00:00.000');
      expect(toHMSms(86400)).toBe('24:00:00.000');
    });
  });

  describe('parseHMSms', () => {
    it('should parse HH:MM:SS.mmm format', () => {
      expect(parseHMSms('00:00:00.000')).toBe(0);
      expect(parseHMSms('00:00:01.500')).toBe(1.5);
      expect(parseHMSms('00:01:01.123')).toBe(61.123);
      expect(parseHMSms('01:01:01.456')).toBe(3661.456);
      expect(parseHMSms('02:02:02.789')).toBe(7322.789);
    });

    it('should parse MM:SS.mmm format', () => {
      expect(parseHMSms('00:00.000')).toBe(0);
      expect(parseHMSms('01:30.500')).toBe(90.5);
      expect(parseHMSms('05:45.123')).toBe(345.123);
    });

    it('should parse SS.mmm format', () => {
      expect(parseHMSms('0.000')).toBe(0);
      expect(parseHMSms('30.500')).toBe(30.5);
      expect(parseHMSms('123.456')).toBe(123.456);
    });

    it('should handle invalid input', () => {
      expect(parseHMSms('')).toBe(0);
      expect(parseHMSms('invalid')).toBe(0);
      expect(parseHMSms('12:34:56:78')).toBe(0);
      expect(parseHMSms('abc:def:ghi')).toBe(0);
    });

    it('should handle edge cases', () => {
      expect(parseHMSms('00:00:00')).toBe(0);
      expect(parseHMSms('00:00')).toBe(0);
      expect(parseHMSms('00')).toBe(0);
    });
  });

  describe('validateTimeRange', () => {
    it('should validate correct time ranges', () => {
      const result = validateTimeRange({ startSec: 10, endSec: 20 }, 30);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject negative start time', () => {
      const result = validateTimeRange({ startSec: -1, endSec: 20 }, 30);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('开始时间不能为负数');
    });

    it('should reject end time before start time', () => {
      const result = validateTimeRange({ startSec: 20, endSec: 10 }, 30);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('结束时间必须大于开始时间');
    });

    it('should reject start time beyond duration', () => {
      const result = validateTimeRange({ startSec: 35, endSec: 40 }, 30);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('开始时间不能超过视频总时长');
    });

    it('should reject end time beyond duration', () => {
      const result = validateTimeRange({ startSec: 10, endSec: 35 }, 30);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('结束时间不能超过视频总时长');
    });

    it('should reject too short range', () => {
      const result = validateTimeRange({ startSec: 10, endSec: 10.3 }, 30);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('时间范围至少需要 0.5 秒');
    });

    it('should accept minimum valid range', () => {
      const result = validateTimeRange({ startSec: 10, endSec: 10.5 }, 30);
      expect(result.valid).toBe(true);
    });
  });

  describe('formatDuration', () => {
    it('should format short durations in seconds', () => {
      expect(formatDuration(0)).toBe('0.0 秒');
      expect(formatDuration(30.5)).toBe('30.5 秒');
      expect(formatDuration(59.9)).toBe('59.9 秒');
    });

    it('should format medium durations in minutes and seconds', () => {
      expect(formatDuration(60)).toBe('1 分 0 秒');
      expect(formatDuration(90)).toBe('1 分 30 秒');
      expect(formatDuration(3599)).toBe('59 分 59 秒');
    });

    it('should format long durations in hours and minutes', () => {
      expect(formatDuration(3600)).toBe('1 小时 0 分钟');
      expect(formatDuration(3660)).toBe('1 小时 1 分钟');
      expect(formatDuration(7200)).toBe('2 小时 0 分钟');
    });
  });

  describe('estimateGifSize', () => {
    it('should estimate GIF file size correctly', () => {
      const size = estimateGifSize(640, 480, 12, 10);
      expect(size).toMatch(/^\d+(\.\d+)? (KB|MB)$/);
    });

    it('should return larger estimates for higher resolution', () => {
      const smallSize = estimateGifSize(320, 240, 12, 10);
      const largeSize = estimateGifSize(1280, 720, 12, 10);
      
      // 解析大小值进行比较（考虑单位）
      const parseSize = (sizeStr: string): number => {
        const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(KB|MB)$/);
        if (!match || !match[1]) return 0;
        const value = parseFloat(match[1]);
        const unit = match[2]!;
        return unit === 'MB' ? value * 1024 : value;
      };
      
      const smallValue = parseSize(smallSize);
      const largeValue = parseSize(largeSize);
      
      expect(largeValue).toBeGreaterThan(smallValue);
    });

    it('should return larger estimates for higher frame rate', () => {
      const lowFpsSize = estimateGifSize(640, 480, 8, 10);
      const highFpsSize = estimateGifSize(640, 480, 24, 10);
      
      const lowFpsValue = parseFloat(lowFpsSize);
      const highFpsValue = parseFloat(highFpsSize);
      
      expect(highFpsValue).toBeGreaterThan(lowFpsValue);
    });

    it('should return larger estimates for longer duration', () => {
      const shortSize = estimateGifSize(640, 480, 12, 5);
      const longSize = estimateGifSize(640, 480, 12, 20);
      
      const shortValue = parseFloat(shortSize);
      const longValue = parseFloat(longSize);
      
      expect(longValue).toBeGreaterThan(shortValue);
    });

    it('should handle edge cases', () => {
      expect(estimateGifSize(0, 0, 0, 0)).toBe('0 KB');
      expect(estimateGifSize(1, 1, 1, 1)).toMatch(/^\d+(\.\d+)? (KB|MB)$/);
    });
  });
});
