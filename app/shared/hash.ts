/**
 * 哈希工具函数
 */

import { createHash } from 'crypto';
import { createReadStream } from 'fs';

/**
 * 计算文件的SHA256哈希值
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    
    stream.on('data', (data) => {
      hash.update(data);
    });
    
    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });
    
    stream.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * 计算字符串的SHA256哈希值
 */
export function calculateStringHash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * 验证文件哈希值
 */
export async function verifyFileHash(filePath: string, expectedHash: string): Promise<boolean> {
  try {
    const actualHash = await calculateFileHash(filePath);
    return actualHash.toLowerCase() === expectedHash.toLowerCase();
  } catch (error) {
    return false;
  }
}

/**
 * 生成随机哈希（用于任务ID等）
 */
export function generateRandomHash(): string {
  return createHash('sha256')
    .update(Date.now().toString() + Math.random().toString())
    .digest('hex')
    .substring(0, 16);
}
