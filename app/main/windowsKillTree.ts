/**
 * Windows 进程树清理工具
 * 使用 taskkill /T /F 清理整个子进程树
 */

import { execFile } from 'child_process';
import { Logger } from '../shared/types';

/**
 * 清理 Windows 进程树
 */
export function killTreeWin(pid: number, logger?: Logger): Promise<void> {
  return new Promise((resolve, reject) => {
    logger?.debug('Windows 进程树清理', { pid });
    
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { 
      windowsHide: true 
    }, (error, stdout, stderr) => {
      if (error) {
        logger?.warn('Windows 进程树清理失败', { 
          pid, 
          error: error.message,
          stderr 
        });
        reject(error);
      } else {
        logger?.debug('Windows 进程树清理成功', { pid, stdout });
        resolve();
      }
    });
  });
}

/**
 * 检查是否为 Windows 平台
 */
export function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * 跨平台进程终止
 */
export async function killProcessTree(
  pid: number, 
  logger?: Logger,
  timeout: number = 3000
): Promise<void> {
  if (isWindows()) {
    try {
      await killTreeWin(pid, logger);
    } catch (error) {
      logger?.warn('Windows 进程树清理失败，尝试 SIGTERM', { pid });
      // 降级到 SIGTERM
      try {
        process.kill(pid, 'SIGTERM');
        await new Promise(resolve => setTimeout(resolve, timeout));
        process.kill(pid, 'SIGKILL');
      } catch (killError) {
        logger?.error('进程终止失败', { pid, error: killError });
        throw killError;
      }
    }
  } else {
    // Unix 系统
    try {
      process.kill(pid, 'SIGTERM');
      await new Promise(resolve => setTimeout(resolve, timeout));
      process.kill(pid, 'SIGKILL');
    } catch (error) {
      logger?.error('Unix 进程终止失败', { pid, error });
      throw error;
    }
  }
}
