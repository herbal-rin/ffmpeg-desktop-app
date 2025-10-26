# 压缩问题调试指南

## 当前问题

1. ✅ **进度条显示0%** - 已修复（累积progress状态）
2. ⚠️ **FFmpeg只处理了5%的视频** - 需要stderr日志诊断
   - 输入：2739秒（约45分钟）
   - 输出：138秒（约2.3分钟）
   - ratio：0.05（5%）

## 已添加的修复

### 1. 进度计算修复
```typescript
// 累积progress状态
let currentProgress: Partial<Progress> = {};

// 每次更新累积状态
if (partial.timeMs !== undefined) currentProgress.timeMs = partial.timeMs;
if (partial.speed !== undefined) currentProgress.speed = partial.speed;
if (partial.bitrate !== undefined) currentProgress.bitrate = partial.bitrate;

// 用完整状态计算ratio
const progress = ProgressParser.calculateProgress(currentProgress, totalDurationMs);
```

### 2. 输出验证和错误报告
```typescript
// 如果输出时长少于输入的80%，抛出错误
if (ratio < 0.8) {
  const error = new Error(`压缩失败：输出视频时长异常短`);
  error.name = 'COMPRESSION_FAILED';
  throw error;
}
```

### 3. 详细的stderr日志
```typescript
process.stderr?.on('data', (data: Buffer) => {
  this.logger.info('FFmpeg stderr output', { 
    preview: stderr.slice(0, 500) 
  });
});
```

## 下一步调试

请在新的测试中查看终端日志，特别是：

1. **"FFmpeg stderr output"** - 查看FFmpeg的错误信息
2. **"FFmpeg stderr ended"** - 查看完整的stderr输出
3. **任务的错误信息** - 如果输出太短，会显示具体错误

这将帮助我们确定FFmpeg为什么只处理了5%的视频。

## 可能的原因

1. **输入文件问题**：
   - 输入文件可能本身就只有部分内容
   - 文件可能有损毁或编码问题

2. **FFmpeg参数问题**：
   - CRF设置可能导致某种优化
   - 需要添加更多参数确保完整处理

3. **资源限制**：
   - 磁盘空间不足
   - 内存不足
   - 线程限制

4. **硬件加速问题**：
   - VideoToolbox可能有问题
   - 需要禁用硬件加速测试
