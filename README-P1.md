# FFmpeg 视频压缩应用 - P1 Electron 主进程集成

这是 P1 阶段的实现，完成了 Electron 主进程集成和压缩核心页面的开发。

## 🎯 P1 功能特性

### ✅ 已实现功能

- **Electron 主进程集成**: 完整的 Electron 应用架构
- **安全 IPC 通信**: 渲染进程与主进程的安全通信
- **压缩核心页面**: 完整的视频压缩用户界面
- **文件拖拽上传**: 支持拖拽和点击选择视频文件
- **编码器选择**: 自动/手动选择软硬件编码器
- **预设配置**: 三套预设 + 自定义参数
- **音频处理**: 复制/重编码音频流
- **字幕支持**: 软封装/硬烧录字幕
- **任务队列**: 实时进度、状态管理、操作控制
- **平台兼容**: Windows 暂停限制处理
- **国际化支持**: 中英文界面
- **主题支持**: 浅色/深色主题

### 🔧 技术栈

- **Electron 30+**: 桌面应用框架
- **React 18**: 用户界面库
- **TypeScript**: 类型安全开发
- **Vite**: 构建工具和开发服务器
- **Tailwind CSS**: 样式框架
- **Zustand**: 状态管理
- **Pino**: 日志系统

## 📁 项目结构

```
/app
  /main                    # Electron 主进程
    main.ts               # 主进程入口
    ipc.ts                # IPC 通信处理
    preload.ts            # 预加载脚本
  /renderer               # React 渲染进程
    index.html            # HTML 入口
    main.tsx              # React 入口
    App.tsx               # 主应用组件
    index.css             # 全局样式
    pages/
      CompressPage.tsx    # 压缩核心页面
    components/           # UI 组件
      FileDropZone.tsx    # 文件拖拽组件
      JobQueueTable.tsx   # 任务队列表格
      PresetPicker.tsx    # 预设选择器
      CodecSelector.tsx   # 编码器选择器
      AudioOptions.tsx    # 音频选项
      Toast.tsx           # 消息提示
    store/                # 状态管理
      useJobsStore.ts     # 任务状态
      useSettingsStore.ts # 设置状态
    i18n/                 # 国际化
      zh.json            # 中文语言包
      en.json            # 英文语言包
      index.ts           # 国际化工具
  /services               # P0 后端服务
    ffmpeg/              # FFmpeg 相关服务
    queue/               # 任务队列
    config.ts            # 配置管理
    logger.ts            # 日志服务
  /shared                # 共享类型
    types.ts             # TypeScript 类型
  /types                 # 类型定义
    preload.d.ts         # Preload API 类型
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式

```bash
# 启动开发服务器（主进程 + 渲染进程）
npm run dev

# 或者分别启动
npm run dev:main      # 主进程开发
npm run dev:renderer  # 渲染进程开发
```

### 3. 构建应用

```bash
# 构建所有代码
npm run build

# 分别构建
npm run build:main      # 构建主进程
npm run build:renderer  # 构建渲染进程
```

### 4. 运行应用

```bash
# 开发模式运行
npm run electron:dev

