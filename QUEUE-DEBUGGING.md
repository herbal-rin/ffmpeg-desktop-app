# 🔍 队列调试指南

## 问题：点击"开始压缩"后队列为空

### 📋 需要的信息

请重启应用后，提供：

1. **终端日志**（`npm run dev` 输出）
   - 查找 `[2]` 开头的行
   - 特别是 "任务已加入队列" 或相关错误

2. **Console 错误**
   - 是否有 "启动队列失败" 错误
   - 是否有其他 IPC 相关错误

3. **Network 请求**
   - DevTools > Network
   - 查找对 `ffmpeg/queue/start` 的请求

---

## 🔧 启动命令

```bash
cd /Users/herbal/ffmpeg-app
npm run dev
```

---

## 📝 待检查的代码

### 1. JobQueue.enqueue
位置: `app/services/queue/jobQueue.ts:49-70`

问题：任务是否真的加入了队列？

### 2. useJobsStore.addJob
位置: `app/renderer/store/useJobsStore.ts`

问题：前端是否正确调用了 IPC？

### 3. ipc.ts ffmpeg/queue/enqueue
位置: `app/main/ipc.ts`

问题：IPC 处理器是否正确创建任务？

---

请提供上述信息，我才能准确定位问题！

