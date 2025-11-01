# FFmpeg 视频工具

一款功能强大的跨平台桌面视频处理应用，基于 Electron + React + TypeScript + FFmpeg 构建。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)

## 📋 功能特性

### 🎬 视频压缩
- **多编码器支持**：H.264、H.265、VP9、AV1
- **硬件加速**：自动检测并利用 GPU 硬件加速（VideoToolbox、NVENC、QSV、AMF）
- **智能预设**：提供平衡、高质量、快速等多种预设
- **批量处理**：支持多文件队列批量压缩
- **自定义输出**：自定义文件名、输出目录、容器格式
- **音频处理**：音频直接复制或重新编码
- **字幕支持**：软字幕嵌入或硬字幕烧录

### ✂️ 视频剪辑
- **精确剪辑**：支持毫秒级时间精度
- **实时预览**：剪辑前可预览效果（含音频）
- **双模式**：
  - **无损快剪**：不重新编码，速度极快
  - **精准剪辑**：重新编码，精确到帧
- **智能回退**：无损剪辑失败自动切换精准模式

### 🎞️ GIF 制作
- **视频转 GIF**：从视频片段生成动图
- **参数调节**：可调节帧率、尺寸、抖动算法
- **高质量**：使用调色板优化，色彩还原度高

### 🎵 音频提取
- **多格式支持**：M4A、MP3、AAC、FLAC、Opus
- **音频直接复制**：无损提取原始音频
- **重新编码**：可选择编码器和码率

### ⚙️ 设置管理
- **默认输出目录**：配置全局默认输出路径
- **主题切换**：浅色/深色/跟随系统
- **语言支持**：中文/英文
- **FFmpeg 管理**：自定义 FFmpeg 路径
- **硬件加速**：开启/关闭硬件加速

## 🖥️ 系统要求

- **Node.js**：>= 18.0.0
- **FFmpeg**：需要系统已安装 FFmpeg 和 FFprobe
- **操作系统**：
  - macOS 10.13+
  - Windows 10+
  - Linux（主流发行版）

## 🚀 快速开始

### 1. 安装 FFmpeg

#### macOS
```bash
# 使用 Homebrew
brew install ffmpeg
```

#### Windows
```bash
# 使用 Chocolatey
choco install ffmpeg

# 或者使用 Scoop
scoop install ffmpeg

# 或手动下载
# 访问 https://www.gyan.dev/ffmpeg/builds/
# 下载 ffmpeg-release-essentials.zip
# 解压并添加到系统 PATH
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install ffmpeg

# Fedora
sudo dnf install ffmpeg

# Arch Linux
sudo pacman -S ffmpeg
```

### 2. 克隆项目
```bash
git clone <repository-url>
cd ffmpeg-app
```

### 3. 安装依赖
```bash
npm install
```

### 4. 启动开发模式

#### macOS / Linux
```bash
npm run dev
```

#### Windows
```bash
npm run dev
```

应用将在几秒钟后自动启动。如果没有自动启动，请稍等片刻，Electron 需要时间编译和启动。

### 5. 构建生产版本

#### 构建当前平台
```bash
npm run build
```

#### 构建 macOS 应用
```bash
npm run build:mac
```

#### 构建 Windows 应用
```bash
npm run build:win
```

#### 构建 Linux 应用
```bash
npm run build:linux
```

#### 构建所有平台
```bash
npm run build:all
```

## 📁 项目结构

