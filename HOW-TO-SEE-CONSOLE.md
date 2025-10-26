# 🖥️ 如何查看 Electron 的错误信息

## 方法 1：在 DevTools Console 中查看

1. **点击 DevTools 右侧的 "Console" 标签页**
2. 你会看到类似这样的输出：

```
[开发模式] 加载 Vite 服务器: http://localhost:5173
```

或者错误信息：

```
[窗口加载失败] -105 ...
```

---

## 方法 2：在终端中查看主进程日志

在运行 `npm run dev` 的终端窗口中，你会看到类似这样的日志：

```bash
[2] [调试信息] NODE_ENV=development, isDevelopment=true
[2] [开发模式] 加载 Vite 服务器: http://localhost:5173
```

或者错误：

```bash
[2] Failed to load http://localhost:5173
```

---

## 方法 3：测试 Vite 服务器

打开浏览器（不是 Electron），访问：

```
http://localhost:5173
```

如果你在浏览器中看到应用界面，但 Electron 中看不到，那问题就在于 Electron 的加载。

---

## ⚡ 现在立即测试

请在你的终端中输入：

```bash
curl http://localhost:5173
```

然后告诉我输出结果。

