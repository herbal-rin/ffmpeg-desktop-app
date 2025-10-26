# 直接运行指南（最简单）

## 🎯 最简单的启动方式

由于 wait-on 可能有问题，这里是手动启动的方法：

### 终端 1: 启动编译和 Vite
```bash
cd /Users/herbal/ffmpeg-app
npm run dev
```
这会启动 TypeScript 编译和 Vite 服务器。

### 等待 5-10 秒后，在终端 2 运行：
```bash
cd /Users/herbal/ffmpeg-app
NODE_ENV=development electron .
```

## 🪟 窗口应该会自动打开

这就是最简单直接的方式！

## 📝 完整的启动命令

```bash
# 终端 1
npm run dev

# 等待看到 "VITE ready at http://localhost:5173" 后

# 终端 2  
NODE_ENV=development electron .
```

---

**这应该能立即打开窗口！** 🎉

