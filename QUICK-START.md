# 快速启动指南

## 🚀 最简单的启动方式

### 方式 1: 使用启动脚本（推荐）
```bash
./dev.sh
```

### 方式 2: 使用 npm 命令
```bash
npm run dev
```

### 方式 3: 分步启动（如果上面不行）

#### 终端 1: TypeScript 编译
```bash
npm run dev:main
```

#### 终端 2: Vite 开发服务器
```bash
npm run dev:renderer
```

#### 终端 3: Electron
```bash
# 等待 Vite 启动后运行
NODE_ENV=development electron .
```

## ⏱️ 启动时间

- TypeScript 编译: 1-2 秒
- Vite 启动: 1-2 秒  
- Electron 启动: 2-5 秒
- **总计**: 约 5-10 秒

## ✅ 成功标志

您应该看到：
1. 终端显示编译成功
2. Vite 显示 "ready in XXX ms"
3. **一个 Electron 窗口自动打开**
4. 窗口中有 "压缩" / "工具" / "设置" 导航

## 🐛 如果窗口没打开

### 检查点 1: 进程是否运行
```bash
ps aux | grep electron
```

应该看到 `Electron` 进程。

### 检查点 2: Vite 是否运行
```bash
curl http://localhost:5173
```

应该能访问。

### 检查点 3: 查看终端输出
寻找这些关键词：
- "VITE ready"
- "Electron"
- 任何错误信息

## 📝 常见问题

### Q: 窗口打开了但是空白？
```bash
# 打开 DevTools (Cmd+Option+I)
# 查看 Console 标签页有什么错误
```

### Q: Electron 进程启动了但没有窗口？
- 窗口可能在其他显示器
- 检查 Dock 栏
- 尝试重启：`pkill -f electron && npm run dev`

### Q: 端口被占用？
```bash
# 已自动切换，不需要担心
```

## 🎯 推荐做法

1. **第一次启动**
   ```bash
   npm run build:main  # 先编译
   npm run dev         # 再启动
   ```

2. **后续启动**
   ```bash
   npm run dev
   ```

3. **如果出问题**
   ```bash
   pkill -f "electron|vite"
   npm run build:main
   npm run dev
   ```

---

**提示**: 最简单就是运行 `./dev.sh`，然后等待窗口打开！

