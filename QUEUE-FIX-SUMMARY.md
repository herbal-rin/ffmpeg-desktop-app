# 队列管理修复总结

## Commit
**Commit**: `c265bdf`  
**分支**: `main`  
**时间**: 2025年1月27日

## 修复的问题

### 1. ✅ 文件上传后出现两个队列信息
**问题**: 文件被添加到列表两次，导致重复显示  
**原因**: 
- 在`isTransferring`状态时添加了一次（第110行）
- 然后在完成时又通过`newFiles`添加了一次（原代码第200行）

**修复**:
- 移除`newFiles`数组和最后的批量添加
- 文件立即添加到列表显示进度
- 完成后更新现有文件信息，不重复添加

```typescript
// 立即添加文件显示进度
setFiles(prev => [...prev, fileInfo]);

// 传输完成后更新现有文件信息
setFiles((prev) => {
  const updated = [...prev];
  const index = updated.findIndex(f => 
    f.file.name === file.name && f.file.size === file.size
  );
  if (index >= 0) {
    updated[index] = { 
      ...updated[index],
      probeResult,
      tempPath,
      isTransferring: false
    };
  }
  return updated;
});
```

### 2. ✅ 压缩失败：文件缺少临时路径
**问题**: 错误信息显示`文件缺少临时路径，跳过`  
**原因**: tempPath没有正确传递到最终的fileInfo中  
**修复**:
- 确保在文件探测完成后更新tempPath
- 使用正确的文件标识（fileName + fileSize）来更新信息

### 3. ✅ 两个重复的任务队列
**问题**: 有两个"任务队列"标题，且清空按钮功能不清楚  
**修复**:
- 添加两个独立的清空按钮：
  1. **文件列表清空按钮**（已选择文件区域）
     - 清除所有已选择的文件
     - 同时清理所有临时文件
  2. **任务队列清空按钮**（任务队列区域）
     - 清除所有压缩任务
     - 只影响压缩队列，不影响已选择的文件

**UI改进**:
```typescript
// 文件列表清空按钮
<button onClick={handleClearFiles}>清空</button>

// 任务队列清空按钮  
<button onClick={handleClearQueue}>清空队列</button>
```

## 新增功能

### 1. 文件列表清空功能
```typescript
const handleClearFiles = async () => {
  // 清理所有临时文件
  for (const fileInfo of files) {
    if (fileInfo.tempPath) {
      await window.api.invoke('file/cleanup-temp', {
        tempPath: fileInfo.tempPath
      });
    }
  }
  setFiles([]);
};
```

### 2. 压缩队列清空功能
```typescript
// 在useJobsStore中添加
clearQueue: async () => {
  await window.api.invoke('ffmpeg/queue/clear');
  set({
    jobs: [],
    currentJob: null,
    isProcessing: false,
    queueLength: 0,
  });
}

// 在main process中添加IPC处理
ipcMain.handle('ffmpeg/queue/clear', async (_event) => {
  if (!jobQueue) {
    throw new Error('任务队列未初始化');
  }
  jobQueue.clear();
  return { ok: true };
});
```

## 修改的文件

1. `app/renderer/pages/CompressPage.tsx`
   - 修复文件重复添加逻辑
   - 添加文件列表清空按钮
   - 优化tempPath传递

2. `app/main/ipc.ts`
   - 添加`ffmpeg/queue/clear` IPC处理器

3. `app/renderer/store/useJobsStore.ts`
   - 添加`clearQueue`方法
   - 添加`clearQueue`到接口定义

## 关键改进

### 文件标识优化
使用fileName + fileSize作为唯一标识，避免同名文件冲突：
```typescript
const index = updated.findIndex(f => 
  f.file.name === file.name && f.file.size === file.size
);
```

### 状态管理优化
- 文件立即添加到列表显示进度
- 使用setState更新现有文件，不重复添加
- 传输完成后更新所有必要信息（probeResult, tempPath等）

## 用户体验改进

1. **清晰的队列分离**:
   - 文件上传队列：选择文件并上传到临时目录
   - 压缩任务队列：压缩处理队列

2. **独立的清空操作**:
   - 清空文件：不影响已启动的压缩任务
   - 清空任务队列：可以保留已选择的文件

3. **更好的状态管理**:
   - 文件不会重复显示
   - tempPath正确传递，避免压缩失败

## 测试建议

1. **文件添加**:
   - 上传一个文件，应该只显示一次
   - 上传相同名称但不同大小的文件，应该都显示

2. **文件列表清空**:
   - 添加多个文件
   - 点击"清空"按钮
   - 文件列表应该被清空

3. **压缩队列清空**:
   - 添加文件并开始压缩
   - 点击"清空队列"按钮
   - 压缩任务应该被清空，但文件列表应该保留