# 生产模式运行
npm run electron
```

### 5. 代码检查

```bash
npm run lint        # ESLint 检查
npm run typecheck   # TypeScript 类型检查
npm test           # 运行测试
```

## 📖 IPC 通信 API

### 主进程 → 渲染进程 (invoke)

| 通道 | 请求 | 响应 | 描述 |
|------|------|------|------|
| `ffmpeg/probe` | `{ input: string }` | `ProbeResult` | 探测视频信息 |
| `ffmpeg/queue/enqueue` | `TranscodeOptions` | `{ jobId: string }` | 添加任务到队列 |
| `ffmpeg/queue/start` | `{}` | `{ started: boolean }` | 开始处理队列 |
| `ffmpeg/queue/cancel` | `{ jobId: string }` | `{ ok: true }` | 取消任务 |
| `ffmpeg/queue/pause` | `{ jobId: string }` | `{ ok: true }` | 暂停任务 |
| `ffmpeg/queue/resume` | `{ jobId: string }` | `{ ok: true }` | 恢复任务 |
| `settings/get` | `{}` | `SettingsResponse` | 获取设置 |
| `settings/set` | `SettingsRequest` | `{ ok: true }` | 更新设置 |
| `gpu/detect` | `{}` | `{ hwaccels: string[], encoders: string[] }` | 检测硬件加速 |
| `dialog/select-videos` | `{}` | `DialogResponse` | 选择视频文件 |
| `dialog/select-output-dir` | `{}` | `DialogResponse` | 选择输出目录 |
| `dialog/select-subtitle` | `{}` | `DialogResponse` | 选择字幕文件 |
| `shell/open-path` | `{ path: string }` | `{ ok: true }` | 打开文件目录 |

### 主进程 → 渲染进程 (events)

| 通道 | 载荷 | 描述 |
|------|------|------|
| `queue/events` | `{ type, job?, progress?, error? }` | 队列事件通知 |

## 🎛️ 用户界面功能

### 文件选择
- **拖拽上传**: 支持拖拽视频文件到指定区域
- **点击选择**: 点击选择文件按钮打开文件对话框
- **多文件支持**: 支持同时选择多个视频文件
- **格式验证**: 自动过滤非视频文件

### 编码器选择
- **自动选择**: 智能选择最佳编码器（硬件优先）
- **手动选择**: 手动选择特定编码器
- **硬件检测**: 自动检测可用的硬件加速器
- **回退机制**: 硬件不可用时自动回退到软件编码

### 预设配置
- **高质量慢速**: 最高质量，压缩速度较慢
- **平衡**: 质量与速度平衡
- **快速小文件**: 快速压缩，文件较小
- **自定义**: 自定义 CRF、预设、码率等参数

### 音频处理
- **复制音频流**: 不重新编码，速度更快
- **重编码**: 支持 AAC、Opus、MP3 编码
- **码率选择**: 32k-320k 码率选择

### 字幕支持
- **无字幕**: 不处理字幕
- **软封装**: 将字幕文件封装到视频容器中
- **硬烧录**: 将字幕烧录到视频画面中

### 任务队列
- **实时进度**: 显示压缩进度、速度、ETA
- **状态管理**: 排队、运行、暂停、完成、失败状态
- **操作控制**: 取消、暂停、恢复、移除任务
- **平台适配**: Windows 暂停按钮灰显

## 🖥️ 平台差异

### Windows
- **暂停功能**: 不支持暂停/恢复，按钮灰显
- **错误提示**: 调用暂停时抛出 `ERR_PAUSE_UNSUPPORTED_WINDOWS`
- **路径处理**: 使用 Windows 路径分隔符

### macOS/Linux
- **暂停功能**: 支持暂停/恢复操作
- **信号处理**: 使用 SIGSTOP/SIGCONT 信号
- **路径处理**: 使用 Unix 路径分隔符

## 🌐 国际化支持

### 支持语言
- **中文 (zh-CN)**: 简体中文界面
- **英文 (en-US)**: 英文界面

### 语言切换
- 设置页面选择语言
- 实时切换，无需重启
- 所有界面元素支持国际化

## 🎨 主题支持

### 主题模式
- **浅色主题**: 默认浅色界面
- **深色主题**: 深色界面，适合夜间使用

### 主题切换
- 设置页面选择主题
- 实时切换，无需重启
- 自动保存用户偏好

## 🔒 安全特性

### 进程隔离
- **contextIsolation**: 启用上下文隔离
- **nodeIntegration**: 禁用 Node.js 集成
- **sandbox**: 启用沙箱模式

### IPC 安全
- **参数验证**: 所有 IPC 参数都经过验证
- **路径规范化**: 输入输出路径统一规范化
- **错误处理**: 完整的错误处理和用户提示

## 🧪 开发工具

### 开发服务器
- **热重载**: 代码修改后自动重载
- **调试工具**: 集成开发者工具
- **错误提示**: 详细的错误信息和堆栈

### 代码质量
- **ESLint**: 代码风格检查
- **TypeScript**: 类型安全检查
- **Prettier**: 代码格式化（可选）

## 📝 使用示例

### 基本使用流程

1. **启动应用**
   ```bash
   npm run dev
   ```

2. **选择视频文件**
   - 拖拽文件到上传区域
   - 或点击选择文件按钮

3. **配置压缩参数**
   - 选择编码器（自动/手动）
   - 选择预设（高质量/平衡/快速/自定义）
   - 配置音频处理
   - 选择字幕处理方式

4. **设置输出目录**
   - 选择输出文件夹
   - 确认输出格式

5. **开始压缩**
   - 点击"开始压缩"按钮
   - 观察任务队列进度

6. **管理任务**
   - 查看实时进度
   - 暂停/恢复任务（非 Windows）
   - 取消不需要的任务
   - 打开输出文件夹

### 高级配置

```typescript
// 自定义预设配置
const customPreset = {
  crf: 20,           // 质量因子
  preset: 'slow',    // 编码预设
  maxrate: '2000k',  // 最大码率
  bufsize: '4000k',  // 缓冲区大小
  bframes: 3,        // B帧数量
  lookahead: 50      // 前瞻帧数
};

// 音频重编码配置
const audioConfig = {
  mode: 'encode',
  codec: 'aac',
  bitrateK: 128
};
```

## ⚠️ 注意事项

### 系统要求
- **Node.js**: 18.0.0 或更高版本
- **FFmpeg**: 需要安装 FFmpeg 和 FFprobe
- **操作系统**: Windows 10+, macOS 10.14+, Ubuntu 18.04+

### 性能建议
- **硬件加速**: 优先使用硬件编码器
- **并发限制**: 避免同时运行过多任务
- **磁盘空间**: 确保有足够的输出空间

### 故障排除
- **FFmpeg 未找到**: 检查 FFmpeg 安装和路径配置
- **权限错误**: 确保有文件读写权限
- **编码失败**: 检查输入文件格式和编码器支持

## 🔮 下一步计划

- [ ] P2: 小工具页面（视频裁剪、GIF 制作、音频提取）
- [ ] P3: 全局设置页面和 FFmpeg 自动下载
- [ ] P4: 视频预览和实时预览功能
- [ ] P5: 批量处理和模板功能

---

**P1 阶段开发完成！** 现在您有了一个功能完整的 Electron 视频压缩应用，支持完整的端到端压缩流程。
