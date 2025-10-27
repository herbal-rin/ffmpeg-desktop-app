import { app, BrowserWindow, Menu, shell } from 'electron';
import { join } from 'path';
import { setupIPC } from './ipc';
import { setupToolsIPC, initializeToolsServices } from './ipc.tools';
import { SettingsIPC } from './ipc.settings';
import { PreviewService } from './previewService';
import { FFprobeService } from '../services/ffmpeg/probe';
import { ConsoleLogger } from '../services/logger';
import { configService } from '../services/config';

// 主窗口
let mainWindow: BrowserWindow | null = null;

/**
 * 创建主窗口
 */
function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: join(__dirname, 'preload.js'),
      webSecurity: false // 允许加载本地文件用于视频预览
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false, // 先不显示，等加载完成
    // icon: join(__dirname, '../assets/icon.png') // 可选：应用图标
  });

  // 加载页面
  // 检查是否为开发模式
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  console.log(`[调试信息] NODE_ENV=${process.env.NODE_ENV}, isDevelopment=${isDevelopment}`);
  
  if (isDevelopment) {
    // 开发模式：从环境变量获取 Vite 端口，默认 5173
    const vitePort = process.env.VITE_PORT || '5173';
    const url = `http://localhost:${vitePort}`;
    console.log(`[开发模式] 加载 Vite 服务器: ${url}`);
    mainWindow.loadURL(url);
    mainWindow.webContents.openDevTools();
    
    // 添加错误监听
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      console.error('[窗口加载失败]', errorCode, errorDescription);
    });
  } else {
    // 生产模式：加载打包后的文件
    console.log('[生产模式] 加载静态文件');
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // 窗口准备就绪时显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    
    // 开发环境下聚焦到窗口
    if (isDevelopment) {
      mainWindow?.focus();
    }
  });

  // 处理窗口关闭
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 处理外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 防止导航到外部页面
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) {
      event.preventDefault();
    }
  });
}

/**
 * 创建应用菜单
 */
function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '添加视频文件',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow?.webContents.send('menu:add-files');
          }
        },
        {
          label: '设置输出目录',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => {
            mainWindow?.webContents.send('menu:set-output');
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            mainWindow?.webContents.send('menu:about');
          }
        }
      ]
    }
  ];

  // macOS 特殊处理
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about', label: '关于' },
        { type: 'separator' },
        { role: 'services', label: '服务' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * 应用准备就绪
 */
app.whenReady().then(() => {
  // 设置 IPC
  setupIPC();
  
  // 初始化服务
  const logger = new ConsoleLogger('debug');
  
  try {
    // 尝试获取 FFmpeg 路径，如果未配置则不初始化相关服务
    let ffmpegPaths;
    try {
      ffmpegPaths = configService.getPaths();
      
      // 只有在路径有效时才初始化服务
      const ffprobeService = new FFprobeService(ffmpegPaths, logger);
      const previewService = new PreviewService(logger, ffmpegPaths);
      
      // 初始化工具服务
      initializeToolsServices({
        previewService,
        ffprobeService,
        logger,
        ffmpegPaths
      });
      
      logger.info('工具服务已初始化');
    } catch (error) {
      // FFmpeg 未配置，使用默认路径，但不初始化服务
      logger.warn('FFmpeg未配置，跳过工具服务初始化', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      // 保持 mainWindow 可访问设置页
    }
    
    logger.info('所有服务初始化成功');
  } catch (error) {
    // FFmpeg 未配置时，只记录警告，不阻止应用启动
    logger.warn('服务初始化失败', { error: error instanceof Error ? error.message : String(error) });
  }
  
  // 初始化设置 IPC（在 try-catch 外，确保即使 FFmpeg 未配置也能注册）
  try {
    logger.info('开始创建 SettingsIPC 实例...');
    new SettingsIPC(logger, configService);
    logger.info('SettingsIPC 实例创建成功');
    logger.info('设置IPC已初始化');
  } catch (error) {
    logger.error('SettingsIPC 创建失败', { error: error instanceof Error ? error.message : String(error) });
  }
  
  // 设置工具 IPC（在 try-catch 外，确保即使 FFmpeg 未配置也能注册）
  try {
    setupToolsIPC();
    logger.info('工具 IPC 已设置');
  } catch (error) {
    logger.warn('工具 IPC 设置失败（FFmpeg 未配置）', { error: error instanceof Error ? error.message : String(error) });
  }

  // 创建主窗口
  createMainWindow();

  // 创建菜单
  createMenu();

  // macOS 特殊处理：当所有窗口关闭时，应用仍然运行
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

/**
 * 所有窗口关闭时退出应用（除了 macOS）
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * 应用即将退出
 */
app.on('before-quit', () => {
  // 清理资源
  mainWindow?.webContents.send('app:before-quit');
});

/**
 * 安全处理：防止新窗口创建
 */
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});

// 导出主窗口引用（供 IPC 使用）
export { mainWindow };
