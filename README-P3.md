# P3 阶段：设置页与环境管理

## 概述

P3 阶段实现了完整的设置页面和环境管理功能，包括全局设置、FFmpeg 自动管理、硬件加速体检和跨平台打包支持。

## 新增功能

### 1. 设置页面
- **全局输出路径**：可选择和校验可写的默认输出目录
- **语言切换**：支持中文/英文界面切换
- **主题切换**：支持浅色/深色/跟随系统主题
- **实时生效**：设置变更立即生效并持久化保存

### 2. FFmpeg 管理
- **自动检测**：检测系统中已有的 ffmpeg/ffprobe
- **一键下载**：支持下载官方托管版本
- **进度显示**：实时显示下载进度和状态
- **文件校验**：SHA256 校验确保文件完整性
- **版本切换**：系统版本与托管版本间自由切换
- **手动选择**：支持手动选择本地 FFmpeg 路径

### 3. 硬件加速体检
- **NVENC 检测**：检测 NVIDIA GPU 硬件编码支持
- **QSV 检测**：检测 Intel Quick Sync Video 支持
- **VideoToolbox 检测**：检测 Apple 硬件编码支持
- **编码器列表**：显示所有可用的硬件编码器
- **快速自测**：一键测试编码器可用性
- **智能建议**：根据检测结果提供优化建议

### 4. 跨平台打包
- **Windows**：NSIS 安装包 + 便携版
- **macOS**：DMG 安装包（支持通用/双架构）
- **Linux**：AppImage + deb/rpm 包
- **自动化**：一键构建多平台安装包

## 技术实现

### 后端服务

#### FFmpeg 管理器 (`FFmpegManager`)
- 系统 FFmpeg 检测和定位
- 官方版本下载和校验
- 文件解压和权限设置
- 版本管理和切换
- 临时文件清理

#### GPU 体检器 (`GPUDetector`)
- 硬件加速器检测
- 编码器可用性测试
- 快速自测功能
- 智能建议生成

#### 设置 IPC (`SettingsIPC`)
- 设置数据读写
- 文件选择对话框
- 路径验证和权限检查
- 事件监听和通知

### 前端组件

#### 设置页面 (`SettingsPage`)
- 统一的设置管理界面
- 实时保存和反馈
- 错误处理和提示
- 响应式布局设计

#### 专用组件
- `OutputDirPicker`：输出目录选择器
- `LanguageThemeCard`：语言主题卡片
- `HardwareDiagCard`：硬件体检卡片
- `FfmpegManagerCard`：FFmpeg 管理卡片

### 工具函数

#### 平台工具 (`platform.ts`)
- 跨平台路径处理
- 架构检测和识别
- 下载 URL 生成
- 可执行文件名处理

#### 哈希工具 (`hash.ts`)
- SHA256 文件哈希计算
- 字符串哈希生成
- 文件校验和验证
- 随机哈希 ID 生成

## IPC 通信

### 设置相关
- `settings/get`：获取当前设置
- `settings/set`：更新设置
- `settings/selectOutputDir`：选择输出目录
- `settings/selectFFmpegPath`：选择 FFmpeg 路径
- `settings/selectFFprobePath`：选择 FFprobe 路径

### FFmpeg 管理
- `ffmpeg/locate`：定位系统 FFmpeg
- `ffmpeg/getState`：获取 FFmpeg 状态
- `ffmpeg/download`：下载托管版本
- `ffmpeg/cancelDownload`：取消下载
- `ffmpeg/verify`：验证 FFmpeg
- `ffmpeg/switch`：切换 FFmpeg 版本

### GPU 体检
- `gpu/diagnose`：执行硬件体检

### 事件监听
- `ffmpeg/download-progress`：下载进度事件

## 打包配置

### electron-builder 配置
```yaml
appId: com.ffmpeg.desktop
productName: FFmpeg Desktop
directories:
  output: dist
  buildResources: build
files:
  - "app/**"
  - "dist/**"
  - "!**/*.map"
asar: true
```

