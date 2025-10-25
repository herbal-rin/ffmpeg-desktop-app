/**
 * GPU 体检功能
 * 检测硬件加速可用性
 */

import { spawn } from 'child_process';
import { Logger } from '../shared/types';

export interface GPUDiagnosticResult {
  hwaccels: string[];
  encoders: string[];
  nvenc?: boolean;
  qsv?: boolean;
  videotoolbox?: boolean;
  notes?: string[];
}

export interface EncoderTestResult {
  encoder: string;
  available: boolean;
  error?: string;
}

export class GPUDetector {
  constructor(private logger: Logger) {}

  /**
   * 执行GPU体检
   */
  async diagnoseGPU(ffmpegPath: string = 'ffmpeg'): Promise<GPUDiagnosticResult> {
    this.logger.info('开始GPU体检', { ffmpegPath });
    
    const result: GPUDiagnosticResult = {
      hwaccels: [],
      encoders: [],
      notes: []
    };
    
    try {
      // 检测硬件加速器
      result.hwaccels = await this.detectHardwareAccelerators(ffmpegPath);
      
      // 检测编码器
      result.encoders = await this.detectEncoders(ffmpegPath);
      
      // 分析结果
      result.nvenc = this.hasNvencSupport(result);
      result.qsv = this.hasQsvSupport(result);
      result.videotoolbox = this.hasVideoToolboxSupport(result);
      
      // 生成建议
      result.notes = this.generateNotes(result);
      
      this.logger.info('GPU体检完成', { 
        hwaccels: result.hwaccels.length,
        encoders: result.encoders.length,
        nvenc: result.nvenc,
        qsv: result.qsv,
        videotoolbox: result.videotoolbox
      });
      
    } catch (error) {
      this.logger.error('GPU体检失败', { error: error instanceof Error ? error.message : String(error) });
      result.notes = result.notes || [];
      result.notes.push(`体检失败: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return result;
  }

  /**
   * 检测硬件加速器
   */
  private async detectHardwareAccelerators(ffmpegPath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const process = spawn(ffmpegPath, ['-hwaccels'], { shell: false });
      let output = '';
      
      process.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr?.on('data', (data) => {
        output += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          const hwaccels = this.parseHardwareAccelerators(output);
          resolve(hwaccels);
        } else {
          reject(new Error(`FFmpeg退出码: ${code}`));
        }
      });
      
      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 解析硬件加速器输出
   */
  private parseHardwareAccelerators(output: string): string[] {
    const lines = output.split('\n');
    const hwaccels: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('Hardware') && !trimmed.startsWith('---')) {
        hwaccels.push(trimmed);
      }
    }
    
    return hwaccels;
  }

  /**
   * 检测编码器
   */
  private async detectEncoders(ffmpegPath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const process = spawn(ffmpegPath, ['-hide_banner', '-encoders'], { shell: false });
      let output = '';
      
      process.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr?.on('data', (data) => {
        output += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          const encoders = this.parseEncoders(output);
          resolve(encoders);
        } else {
          reject(new Error(`FFmpeg退出码: ${code}`));
        }
      });
      
      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 解析编码器输出
   */
  private parseEncoders(output: string): string[] {
    const lines = output.split('\n');
    const encoders: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes('_nvenc') || trimmed.includes('_qsv') || trimmed.includes('_videotoolbox')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length > 1 && parts[1]) {
          encoders.push(parts[1]);
        }
      }
    }
    
    return encoders;
  }

  /**
   * 检查NVENC支持
   */
  private hasNvencSupport(result: GPUDiagnosticResult): boolean {
    return result.encoders.some(encoder => 
      encoder.includes('nvenc') || encoder.includes('h264_nvenc') || encoder.includes('hevc_nvenc')
    );
  }

  /**
   * 检查QSV支持
   */
  private hasQsvSupport(result: GPUDiagnosticResult): boolean {
    return result.encoders.some(encoder => 
      encoder.includes('qsv') || encoder.includes('h264_qsv') || encoder.includes('hevc_qsv')
    );
  }

  /**
   * 检查VideoToolbox支持
   */
  private hasVideoToolboxSupport(result: GPUDiagnosticResult): boolean {
    return result.encoders.some(encoder => 
      encoder.includes('videotoolbox') || encoder.includes('h264_videotoolbox') || encoder.includes('hevc_videotoolbox')
    );
  }

  /**
   * 生成建议和提示
   */
  private generateNotes(result: GPUDiagnosticResult): string[] {
    const notes: string[] = [];
    
    if (result.nvenc) {
      notes.push('✅ NVIDIA GPU硬件编码可用');
      if (process.platform === 'win32') {
        notes.push('💡 Windows用户：确保NVIDIA驱动为最新版本');
      }
    } else {
      notes.push('❌ NVIDIA GPU硬件编码不可用');
      if (process.platform === 'win32') {
        notes.push('💡 建议：更新NVIDIA驱动或检查GPU型号');
      }
    }
    
    if (result.qsv) {
      notes.push('✅ Intel Quick Sync Video可用');
      if (process.platform === 'win32') {
        notes.push('💡 Windows用户：确保Intel显卡驱动为最新版本');
      }
    } else {
      notes.push('❌ Intel Quick Sync Video不可用');
      if (process.platform === 'win32') {
        notes.push('💡 建议：更新Intel显卡驱动');
      }
    }
    
    if (result.videotoolbox) {
      notes.push('✅ Apple VideoToolbox可用');
    } else {
      notes.push('❌ Apple VideoToolbox不可用');
      if (process.platform === 'darwin') {
        notes.push('💡 macOS用户：检查系统版本和硬件支持');
      }
    }
    
    if (result.hwaccels.length === 0) {
      notes.push('⚠️ 未检测到硬件加速器');
    }
    
    if (result.encoders.length === 0) {
      notes.push('⚠️ 未检测到硬件编码器');
    }
    
    return notes;
  }

  /**
   * 快速测试编码器
   */
  async quickTestEncoder(ffmpegPath: string, encoder: string): Promise<EncoderTestResult> {
    this.logger.info('快速测试编码器', { encoder });
    
    return new Promise((resolve) => {
      const args = [
        '-hide_banner',
        '-y',
        '-f', 'lavfi',
        '-i', 'testsrc=size=128x72:rate=30',
        '-t', '1',
        '-c:v', encoder,
        '-f', 'null',
        '-'
      ];
      
      const process = spawn(ffmpegPath, args, { shell: false });
      let errorOutput = '';
      
      process.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({
            encoder,
            available: true
          });
        } else {
          resolve({
            encoder,
            available: false,
            error: errorOutput.substring(0, 200) // 限制错误信息长度
          });
        }
      });
      
      process.on('error', (error) => {
        resolve({
          encoder,
          available: false,
          error: error.message
        });
      });
    });
  }

  /**
   * 批量测试编码器
   */
  async batchTestEncoders(ffmpegPath: string, encoders: string[]): Promise<EncoderTestResult[]> {
    const results: EncoderTestResult[] = [];
    
    for (const encoder of encoders) {
      try {
        const result = await this.quickTestEncoder(ffmpegPath, encoder);
        results.push(result);
        
        // 添加小延迟避免过于频繁的测试
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results.push({
          encoder,
          available: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return results;
  }
}
