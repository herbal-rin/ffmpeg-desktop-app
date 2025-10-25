/**
 * 路径转义工具
 * 用于处理 FFmpeg 参数中的特殊字符和路径
 */
export class PathEscapeUtils {
  /**
   * 转义字幕文件路径，处理 Windows 中文路径和特殊字符
   */
  static escapeSubtitlePath(subtitlePath: string): string {
    if (!subtitlePath) return '';
    
    // 在 Windows 上，需要特别处理中文路径和反斜杠
    if (process.platform === 'win32') {
      // 将反斜杠转换为正斜杠
      let escaped = subtitlePath.replace(/\\/g, '/');
      
      // 转义特殊字符
      escaped = escaped.replace(/:/g, '\\:');
      escaped = escaped.replace(/\[/g, '\\[');
      escaped = escaped.replace(/\]/g, '\\]');
      escaped = escaped.replace(/\(/g, '\\(');
      escaped = escaped.replace(/\)/g, '\\)');
      escaped = escaped.replace(/\s/g, '\\ ');
      
      return escaped;
    } else {
      // Unix 系统处理
      let escaped = subtitlePath;
      
      // 转义特殊字符
      escaped = escaped.replace(/:/g, '\\:');
      escaped = escaped.replace(/\[/g, '\\[');
      escaped = escaped.replace(/\]/g, '\\]');
      escaped = escaped.replace(/\(/g, '\\(');
      escaped = escaped.replace(/\)/g, '\\)');
      escaped = escaped.replace(/\s/g, '\\ ');
      
      return escaped;
    }
  }

  /**
   * 转义输入文件路径
   */
  static escapeInputPath(inputPath: string): string {
    if (!inputPath) return '';
    
    // 基本转义
    let escaped = inputPath;
    
    // 转义特殊字符
    escaped = escaped.replace(/:/g, '\\:');
    escaped = escaped.replace(/\[/g, '\\[');
    escaped = escaped.replace(/\]/g, '\\]');
    escaped = escaped.replace(/\(/g, '\\(');
    escaped = escaped.replace(/\)/g, '\\)');
    escaped = escaped.replace(/\s/g, '\\ ');
    
    return escaped;
  }

  /**
   * 转义输出文件路径
   */
  static escapeOutputPath(outputPath: string): string {
    if (!outputPath) return '';
    
    // 输出路径通常不需要特殊转义，但为了安全起见
    let escaped = outputPath;
    
    // 转义特殊字符
    escaped = escaped.replace(/:/g, '\\:');
    escaped = escaped.replace(/\[/g, '\\[');
    escaped = escaped.replace(/\]/g, '\\]');
    escaped = escaped.replace(/\(/g, '\\(');
    escaped = escaped.replace(/\)/g, '\\)');
    escaped = escaped.replace(/\s/g, '\\ ');
    
    return escaped;
  }

  /**
   * 验证路径是否包含危险字符
   */
  static validatePath(path: string): { valid: boolean; reason?: string } {
    if (!path) {
      return { valid: false, reason: '路径为空' };
    }

    // 检查危险字符
    const dangerousChars = ['<', '>', '|', '&', ';', '`', '$', '!'];
    for (const char of dangerousChars) {
      if (path.includes(char)) {
        return { valid: false, reason: `包含危险字符: ${char}` };
      }
    }

    // 检查路径长度
    if (path.length > 260) {
      return { valid: false, reason: '路径过长' };
    }

    return { valid: true };
  }

  /**
   * 规范化路径（处理相对路径、.. 等）
   */
  static normalizePath(inputPath: string): string {
    if (!inputPath) return '';
    
    try {
      const path = require('path');
      return path.resolve(inputPath);
    } catch (error) {
      return inputPath; // 如果规范化失败，返回原路径
    }
  }

  /**
   * 检查路径是否存在
   */
  static async pathExists(path: string): Promise<boolean> {
    try {
      const fs = require('fs').promises;
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取路径的父目录
   */
  static getParentDir(path: string): string {
    try {
      const pathModule = require('path');
      return pathModule.dirname(path);
    } catch {
      return '';
    }
  }

  /**
   * 检查目录是否可写
   */
  static async isDirectoryWritable(dirPath: string): Promise<boolean> {
    try {
      const fs = require('fs').promises;
      await fs.access(dirPath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 转义滤镜路径（用于 -vf subtitles= 等）
   * FFmpeg filtergraph 内需要对 \ : ' 空格 做转义
   */
  static escapeFilterPath(path: string): string {
    if (!path) return '';
    
    return path
      .replace(/\\/g, '\\\\\\\\')  // \ -> \\\\
      .replace(/:/g, '\\\\:')        // : -> \:
      .replace(/'/g, "\\\\'")        // ' -> \'
      .replace(/\s/g, '\\\\ ');     // 空格 -> \ 
  }

  /**
   * 转义字幕滤镜路径（专门用于 subtitles 滤镜）
   */
  static escapeSubtitleFilterPath(subtitlePath: string): string {
    if (!subtitlePath) return '';
    
    // 先进行基本路径转义
    let escaped = this.escapeInputPath(subtitlePath);
    
    // 然后进行滤镜特殊转义
    escaped = this.escapeFilterPath(escaped);
    
    return escaped;
  }

  /**
   * 验证滤镜路径是否安全
   */
  static validateFilterPath(path: string): { valid: boolean; reason?: string } {
    const basic = this.validatePath(path);
    if (!basic.valid) return basic;
    
    // 检查滤镜特殊字符
    const dangerousFilterChars = [';', '|', '&', '`', '$', '!'];
    for (const char of dangerousFilterChars) {
      if (path.includes(char)) {
        return { valid: false, reason: `滤镜路径包含危险字符: ${char}` };
      }
    }
    
    return { valid: true };
  }
}
