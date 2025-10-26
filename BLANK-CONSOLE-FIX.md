# 空白 Console 问题诊断

## 🔍 问题分析

**Console 完全空白** = 页面没有加载，或者加载了错误的 URL

从终端日志看到：
```
(node:18039) electron: Failed to load URL: file:///Users/herbal/ffmpeg-app/dist/main/renderer/index.html with error: ERR_FILE_NOT_FOUND
```

这说明 Electron 尝试加载本地文件而不是 `http://localhost:5173`

## 💡 解决方案

需要查看**主进程控制台**（终端窗口中的 `[2]` 日志）

请在运行 `npm run dev` 的终端窗口中查看 **`[2]` 开头的行**（Electron 主进程日志）

你会看到类似：
```
[2] [调试信息] NODE_ENV=..., isDevelopment=...
[2] [开发模式] 加载 Vite 服务器: http://localhost:5173
```

或者错误：
```
[2] [窗口加载失败] ERR_CONNECTION_REFUSED
```

## 📋 当前状态

Electron 正在运行（PID: 56498），但是页面没有正确加载。

**请提供终端中的 `[2]` 日志内容！**

