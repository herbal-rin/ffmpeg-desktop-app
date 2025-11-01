import { useEffect, useState } from 'react';
import { CompressPage } from './pages/CompressPage';
import { ToolsPage } from './pages/ToolsPage';
import { SettingsPage } from './pages/SettingsPage';
import { useSettingsStore } from './store/useSettingsStore';
import { useJobsStore } from './store/useJobsStore';
import { useNavigationStore } from './store/useNavigationStore';
import { Toast } from './components/Toast';

/**
 * 主应用组件
 */
export function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { theme, language, loadSettings } = useSettingsStore();
  const { initializeQueue } = useJobsStore();
  const { currentPage, navigateTo } = useNavigationStore();

  useEffect(() => {
    initializeApp();
    
    // 组件卸载时清理
    return () => {
      const cleanup = (window as any).__appCleanup;
      if (cleanup) {
        cleanup();
        delete (window as any).__appCleanup;
      }
    };
  }, []);

  useEffect(() => {
    // 应用主题
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    // 应用语言
    document.documentElement.lang = language;
  }, [language]);

  const initializeApp = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // 加载设置
      await loadSettings();

      // 初始化队列监听
      initializeQueue();

      // 监听菜单事件
      const unsubscribeMenu = window.api.onMenu((action) => {
        handleMenuAction(action);
      });

      // 监听应用事件
      const unsubscribeApp = window.api.onApp((event) => {
        handleAppEvent(event);
      });

      // 存储清理函数供组件卸载时使用
      const cleanup = () => {
        unsubscribeMenu();
        unsubscribeApp();
      };
      
      // 将清理函数存储到组件实例上
      (window as any).__appCleanup = cleanup;
      
    } catch (err) {
      console.error('应用初始化失败:', err);
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMenuAction = (action: string) => {
    switch (action) {
      case 'add-files':
        // 触发文件选择
        break;
      case 'set-output':
        // 触发输出目录选择
        break;
      case 'about':
        // 显示关于对话框
        break;
    }
  };

  const handleAppEvent = (event: string) => {
    switch (event) {
      case 'before-quit':
        // 应用即将退出，清理资源
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">正在加载应用...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            应用启动失败
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 导航栏 */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  FFmpeg 视频工具
                </h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <button
                  onClick={() => navigateTo('compress')}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    currentPage === 'compress'
                      ? 'border-blue-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  视频压缩
                </button>
                <button
                  onClick={() => navigateTo('tools')}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    currentPage === 'tools'
                      ? 'border-blue-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  小工具
                </button>
                <button
                  onClick={() => navigateTo('settings')}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    currentPage === 'settings'
                      ? 'border-blue-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  设置
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* 页面内容 */}
      <main>
        <div style={{ 
          display: currentPage === 'compress' ? 'block' : 'none',
          pointerEvents: currentPage === 'compress' ? 'auto' : 'none'
        }}>
          <CompressPage />
        </div>
        <div style={{ 
          display: currentPage === 'tools' ? 'block' : 'none',
          pointerEvents: currentPage === 'tools' ? 'auto' : 'none'
        }}>
          <ToolsPage />
        </div>
        <div style={{ 
          display: currentPage === 'settings' ? 'block' : 'none',
          pointerEvents: currentPage === 'settings' ? 'auto' : 'none'
        }}>
          <SettingsPage />
        </div>
      </main>
      
      <Toast />
    </div>
  );
}
