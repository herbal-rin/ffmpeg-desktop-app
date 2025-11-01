# 快速开始指南

## 前置要求

1. **安装 Node.js**（>= 18.0.0）
   - 访问 [nodejs.org](https://nodejs.org/) 下载安装

2. **安装 FFmpeg**

   ### macOS
   ```bash
   brew install ffmpeg
   ```

   ### Windows
   下载地址：https://www.gyan.dev/ffmpeg/builds/
   - 下载 `ffmpeg-release-essentials.zip`
   - 解压到 `C:\ffmpeg`
   - 添加 `C:\ffmpeg\bin` 到系统环境变量 PATH

   ### Linux (Ubuntu/Debian)
   ```bash
   sudo apt update && sudo apt install ffmpeg
   ```

## 启动步骤

### 1. 安装依赖
```bash
npm install
```

### 2. 启动应用
```bash
npm run dev
```

应用会在 5-10 秒后自动启动。

### 3. 开始使用

#### 视频压缩
1. 点击"添加文件"或拖拽视频到窗口
2. 选择输出目录
3. 选择编码器和预设
4. 点击"开始压缩"

#### 视频剪辑
1. 切换到"小工具"页面
2. 选择视频文件
3. 拖动时间轴选择片段
4. 点击"生成预览"查看效果
5. 点击"导出文件"保存

#### 设置默认输出目录
1. 切换到"设置"页面
2. 点击"选择目录"设置默认输出路径
3. 设置会自动保存

## 常见问题

**应用启动后窗口空白？**
- 等待 10 秒，Vite 需要编译时间
- 检查终端是否有错误信息

**提示 FFmpeg 未找到？**
- 确认已安装 FFmpeg
- 运行 `ffmpeg -version` 验证
- Windows 用户检查 PATH 环境变量

**硬件加速不可用？**
- 检查 GPU 驱动是否最新
- 部分老旧 GPU 不支持硬件加速
- 可在设置中关闭硬件加速

## 更多帮助

查看完整文档：[README.md](./README.md)

