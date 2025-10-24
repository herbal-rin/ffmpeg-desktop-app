# P2 阶段：小工具页面开发

## 概述

P2 阶段实现了小工具页面，包括视频快速裁剪、GIF 制作、音频提取三大功能，并提供了双窗口预览功能。

## 新增功能

### 1. 视频裁剪
- **无损快剪**：直接复制视频流，速度最快
- **精准剪**：重新编码，精确到帧
- 支持 MP4/MKV 格式
- 支持多种视频编码器（H.264/H.265，硬件加速）
- 音频复制或重编码选项

### 2. GIF 制作
- 两步法生成（调色板 + 应用）
- 可调节帧率（1-30 FPS）
- 可调节最大宽度（128-2048px）
- 支持 Bayer 和 Floyd-Steinberg 抖动算法
- 文件大小预估

### 3. 音频提取
- 直接复制模式（无损）
- 重新编码模式（可压缩）
- 支持多种格式：AAC、MP3、FLAC、Opus
- 可调节码率（48-320 kbps）

### 4. 双窗口预览
- 左侧显示原视频
- 右侧显示处理结果
- 支持视频和 GIF 预览
- 实时进度显示

## 技术实现

### 后端服务

#### 预览服务 (`PreviewService`)
- 单槽预览任务管理
- 支持视频和 GIF 预览生成
- 自动清理临时文件
- 进程超时处理

#### 工具 IPC 处理器 (`ipc.tools.ts`)
- `tools/trim/preview` - 视频裁剪预览
- `tools/trim/export` - 视频裁剪导出
- `tools/gif/preview` - GIF 预览
- `tools/gif/export` - GIF 导出
- `tools/audio/extract` - 音频提取
- `tools/preview/cancel` - 取消预览

### 前端组件

#### 核心组件
- `DualVideoPreview` - 双视频预览
- `RangeSlider` - 时间范围选择器
- `TrimPanel` - 裁剪面板
- `GifPanel` - GIF 制作面板
- `AudioExtractPanel` - 音频提取面板
- `PreviewBar` - 预览操作栏

#### 状态管理
- `useToolsStore` - 工具页面状态管理
- 支持文件信息、时间范围、预览状态等

### 工具函数

#### 时间工具 (`time.ts`)
- `toHMSms()` - 秒数转时间格式
- `parseHMSms()` - 时间格式转秒数
- `validateTimeRange()` - 时间范围验证
- `formatDuration()` - 持续时间格式化
- `estimateGifSize()` - GIF 文件大小预估

## 使用说明

### 1. 选择视频文件
- 点击或拖拽选择视频文件
- 支持 MP4、MKV、AVI、MOV 等格式
- 自动获取媒体信息

### 2. 设置输出目录
- 点击"选择目录"按钮
- 设置文件输出位置

### 3. 选择时间范围
- 使用时间轴拖拽选择
- 手动输入时间格式
- 快速选择按钮（前10秒、后10秒、全片）

### 4. 配置工具参数
- **视频裁剪**：选择模式、格式、编码器
- **GIF 制作**：设置帧率、宽度、抖动算法
- **音频提取**：选择模式、编码器、码率

### 5. 预览和导出
- 点击"生成预览"查看效果
- 点击"导出文件"保存结果
- 可随时取消预览任务

## 平台差异

### Windows
- 不支持暂停/恢复功能
- 使用 `taskkill` 强制终止进程
- 路径转义处理

### macOS/Linux
- 支持暂停/恢复功能
- 使用 `SIGTERM` 和 `SIGKILL` 信号
- Unix 路径处理

## 已知限制

### 无损快剪
- 可能遇到关键帧问题导致首帧花屏
- 容器/编码器不兼容时会失败
- 建议使用精准剪模式避免问题

### GIF 制作
- 预览时长限制在 30 秒以内
- 生成过程需要两步，耗时较长
- 文件大小通常比视频大很多

### 硬件加速
- 需要相应的显卡支持
- 失败时会自动回退到软件编码
- 黑名单机制避免重复尝试

## 测试

### 单元测试
- `tools.argsBuilder.test.ts` - 工具参数构建测试
- `preview.service.test.ts` - 预览服务测试
- `time.utils.test.ts` - 时间工具函数测试

### 测试覆盖
- 参数验证和构建
- 预览任务管理
- 临时文件清理
- 错误处理
- 时间格式转换

## 开发脚本

```bash
# 开发模式
npm run dev

# 构建项目
npm run build

# 运行测试
npm test

# 类型检查
npm run typecheck

# 代码检查
npm run lint
```

## 文件结构

```
app/
├── main/
│   ├── previewService.ts      # 预览服务
│   └── ipc.tools.ts          # 工具 IPC 处理器
├── renderer/
│   ├── pages/
│   │   └── ToolsPage.tsx     # 工具页面
│   ├── components/
│   │   ├── DualVideoPreview.tsx
│   │   ├── RangeSlider.tsx
│   │   ├── TrimPanel.tsx
│   │   ├── GifPanel.tsx
│   │   ├── AudioExtractPanel.tsx
│   │   └── PreviewBar.tsx
│   └── store/
│       └── useToolsStore.ts  # 工具状态管理
├── shared/
│   ├── tools.ts              # 工具类型定义
│   └── time.ts               # 时间工具函数
└── types/
    └── preload.d.ts          # 更新了工具相关类型

tests/
├── tools.argsBuilder.test.ts
├── preview.service.test.ts
└── time.utils.test.ts
```

## 下一步计划

P2 阶段已完成，可以进入 **P3 阶段：设置页面和高级功能**，包括：
- 设置页面开发
- FFmpeg 路径配置
- 硬件加速检测
- 高级转码选项
- 批量处理功能