### 平台特定配置
- **Windows**：NSIS 安装包，支持自定义安装目录
- **macOS**：DMG 安装包，支持通用架构
- **Linux**：AppImage 和 deb/rpm 包

### 构建命令
```bash
npm run build:win    # Windows 构建
npm run build:mac    # macOS 构建
npm run build:linux  # Linux 构建
npm run build:all    # 全平台构建
```

## 使用说明

### 设置页面
1. 打开应用，点击导航栏的"设置"
2. 配置默认输出目录
3. 选择界面语言和主题
4. 设置硬件加速偏好

### FFmpeg 管理
1. 在设置页面找到"FFmpeg 管理"卡片
2. 点击"检测系统 FFmpeg"查看当前状态
3. 选择"下载托管版本"获取最新版本
4. 或使用"手动选择"指定本地路径

### 硬件体检
1. 在设置页面找到"硬件加速体检"卡片
2. 点击"重新体检"执行检测
3. 查看检测结果和建议
4. 开启"优先使用硬件编码"开关

### 打包发布
1. 确保代码已构建：`npm run build`
2. 选择目标平台构建：
   - Windows：`npm run build:win`
   - macOS：`npm run build:mac`
   - Linux：`npm run build:linux`
3. 构建完成后在 `dist` 目录找到安装包

## 技术特色

### 原子操作
- 文件下载、解压、切换的原子性保证
- 失败时自动清理临时文件
- 避免半成品文件污染系统

### 类型安全
- 完整的 TypeScript 类型定义
- 编译时类型检查
- 运行时类型验证

### 错误处理
- 完善的错误捕获和提示
- 友好的错误恢复机制
- 详细的错误日志记录

### 跨平台兼容
- Windows/macOS/Linux 全平台支持
- 平台特定的路径和权限处理
- 统一的 API 接口

## 性能优化

### 内存管理
- 下载任务的生命周期管理
- 临时文件的及时清理
- 事件监听器的正确释放

### 响应性
- 异步操作不阻塞 UI
- 实时进度反馈
- 快速错误恢复

## 安全考虑

### 文件安全
- 路径验证和转义
- 文件权限检查
- 临时文件隔离

### 网络安全
- HTTPS 下载
- 文件完整性校验
- 下载中断处理

### 进程安全
- 参数验证
- 超时机制
- 资源清理

## 故障排除

### 常见问题

1. **FFmpeg 检测失败**
   - 检查系统 PATH 环境变量
   - 确认 FFmpeg 可执行文件存在
   - 验证文件权限

2. **下载失败**
   - 检查网络连接
   - 确认防火墙设置
   - 尝试使用代理

3. **硬件加速不可用**
   - 更新显卡驱动
   - 检查硬件支持
   - 查看系统兼容性

4. **设置保存失败**
   - 检查文件权限
   - 确认磁盘空间
   - 查看错误日志

### 日志查看
- 主进程日志：控制台输出
- 渲染进程日志：浏览器开发者工具
- 错误详情：设置页面的错误提示

## 开发指南

### 添加新设置项
1. 在 `SettingsData` 接口中添加字段
2. 在 `SettingsIPC` 中实现读写逻辑
3. 在前端组件中添加 UI 控件
4. 更新类型定义和验证

### 扩展硬件检测
1. 在 `GPUDetector` 中添加新的检测逻辑
2. 更新 `GPUDiagnosticResult` 接口
3. 在前端显示检测结果
4. 添加相应的建议和提示

### 自定义打包
1. 修改 `electron-builder.yml` 配置
2. 添加平台特定的构建选项
3. 配置代码签名和公证
4. 设置自动更新机制

## 总结

P3 阶段成功实现了完整的设置页和环境管理功能，为应用提供了：

- **完整的设置管理**：全局设置、FFmpeg 管理、硬件体检
- **优秀的用户体验**：直观的界面、实时反馈、友好的错误处理
- **robust 的技术架构**：完善的 IPC 通信、类型安全、错误处理
- **跨平台支持**：Windows/macOS/Linux 全平台打包

这些功能为应用的生产环境部署和用户使用体验奠定了坚实的基础。
