/**
 * 硬件加速黑名单管理器
 * 用于缓存失败的硬件加速器，避免重复尝试
 */
export class HardwareAccelBlacklist {
  private static instance: HardwareAccelBlacklist;
  private blacklist: Map<string, number> = new Map(); // codec -> timestamp
  private readonly BLACKLIST_DURATION = 5 * 60 * 1000; // 5分钟

  private constructor() {}

  static getInstance(): HardwareAccelBlacklist {
    if (!HardwareAccelBlacklist.instance) {
      HardwareAccelBlacklist.instance = new HardwareAccelBlacklist();
    }
    return HardwareAccelBlacklist.instance;
  }

  /**
   * 检查编码器是否在黑名单中
   */
  isBlacklisted(codec: string): boolean {
    const timestamp = this.blacklist.get(codec);
    if (!timestamp) return false;

    // 检查是否过期
    if (Date.now() - timestamp > this.BLACKLIST_DURATION) {
      this.blacklist.delete(codec);
      return false;
    }

    return true;
  }

  /**
   * 将编码器加入黑名单
   */
  addToBlacklist(codec: string): void {
    this.blacklist.set(codec, Date.now());
  }

  /**
   * 从黑名单中移除编码器
   */
  removeFromBlacklist(codec: string): void {
    this.blacklist.delete(codec);
  }

  /**
   * 清空黑名单
   */
  clear(): void {
    this.blacklist.clear();
  }

  /**
   * 获取黑名单状态
   */
  getBlacklistStatus(): Array<{ codec: string; timestamp: number; remainingMs: number }> {
    const now = Date.now();
    return Array.from(this.blacklist.entries()).map(([codec, timestamp]) => ({
      codec,
      timestamp,
      remainingMs: Math.max(0, this.BLACKLIST_DURATION - (now - timestamp))
    }));
  }

  /**
   * 清理过期的黑名单项
   */
  cleanupExpired(): void {
    const now = Date.now();
    for (const [codec, timestamp] of this.blacklist.entries()) {
      if (now - timestamp > this.BLACKLIST_DURATION) {
        this.blacklist.delete(codec);
      }
    }
  }
}
