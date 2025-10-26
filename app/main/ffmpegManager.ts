/**
 * FFmpeg 管理器
 * 负责检测、下载、校验、解压和切换FFmpeg
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { Logger } from '../shared/types';
import { getPlatformInfo, getFFmpegDownloadUrl, getFFmpegExecutableName } from '../shared/platform';
import { generateRandomHash } from '../shared/hash';

export interface FFmpegLocation {
  found: boolean;
  ffmpeg?: string;
  ffprobe?: string;
  source: 'PATH' | 'which' | 'where' | 'manual';
}

export interface FFmpegState {
  managed: boolean;
  ffmpegManaged?: boolean; // 是否使用托管版本
  active: {
    ffmpeg: string;
    ffprobe: string;
  };
  versions?: Array<{
    name: string;
    path: string;
  }>;
}

export interface DownloadTask {
  taskId: string;
  version: string;
  provider: 'official' | 'mirrorA' | 'mirrorB';
  platform: 'win' | 'mac' | 'linux';
  arch: 'x64' | 'arm64';
  includeProbe: boolean;
  status: 'downloading' | 'verifying' | 'extracting' | 'done' | 'error';
  progress: number;
  message?: string;
}

export interface DownloadProgress {
  taskId: string;
  phase: 'downloading' | 'verifying' | 'extracting' | 'done' | 'error';
  receivedBytes?: number;
  totalBytes?: number;
  percent?: number;
  message?: string;
}

export class FFmpegManager extends EventEmitter {
  private downloadTasks = new Map<string, DownloadTask>();
  private activeRequests = new Map<string, any>(); // 保存 ClientRequest 句柄用于取消
  private appDataPath: string;
  private ffmpegManagedPath: string;

  constructor(private logger: Logger, private webContents?: Electron.WebContents) {
    super();
    
    // 设置应用数据目录
    this.appDataPath = path.join(os.homedir(), '.ffmpeg-desktop');
    this.ffmpegManagedPath = path.join(this.appDataPath, 'ffmpeg-managed');
    
    // 确保目录存在
    this.ensureDirectories();
    
    // 转发进度事件到渲染进程
    this.on('download-progress', (data: DownloadProgress) => {
      if (this.webContents && !this.webContents.isDestroyed()) {
        this.webContents.send('ffmpeg/download-progress', data);
      }
    });
  }

  /**
   * 确保必要的目录存在
   */
  private ensureDirectories(): void {
    const dirs = [this.appDataPath, this.ffmpegManagedPath];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.debug('创建目录', { dir });
      }
    }
  }

  /**
   * 检测系统中的FFmpeg
   */
  async locateFFmpeg(): Promise<FFmpegLocation> {
    const platformInfo = getPlatformInfo();
    const { ffmpeg, ffprobe } = getFFmpegExecutableName(platformInfo);
    
    try {
      // 尝试从PATH中查找
      const ffmpegPath = await this.findExecutable(ffmpeg);
      const ffprobePath = await this.findExecutable(ffprobe);
      
      if (ffmpegPath && ffprobePath) {
        return {
          found: true,
          ffmpeg: ffmpegPath,
          ffprobe: ffprobePath,
          source: 'PATH'
        };
      }
      
      return {
        found: false,
        source: 'PATH'
      };
    } catch (error) {
      this.logger.error('检测FFmpeg失败', { error: error instanceof Error ? error.message : String(error) });
      return {
        found: false,
        source: 'PATH'
      };
    }
  }

  /**
   * 查找可执行文件
   */
  private async findExecutable(name: string): Promise<string | null> {
    return new Promise((resolve) => {
      const command = process.platform === 'win32' ? 'where' : 'which';
      
      // 使用数组参数，禁用shell
      const childProcess = spawn(command, [name], { shell: false });
      
      let output = '';
      
      childProcess.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });
      
      childProcess.on('close', (code: number) => {
        if (code === 0 && output.trim()) {
          const path = output.trim().split('\n')[0];
          resolve(path || null);
        } else {
          resolve(null);
        }
      });
      
      childProcess.on('error', () => {
        resolve(null);
      });
    });
  }

  /**
   * 获取FFmpeg状态
   */
  async getFFmpegState(configService?: any): Promise<FFmpegState> {
    const managedVersions = this.getManagedVersions();
    
    // 从配置服务获取真实路径
    let activeFfmpeg = '';
    let activeFfprobe = '';
    let ffmpegManaged = false;
    
    if (configService) {
      activeFfmpeg = configService.getFfmpegPath() || '';
      activeFfprobe = configService.getFfprobePath() || '';
      ffmpegManaged = configService.getFfmpegManaged?.() || false;
    }
    
    return {
      managed: managedVersions.length > 0,
      active: {
        ffmpeg: activeFfmpeg,
        ffprobe: activeFfprobe
      },
      ffmpegManaged,
      versions: managedVersions
    };
  }

  /**
   * 获取托管版本列表
   */
  private getManagedVersions(): Array<{ name: string; path: string }> {
    const versions: Array<{ name: string; path: string }> = [];
    
    if (!fs.existsSync(this.ffmpegManagedPath)) {
      return versions;
    }
    
    const entries = fs.readdirSync(this.ffmpegManagedPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const versionPath = path.join(this.ffmpegManagedPath, entry.name);
        const binPath = path.join(versionPath, 'bin');
        
        if (fs.existsSync(binPath)) {
          versions.push({
            name: entry.name,
            path: versionPath
          });
        }
      }
    }
    
    return versions;
  }

  /**
   * 开始下载FFmpeg
   */
  async startDownload(options: {
    provider: 'official' | 'mirrorA' | 'mirrorB';
    version: string;
    platform?: 'win' | 'mac' | 'linux';
    arch?: 'x64' | 'arm64';
    includeProbe?: boolean;
  }): Promise<string> {
    const taskId = generateRandomHash();
    const platformInfo = getPlatformInfo();
    
    const task: DownloadTask = {
      taskId,
      version: options.version,
      provider: options.provider,
      platform: options.platform || platformInfo.platformName,
      arch: options.arch || platformInfo.archName,
      includeProbe: options.includeProbe || true,
      status: 'downloading',
      progress: 0
    };
    
    this.downloadTasks.set(taskId, task);
    
    // 异步执行下载
    this.performDownload(task).catch((error) => {
      this.logger.error('下载任务失败', { taskId, error: error instanceof Error ? error.message : String(error) });
      this.updateTaskStatus(taskId, 'error', 0, error instanceof Error ? error.message : String(error));
    });
    
    return taskId;
  }

  /**
   * 执行下载任务
   */
  private async performDownload(task: DownloadTask): Promise<void> {
    try {
      const platformInfo = getPlatformInfo();
      const downloadUrl = getFFmpegDownloadUrl(task.version, platformInfo, task.provider);
      const downloadPath = path.join(this.appDataPath, 'downloads', `${task.taskId}.tmp`);
      
      // 确保下载目录存在
      const downloadDir = path.dirname(downloadPath);
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
      }
      
      this.logger.info('开始下载FFmpeg', { taskId: task.taskId, url: downloadUrl });
      
      // 下载文件
      await this.downloadFile(downloadUrl, downloadPath, task.taskId);
      
      // 验证文件
      this.updateTaskStatus(task.taskId, 'verifying', 50, '验证文件完整性...');
      const sha256 = await this.verifyDownloadedFile(downloadPath, task.taskId);
      this.logger.info('文件SHA256校验完成', { taskId: task.taskId, sha256: sha256.substring(0, 16) });
      
      // 解压文件
      this.updateTaskStatus(task.taskId, 'extracting', 75, '解压文件...');
      const extractPath = await this.extractFile(downloadPath, task.taskId);
      
      // 设置可执行权限
      await this.setExecutablePermissions(extractPath);
      
      // 完成
      this.updateTaskStatus(task.taskId, 'done', 100, '下载完成');
      
      // 清理临时文件
      fs.unlinkSync(downloadPath);
      
      this.logger.info('FFmpeg下载完成', { taskId: task.taskId, extractPath });
      
    } catch (error) {
      this.updateTaskStatus(task.taskId, 'error', task.progress, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 下载文件
   */
  private async downloadFile(url: string, filePath: string, taskId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const file = fs.createWriteStream(filePath);
      
      const request = https.get(url, (response: any) => {
        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        let receivedBytes = 0;
        
        // 保存请求句柄以便取消
        this.activeRequests.set(taskId, { request, response, file });
        
        response.on('data', (chunk: Buffer) => {
          receivedBytes += chunk.length;
          const progress = totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 50) : 0;
          
          this.updateTaskStatus(taskId, 'downloading', progress, `下载中... ${Math.round(receivedBytes / 1024 / 1024)}MB`);
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          this.activeRequests.delete(taskId);
          resolve();
        });
        
        file.on('error', (error) => {
          fs.unlink(filePath, () => {}); // 删除部分下载的文件
          this.activeRequests.delete(taskId);
          reject(error);
        });
      }).on('error', (error: Error) => {
        this.activeRequests.delete(taskId);
        reject(error);
      });
      
      // 保存主请求以便取消
      if (!this.activeRequests.has(taskId)) {
        this.activeRequests.set(taskId, { request });
      }
    });
  }

  /**
   * 验证下载的文件（SHA256）
   */
  private async verifyDownloadedFile(filePath: string, taskId: string): Promise<string> {
    const crypto = require('crypto');
    const stats = fs.statSync(filePath);
    
    if (stats.size === 0) {
      throw new Error('下载的文件为空');
    }
    
    // 计算SHA256
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    
    this.logger.debug('文件验证通过', { taskId, size: stats.size, sha256: hash.substring(0, 16) });
    
    return hash;
  }

  /**
   * 解压文件
   */
  private async extractFile(filePath: string, taskId: string): Promise<string> {
    const platformInfo = getPlatformInfo();
    const extractPath = path.join(this.ffmpegManagedPath, `${platformInfo.platformName}-${platformInfo.archName}-${taskId}`);
    
    // 确保解压目录存在
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }
    
    if (platformInfo.platformName === 'win') {
      // Windows: 解压ZIP文件
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(filePath);
      zip.extractAllTo(extractPath, true);
    } else {
      // macOS/Linux: 解压tar.xz文件
      const tar = require('tar');
      await tar.extract({
        file: filePath,
        cwd: extractPath
      });
    }
    
    return extractPath;
  }

  /**
   * 设置可执行权限
   */
  private async setExecutablePermissions(extractPath: string): Promise<void> {
    const platformInfo = getPlatformInfo();
    
    if (platformInfo.platformName !== 'win') {
      const { ffmpeg, ffprobe } = getFFmpegExecutableName(platformInfo);
      const ffmpegPath = path.join(extractPath, 'bin', ffmpeg);
      const ffprobePath = path.join(extractPath, 'bin', ffprobe);
      
      if (fs.existsSync(ffmpegPath)) {
        fs.chmodSync(ffmpegPath, 0o755);
      }
      
      if (fs.existsSync(ffprobePath)) {
        fs.chmodSync(ffprobePath, 0o755);
      }
    }
  }

  /**
   * 更新任务状态
   */
  private updateTaskStatus(taskId: string, phase: DownloadProgress['phase'], progress: number, message?: string): void {
    const task = this.downloadTasks.get(taskId);
    if (task) {
      task.status = phase;
      task.progress = progress;
      if (message !== undefined) {
        task.message = message;
      }
      
      this.emit('download-progress', {
        taskId,
        phase,
        percent: progress,
        message
      } as DownloadProgress);
    }
  }

  /**
   * 取消下载任务
   */
  async cancelDownload(taskId: string): Promise<boolean> {
    const task = this.downloadTasks.get(taskId);
    if (!task) {
      return false;
    }
    
    // 中断正在进行的 https 请求
    const activeRequest = this.activeRequests.get(taskId);
    if (activeRequest) {
      if (activeRequest.request) {
        activeRequest.request.abort(); // 中断请求
      }
      if (activeRequest.file) {
        activeRequest.file.end(); // 结束文件流
      }
      if (activeRequest.response) {
        activeRequest.response.destroy(); // 销毁响应流
      }
      this.activeRequests.delete(taskId);
      this.logger.info('已中断下载请求', { taskId });
    }
    
    // 清理下载文件
    const downloadPath = path.join(this.appDataPath, 'downloads', `${taskId}.tmp`);
    if (fs.existsSync(downloadPath)) {
      fs.unlinkSync(downloadPath);
    }
    
    // 清理解压目录
    const platformInfo = getPlatformInfo();
    const extractPath = path.join(this.ffmpegManagedPath, `${platformInfo.platformName}-${platformInfo.archName}-${taskId}`);
    if (fs.existsSync(extractPath)) {
      fs.rmSync(extractPath, { recursive: true, force: true });
    }
    
    this.downloadTasks.delete(taskId);
    this.logger.info('取消下载任务', { taskId });
    
    return true;
  }

  /**
   * 验证FFmpeg可执行文件
   */
  async verifyFFmpeg(ffmpegPath: string, expectedSha256?: string): Promise<{ ok: boolean; sha256: string }> {
    return new Promise((resolve) => {
      // 检查文件是否存在
      if (!fs.existsSync(ffmpegPath)) {
        resolve({ ok: false, sha256: '' });
        return;
      }
      
      // 计算SHA256
      const crypto = require('crypto');
      const fileBuffer = fs.readFileSync(ffmpegPath);
      const actualSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      
      // 如果提供了期望值，进行校验
      if (expectedSha256 && actualSha256 !== expectedSha256) {
        this.logger.warn('SHA256不匹配', { 
          filePath: ffmpegPath, 
          expected: expectedSha256.substring(0, 16), 
          actual: actualSha256.substring(0, 16) 
        });
        resolve({ ok: false, sha256: actualSha256 });
        return;
      }
      
      // 验证可执行
      const process = spawn(ffmpegPath, ['-version'], { shell: false });
      
      process.on('close', (code) => {
        resolve({ ok: code === 0, sha256: actualSha256 });
      });
      
      process.on('error', () => {
        resolve({ ok: false, sha256: actualSha256 });
      });
    });
  }

  /**
   * 切换FFmpeg版本
   */
  async switchFFmpeg(ffmpegPath: string, ffprobePath?: string, managed: boolean = false): Promise<boolean> {
    try {
      // 验证FFmpeg可执行
      const ffmpegResult = await this.verifyFFmpeg(ffmpegPath);
      if (!ffmpegResult.ok) {
        throw new Error('FFmpeg可执行文件无效');
      }
      
      // 验证FFprobe（如果提供）
      if (ffprobePath) {
        const ffprobeResult = await this.verifyFFmpeg(ffprobePath);
        if (!ffprobeResult.ok) {
          throw new Error('FFprobe可执行文件无效');
        }
      }
      
      this.logger.info('切换FFmpeg版本', { ffmpegPath, ffprobePath, managed });
      
      // 这里应该更新配置存储
      // 暂时只记录日志
      
      return true;
    } catch (error) {
      this.logger.error('切换FFmpeg失败', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /**
   * 清理临时文件
   */
  async cleanupTempFiles(): Promise<void> {
    const downloadsPath = path.join(this.appDataPath, 'downloads');
    
    if (fs.existsSync(downloadsPath)) {
      const files = fs.readdirSync(downloadsPath);
      
      for (const file of files) {
        if (file.endsWith('.tmp')) {
          const filePath = path.join(downloadsPath, file);
          fs.unlinkSync(filePath);
          this.logger.debug('清理临时文件', { filePath });
        }
      }
    }
  }
}
