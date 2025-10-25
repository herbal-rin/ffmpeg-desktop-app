import { describe, it, expect } from 'vitest';
import { ArgsBuilder } from '../app/services/ffmpeg/argsBuilder';
import { VideoCodec, Container, AudioPolicy } from '../app/shared/types';

describe('ArgsBuilder', () => {
  describe('buildVideoArgs', () => {
    it('应该为 libx264 高质量预设构建正确参数', () => {
      const codec: VideoCodec = 'libx264';
      const preset = ArgsBuilder.toPreset('hq_slow', codec);
      const container: Container = 'mp4';
      const audio: AudioPolicy = { mode: 'copy' };
      
      const args = ArgsBuilder.buildVideoArgs(codec, preset, container, audio, true);
      
      expect(args).toContain('-c:v');
      expect(args).toContain('libx264');
      expect(args).toContain('-preset');
      expect(args).toContain('slow');
      expect(args).toContain('-crf');
      expect(args).toContain('18');
      expect(args).toContain('-c:a');
      expect(args).toContain('copy');
      expect(args).toContain('-movflags');
      expect(args).toContain('+faststart');
    });

    it('应该为 h264_nvenc 平衡预设构建正确参数', () => {
      const codec: VideoCodec = 'h264_nvenc';
      const preset = ArgsBuilder.toPreset('balanced', codec);
      const container: Container = 'mkv';
      const audio: AudioPolicy = { mode: 'encode', codec: 'aac', bitrateK: 128 };
      
      const args = ArgsBuilder.buildVideoArgs(codec, preset, container, audio, false);
      
      expect(args).toContain('-c:v');
      expect(args).toContain('h264_nvenc');
      expect(args).toContain('-preset');
      expect(args).toContain('p4');
      expect(args).toContain('-cq');
      expect(args).toContain('22');
      expect(args).toContain('-c:a');
      expect(args).toContain('aac');
      expect(args).toContain('-b:a');
      expect(args).toContain('128k');
      expect(args).not.toContain('-movflags');
    });

    it('应该为音频重编码构建正确参数', () => {
      const codec: VideoCodec = 'libx264';
      const preset = ArgsBuilder.toPreset('fast_small', codec);
      const container: Container = 'mp4';
      const audio: AudioPolicy = { mode: 'encode', codec: 'libopus', bitrateK: 96 };
      
      const args = ArgsBuilder.buildVideoArgs(codec, preset, container, audio, true);
      
      expect(args).toContain('-c:a');
      expect(args).toContain('libopus');
      expect(args).toContain('-b:a');
      expect(args).toContain('96k');
    });
  });

  describe('buildFullArgs', () => {
    it('应该构建完整的 FFmpeg 命令参数', () => {
      const input = '/path/to/input.mp4';
      const output = '/path/to/output.mkv';
      const codec: VideoCodec = 'libx264';
      const preset = ArgsBuilder.toPreset('balanced', codec);
      const container: Container = 'mkv';
      const audio: AudioPolicy = { mode: 'copy' };
      const extraArgs = ['-threads', '4'];
      
      const args = ArgsBuilder.buildFullArgs(
        input, output, codec, preset, container, audio, false, extraArgs
      );
      
      expect(args[0]).toBe('-y');
      expect(args[1]).toBe('-i');
      expect(args[2]).toBe(input);
      expect(args).toContain('-c:v');
      expect(args).toContain('libx264');
      expect(args).toContain('-c:a');
      expect(args).toContain('copy');
      expect(args).toContain('-threads');
      expect(args).toContain('4');
      expect(args[args.length - 4]).toBe(output);
      expect(args[args.length - 3]).toBe('-progress');
      expect(args[args.length - 2]).toBe('pipe:1');
      expect(args[args.length - 1]).toBe('-nostats');
    });
  });

  describe('toPreset', () => {
    it('应该为不同编码器返回正确的预设', () => {
      const codecs: VideoCodec[] = ['libx264', 'libx265', 'h264_nvenc', 'hevc_nvenc'];
      
      codecs.forEach(codec => {
        const hqPreset = ArgsBuilder.toPreset('hq_slow', codec);
        const balancedPreset = ArgsBuilder.toPreset('balanced', codec);
        const fastPreset = ArgsBuilder.toPreset('fast_small', codec);
        
        expect(hqPreset.name).toBe('hq_slow');
        expect(balancedPreset.name).toBe('balanced');
        expect(fastPreset.name).toBe('fast_small');
        
        expect(hqPreset.args.length).toBeGreaterThan(0);
        expect(balancedPreset.args.length).toBeGreaterThan(0);
        expect(fastPreset.args.length).toBeGreaterThan(0);
      });
    });

    it('应该为不支持的编码器抛出错误', () => {
      expect(() => {
        ArgsBuilder.toPreset('hq_slow', 'unsupported_codec' as VideoCodec);
      }).toThrow('不支持的编码器');
    });
  });

  describe('isHardwareAccelerated', () => {
    it('应该正确识别硬件加速编码器', () => {
      expect(ArgsBuilder.isHardwareAccelerated('h264_nvenc')).toBe(true);
      expect(ArgsBuilder.isHardwareAccelerated('hevc_nvenc')).toBe(true);
      expect(ArgsBuilder.isHardwareAccelerated('h264_qsv')).toBe(true);
      expect(ArgsBuilder.isHardwareAccelerated('hevc_qsv')).toBe(true);
      expect(ArgsBuilder.isHardwareAccelerated('h264_videotoolbox')).toBe(true);
      expect(ArgsBuilder.isHardwareAccelerated('hevc_videotoolbox')).toBe(true);
    });

    it('应该正确识别软件编码器', () => {
      expect(ArgsBuilder.isHardwareAccelerated('libx264')).toBe(false);
      expect(ArgsBuilder.isHardwareAccelerated('libx265')).toBe(false);
    });
  });

  describe('validateAudioBitrate', () => {
    it('应该验证有效的音频码率', () => {
      expect(ArgsBuilder.validateAudioBitrate(64)).toBe(true);
      expect(ArgsBuilder.validateAudioBitrate(128)).toBe(true);
      expect(ArgsBuilder.validateAudioBitrate(320)).toBe(true);
    });

    it('应该拒绝无效的音频码率', () => {
      expect(ArgsBuilder.validateAudioBitrate(0)).toBe(false);
      expect(ArgsBuilder.validateAudioBitrate(-1)).toBe(false);
      expect(ArgsBuilder.validateAudioBitrate(500)).toBe(false);
    });
  });

  describe('getRecommendedAudioBitrate', () => {
    it('应该返回推荐的音频码率', () => {
      expect(ArgsBuilder.getRecommendedAudioBitrate('aac')).toBe(128);
      expect(ArgsBuilder.getRecommendedAudioBitrate('libopus')).toBe(96);
      expect(ArgsBuilder.getRecommendedAudioBitrate('libmp3lame')).toBe(128);
    });
  });
});
