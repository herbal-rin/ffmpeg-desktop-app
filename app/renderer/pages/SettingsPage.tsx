/**
 * 设置页面主组件
 */

import React, { useState, useEffect } from 'react';
import { OutputDirPicker } from '../components/OutputDirPicker';
import { LanguageThemeCard } from '../components/LanguageThemeCard';
import { HardwareDiagCard } from '../components/HardwareDiagCard';
import { FfmpegManagerCard } from '../components/FfmpegManagerCard';
import { Toast } from '../components/Toast';

interface SettingsData {
  defaultOutputDir: string;
  language: 'zh' | 'en';
  theme: 'light' | 'dark' | 'system';
  preferHardwareAccel: boolean;
  ffmpegPath: string;
  ffprobePath: string;
  ffmpegManaged: boolean;
}

interface ToastState {
  visible: boolean;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
  details?: string;
}

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SettingsData>({
    defaultOutputDir: '',
    language: 'zh',
    theme: 'system',
    preferHardwareAccel: true,
    ffmpegPath: '',
    ffprobePath: '',
    ffmpegManaged: false
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'info'
  });

  // 加载设置
  const loadSettings = async () => {
    try {
      const data = await window.api.invoke('settings/get');
      setSettings(data);
    } catch (error) {
      showToast('加载设置失败', 'error', error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsLoading(false);
    }
  };

  // 保存设置
  const saveSettings = async (newSettings: Partial<SettingsData>) => {
    setIsSaving(true);
    
    try {
      await window.api.invoke('settings/set', newSettings);
      
      // 更新本地状态
      setSettings(prev => ({ ...prev, ...newSettings }));
      
      showToast('设置已保存', 'success');
    } catch (error) {
      showToast('保存设置失败', 'error', error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsSaving(false);
    }
  };

  // 显示提示
  const showToast = (message: string, type: ToastState['type'], details?: string) => {
    setToast({
      visible: true,
      message,
      type,
      details
    });
  };

  // 隐藏提示
  const hideToast = () => {
    setToast(prev => ({ ...prev, visible: false }));
  };

  // 处理输出目录变更
  const handleOutputDirChange = (path: string) => {
    saveSettings({ defaultOutputDir: path });
  };

  // 处理语言变更
  const handleLanguageChange = (language: 'zh' | 'en') => {
    saveSettings({ language });
  };

  // 处理主题变更
  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    saveSettings({ theme });
  };

  // 处理硬件加速偏好变更
  const handlePreferHardwareAccelChange = (enabled: boolean) => {
    saveSettings({ preferHardwareAccel: enabled });
  };

  // 处理FFmpeg路径变更
  const handleFFmpegPathChange = (path: string) => {
    saveSettings({ ffmpegPath: path });
  };

  // 处理FFprobe路径变更
  const handleFFprobePathChange = (path: string) => {
    saveSettings({ ffprobePath: path });
  };

  // 处理FFmpeg管理方式变更
  const handleFFmpegManagedChange = (managed: boolean) => {
    saveSettings({ ffmpegManaged: managed });
  };

  // 组件挂载时加载设置
  useEffect(() => {
    loadSettings();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-600">加载设置中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            设置
          </h1>
          <p className="text-gray-600">
            配置应用程序的默认设置和FFmpeg环境
          </p>
        </div>

        {/* 输出目录设置 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            输出设置
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              默认输出目录
            </label>
            <OutputDirPicker
              value={settings.defaultOutputDir}
              onChange={handleOutputDirChange}
              disabled={isSaving}
            />
          </div>
        </div>

        {/* 界面设置 */}
        <LanguageThemeCard
          language={settings.language}
          theme={settings.theme}
          onLanguageChange={handleLanguageChange}
          onThemeChange={handleThemeChange}
        />

        {/* 硬件加速设置 */}
        <HardwareDiagCard
          preferHardwareAccel={settings.preferHardwareAccel}
          onPreferHardwareAccelChange={handlePreferHardwareAccelChange}
        />

        {/* FFmpeg管理 */}
        <FfmpegManagerCard
          ffmpegPath={settings.ffmpegPath}
          ffprobePath={settings.ffprobePath}
          ffmpegManaged={settings.ffmpegManaged}
          onFFmpegPathChange={handleFFmpegPathChange}
          onFFprobePathChange={handleFFprobePathChange}
          onFFmpegManagedChange={handleFFmpegManagedChange}
        />

        {/* 保存状态指示 */}
        {isSaving && (
          <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
            保存中...
          </div>
        )}
      </div>

      {/* 提示组件 */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        details={toast.details}
        onClose={hideToast}
      />
    </div>
  );
};
