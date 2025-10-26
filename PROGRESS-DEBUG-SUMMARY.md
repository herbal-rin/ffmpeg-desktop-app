# 进度和压缩速度问题调试总结

## 当前状态

### 1. ✅ 标题重复问题 - 已修复
- 移除了JobQueueTable内部重复的"任务队列"标题
- 移除了内部重复的开始和清空按钮
- UI现在只显示一个标题和一组合并的按钮

### 2. ⚠️ 进度条为0% - 正在调试
- 添加了详细的调试日志
- 需要查看实际FFmpeg输出
- 可能原因：
  - FFmpeg progress输出格式不匹配
  - 进度解析逻辑有问题
  - 进度事件没有正确传递到renderer

### 3. ⚠️ 压缩速度异常快 - 需要调查
从日志观察到：
- 11.2秒视频 → 1秒完成
- 45分钟视频 → 6.5秒完成

**可能的原因：**

#### 原因1: 输入文件已经被高度压缩
- 如果输入文件已经是libx264编码，FFmpeg可能会跳过大部分处理
- CRF 23对已压缩视频的处理速度会很快

#### 原因2: 使用了硬件加速
从终端日志可以看到：
```
hwaccels: [ 'videotoolbox' ],
encoders: [ 'h264_videotoolbox', 'hevc_videotoolbox' ]
```
macOS上有VideoToolbox硬件加速，这可能显著提高了编码速度。

#### 原因3: FFmpeg检测到无需重新编码
- 如果输入和输出的编码器、CRF值相似
- FFmpeg可能只做了容器格式转换（mkv → mp4）
- 音频使用了copy模式（`-c:a copy`）

#### 原因4: 源文件实际上是剪辑或片段
- 45分钟的"视频"可能只是音频文件或低分辨率片段
- 文件大小173.7MB，duration 2739秒（45分钟），帧率可能很低

## 添加的调试日志

在`app/services/ffmpeg/ffmpegService.ts`中添加了：
```typescript
this.logger.debug('FFmpeg progress line', { line });
this.logger.debug('FFmpeg progress parsed', { partial });
this.logger.debug('FFmpeg progress calculated', { progress, totalDurationMs });
```

这些日志将帮助诊断：
1. FFmpeg是否输出了progress行
2. progress行是否能被正确解析
3. 最终的progress计算结果

## 下一步

1. **查看日志输出**：
   - 启动应用并执行一个压缩任务
   - 查看终端日志中的"FFmpeg progress"相关输出
   - 确认是否有进度数据被解析

2. **验证压缩结果**：
   - 检查实际输出的文件大小
   - 验证输出视频的质量和时长
   - 确认是否真的完成了压缩

3. **可能的修复**：
   - 如果进度确实在更新但没有显示，检查UI更新逻辑
   - 如果FFmpeg没有输出progress，可能需要调整FFmpeg参数
   - 如果压缩速度确实异常，可能需要检查FFmpeg配置
