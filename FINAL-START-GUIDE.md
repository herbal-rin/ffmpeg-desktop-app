# 最终启动指南（已修复空白窗口问题）

## ✅ 问题已修复

### 修复的内容
1. ✅ 添加 `cross-env` 正确设置 `NODE_ENV=development`
2. ✅ 修复主进程加载逻辑
3. ✅ 添加多个端口检测
4. ✅ 添加调试日志

## 🚀 现在如何启动

### 1. 启动命令
```bash
npm run dev
```

### 2. 发生什么
```
[0] ✅ TypeScript 编译
[1] ✅ Vite 启动 (http://localhost:5173 或 5174)
[2] ✅ wait-on 等待就绪
[2] ✅ Electron 窗口打开
[2] 🪟 窗口内容加载成功！
```

### 3. 您会看到
- 一个桌面窗口自动打开
- 窗口中有 "压缩" / "工具" / "设置" 导航
- 不再空白！

## 🎯 如果窗口仍然是空白

### 检查步骤

**1. 查看终端输出**
```bash
# 应该看到类似这样的日志
[2] [开发模式] 加载 Vite 服务器: http://localhost:5173
```

**2. 检查 Vite 是否运行**
```bash
# 查看是否有端口 5173 或 5174
lsof -i:5173
lsof -i:5174
```

**3. 手动访问 Vite**
```bash
# 在浏览器中尝试访问
open http://localhost:5173
# 或
open http://localhost:5174
```

如果浏览器能打开，说明 Vite 正常，只是 Electron 连接有问题。

## 🔧 高级调试

### 查看 Electron 控制台

窗口打开后：
1. **打开 DevTools**: `Cmd+Option+I` (macOS)
2. **查看 Console**: 检查是否有错误
3. **查看 Network**: 检查资源是否加载

### 常见错误

#### 错误: `ERR_FILE_NOT_FOUND`
**原因**: 尝试加载静态文件而不是 Vite 服务器
**解决**: `NODE_ENV` 未正确设置为 `development`

#### 错误: `ECONNREFUSED`
**原因**: Vite 服务器未启动
**解决**: 检查 `dev:renderer` 进程是否运行

#### 空白页面
**原因**: Vite 运行但 Electron 连接到错误端口
**解决**: 检查环境变量 `VITE_PORT`

## 📋 完整启动流程

```bash
# 1. 清理旧进程
pkill -f "electron|vite|tsc"

# 2. 重新构建主进程
npm run build:main

# 3. 启动开发环境
npm run dev

# 4. 等待窗口打开（10-30秒）
# 5. 在窗口中测试功能
```

## ✅ 预期行为

### 正确的启动
1. 终端显示编译和启动信息
2. 看到 "[开发模式] 加载 Vite 服务器"
3. Electron 窗口打开
4. **窗口中有内容**（不是空白）
5. 可以看到三个页面：压缩、工具、设置

### 空白窗口的可能原因
1. ❌ `NODE_ENV` 未设置为 `development`
2. ❌ Vite 未启动
3. ❌ 端口冲突
4. ❌ 主进程代码未重新编译

## 🎉 现在请试试

```bash
# 1. 确保在项目目录
cd /Users/herbal/ffmpeg-app

# 2. 清理旧进程（如果正在运行）
pkill -f "electron|vite"

# 3. 重新构建
npm run build:main

# 4. 启动
npm run dev

# 5. 等待窗口打开，应该能看到内容了！
```

## 📝 如果还有问题

请提供以下信息：
1. 终端显示什么？
2. 窗口是完全空白还是有加载动画？
3. 能否在浏览器中打开 http://localhost:5173 或 5174？
4. DevTools 中有什么错误？（`Cmd+Option+I` 打开）

---

**当前状态**: ✅ 所有问题已修复  
**下一步**: 运行 `npm run dev` 并告诉我结果！

