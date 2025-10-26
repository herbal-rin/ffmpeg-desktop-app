# 🚨 关键Bug修复需求

## 📋 发现的问题

### 1. 队列为空问题 ✅ **已定位**
从代码分析，CompressPage 中：
- `handleStartCompression` 调用 `addJob(options)` - ✅ 正确
- `addJob` 应该在 JobQueue 中创建任务 - ✅ 正确
- 但队列显示为空 - ❌ **问题**

**可能原因：**
1. `startQueue()` 返回太快，任务还没加入队列
2. JobQueue 的 `enqueue` 方法有问题
3. 前端状态未正确更新

### 2. 输出文件名问题
**当前逻辑：**
```typescript
private getOutputPath(opts: any): string {
  const inputName = path.basename(opts.input, path.extname(opts.input));
  const outputName = opts.outputName || inputName;
  const extension = opts.container === 'mp4' ? '.mp4' : '.mkv';
  return path.join(opts.outputDir, `${outputName}${extension}`);
}
```

**问题：**
- 没有提供 `outputName`，所以使用输入文件名
- 无法自定义输出文件名

**建议修改：**
- 添加 `{inputName}_X264.mp4` 或 `{inputName}_X265.mkv` 后缀
- 或提供 UI 让用户自定义

---

## 🔧 需要修复

### 1. 先修复队列为空问题

查看 JobQueue 的 `enqueue` 和 `start` 方法，确保：
- `enqueue` 正确添加任务到队列
- `start` 实际开始处理

### 2. 然后添加输出文件名

修改 `FfmpegService.getOutputPath`，添加 X264/X265 后缀。

---

## 📋 待办事项

- [ ] 检查 JobQueue.enqueue 实现
- [ ] 检查 JobQueue.start 实现  
- [ ] 添加输出文件名后缀
- [ ] 测试队列是否正常工作