```
ffmpeg-app/
├── app/
│   ├── main/                    # Electron 主进程
│   │   ├── main.ts             # 主进程入口
│   │   ├── preload.ts          # 预加载脚本
│   │   ├── ipc.ts              # IPC 通信（压缩）
│   │   ├── ipc.tools.ts        # IPC 通信（工具）
│   │   ├── ipc.settings.ts     # IPC 通信（设置）
│   │   ├── ffmpegManager.ts    # FFmpeg 管理
│   │   ├── gpuDetect.ts        # GPU 检测
│   │   └── previewService.ts   # 预览服务
│   ├── renderer/                # React 渲染进程
│   │   ├── pages/              # 页面组件
│   │   │   ├── CompressPage.tsx
│   │   │   ├── ToolsPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── components/         # UI 组件
│   │   ├── store/              # Zustand 状态管理
│   │   ├── hooks/              # 自定义 Hooks
│   │   ├── i18n/               # 国际化
│   │   └── App.tsx             # 应用入口
│   ├── services/                # 业务逻辑
│   │   ├── ffmpeg/             # FFmpeg 服务
│   │   ├── queue/              # 队列管理
│   │   ├── config.ts           # 配置管理
│   │   └── logger.ts           # 日志服务
│   ├── shared/                  # 共享工具
│   └── types/                   # 类型定义
├── tests/                       # 单元测试
├── dist/                        # 构建输出
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 🛠️ 技术栈

- **框架**: Electron 30
- **UI**: React 18 + TypeScript
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **构建工具**: Vite
- **测试**: Vitest
- **日志**: Pino
- **视频处理**: FFmpeg
- **持久化**: electron-store

## 📊 当前进展

### ✅ 已完成功能

1. **视频压缩模块**
   - ✅ 多编码器支持
   - ✅ 硬件加速检测与使用
   - ✅ 批量队列处理
   - ✅ 实时进度显示
   - ✅ 错误处理与重试
   - ✅ 自定义输出文件名

2. **视频剪辑工具**
   - ✅ 时间范围选择（拖拽 + 输入）
   - ✅ 无损/精准双模式
   - ✅ 实时预览（含音频）
   - ✅ 智能回退机制
   - ✅ 双视频对比预览

3. **GIF 制作工具**
   - ✅ 视频转 GIF
   - ✅ 参数调节
   - ✅ 预览功能

4. **音频提取工具**
   - ✅ 多格式支持
   - ✅ 无损/编码模式
   - ✅ 码率调节

5. **设置管理**
   - ✅ 默认输出目录
   - ✅ 主题切换
   - ✅ 语言切换
   - ✅ FFmpeg 路径管理
   - ✅ 硬件加速开关

6. **用户体验**
   - ✅ 页面间导航
   - ✅ Toast 通知系统
   - ✅ 文件拖拽上传
   - ✅ 上传进度显示
   - ✅ 清空队列
   - ✅ 本地存储记忆
   - ✅ 一键设为默认

### 🚧 待优化

- [ ] 打包优化（减小体积）
- [ ] 错误日志导出
- [ ] 更多语言支持
- [ ] 批量预设模板
- [ ] 视频合并功能
- [ ] 更多滤镜效果

## 🐛 调试

### 开启开发者工具

开发模式下会自动打开 Chrome DevTools。如需手动打开：

- **macOS**: `Cmd + Option + I`
- **Windows/Linux**: `Ctrl + Shift + I`

### 查看日志

日志文件位置：
- **macOS**: `~/Library/Logs/ffmpeg-video-compressor/`
- **Windows**: `%USERPROFILE%\AppData\Roaming\ffmpeg-video-compressor\logs\`
- **Linux**: `~/.config/ffmpeg-video-compressor/logs/`

### 常见问题

**Q: FFmpeg 未找到？**

A: 确保 FFmpeg 已正确安装并添加到系统 PATH。可以在终端运行 `ffmpeg -version` 验证。

**Q: 硬件加速不工作？**

A: 检查 GPU 驱动是否安装，可以在设置页查看硬件加速状态。部分老旧 GPU 可能不支持。

**Q: 应用启动后窗口空白？**

A: 等待几秒钟，Vite 需要时间编译。如果长时间空白，检查终端是否有错误信息。

**Q: Windows 下无法构建？**

A: 确保安装了 Windows Build Tools：
```bash
npm install --global windows-build-tools
```

## 📝 开发说明

### 运行测试
```bash
npm test                # 运行所有测试
npm run test:watch      # 监听模式
npm run test:coverage   # 生成覆盖率报告
```

### 代码检查
```bash
npm run lint           # ESLint 检查
npm run typecheck      # TypeScript 类型检查
```

### 清理构建
```bash
npm run clean          # 清理 dist 目录
```

## 📄 许可证

MIT License

## 🙏 致谢

- [FFmpeg](https://ffmpeg.org/) - 强大的多媒体处理框架
- [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架
- [React](https://react.dev/) - UI 框架
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架

---

**提示**：如果觉得这个项目有帮助，欢迎 ⭐ Star！

