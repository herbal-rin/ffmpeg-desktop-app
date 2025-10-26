# 🚀 重启指南

## ✅ 问题已修复

已定位并修复了根本问题：

### 问题原因
`setupToolsIPC()` 抛出异常被 `catch` 捕获，导致后面的 `SettingsIPC` 初始化代码未执行。

### 解决方案
将 `SettingsIPC` 初始化移出 `try-catch`，确保即使 FFmpeg 未配置也能注册。

---

## 📋 重启步骤

### 1. 重新启动应用

```bash
cd /Users/herbal/ffmpeg-app
npm run dev
```

### 2. 查看终端日志

应该看到：
```
[2] [INFO] 开始创建 SettingsIPC 实例...
[2] [INFO] SettingsIPC 实例创建成功
[2] [INFO] 设置IPC已初始化
[2] [INFO] 工具 IPC 已设置
```

### 3. 测试功能

1. 打开应用
2. 进入"设置"页面
3. 尝试"自动检测 FFmpeg"
4. 或手动选择 FFmpeg 路径

---

## ⚠️ 如果还有问题

请提供终端中的完整 `[2]` 日志，特别是：
- 是否看到 "开始创建 SettingsIPC 实例..."
- 是否有 "SettingsIPC 创建失败" 错误
- 完整的错误堆栈

