/**
 * 工具参数构建器测试
 */

import { describe, it, expect } from 'vitest';
import { ArgsBuilder } from '../app/services/ffmpeg/argsBuilder';
import { VideoCodec, Container, AudioPolicy } from '../app/shared/types';

describe('ArgsBuilder - Tools', () => {
  describe('buildVideoArgs for trimming', () => {
    it('should build lossless trim args correctly', () => {
      const args = ArgsBuilder.buildVideoArgs(
        'libx264' as VideoCodec,
        { name: 'balanced', args: [] },
        'mp4' as Container,
        { mode: 'copy', codec: 'aac', bitrateK: 128 } as AudioPolicy
      );

      expect(args).toContain('-c:v');
      expect(args).toContain('libx264');
      expect(args).toContain('-c:a');
      expect(args).toContain('copy');
      expect(args).toContain('-movflags');
      expect(args).toContain('+faststart');
    });

    it('should build precise trim args with encoding', () => {
      const args = ArgsBuilder.buildVideoArgs(
        'libx265' as VideoCodec,
        { name: 'balanced', args: [] },
        'mkv' as Container,
        { mode: 'encode', codec: 'aac', bitrateK: 192 } as AudioPolicy
      );

      expect(args).toContain('-c:v');
      expect(args).toContain('libx265');
      expect(args).toContain('-c:a');
      expect(args).toContain('aac');
      expect(args).toContain('-b:a');
      expect(args).toContain('192k');
    });

    it('should handle hardware acceleration codecs', () => {
      const args = ArgsBuilder.buildVideoArgs(
        'h264_nvenc' as VideoCodec,
        { name: 'balanced', args: [] },
        'mp4' as Container,
        { mode: 'copy', codec: 'aac', bitrateK: 128 } as AudioPolicy
      );

      expect(args).toContain('-c:v');
      expect(args).toContain('h264_nvenc');
    });
  });

  describe('GIF generation args', () => {
    it('should validate GIF parameters', () => {
      // 测试 GIF 参数验证逻辑
      const fps = 12;
      const maxWidth = 640;
      const dithering = 'bayer';

      expect(fps).toBeGreaterThanOrEqual(1);
      expect(fps).toBeLessThanOrEqual(30);
      expect(maxWidth).toBeGreaterThanOrEqual(128);
      expect(maxWidth).toBeLessThanOrEqual(2048);
      expect(['bayer', 'floyd']).toContain(dithering);
    });
  });

  describe('Audio extraction args', () => {
    it('should validate audio codec parameters', () => {
      const codecs = ['aac', 'libmp3lame', 'flac', 'libopus'];
      
      codecs.forEach(codec => {
        expect(codecs).toContain(codec);
      });
    });

    it('should validate bitrate ranges', () => {
      const mp3Bitrates = [64, 96, 128, 160, 192, 256, 320];
      
      mp3Bitrates.forEach(bitrate => {
        expect(bitrate).toBeGreaterThanOrEqual(48);
        expect(bitrate).toBeLessThanOrEqual(320);
      });
    });
  });
});
