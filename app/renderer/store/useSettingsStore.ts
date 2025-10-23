import { create } from 'zustand';
import { SettingsResponse, SettingsRequest } from '@types/preload';

/**
 * 设置状态接口
 */
interface SettingsState {
  // 设置数据
  ffmpegPath: string;
  ffprobePath: string;
  defaultOutputDir: string;
  language: string;
  theme: 'light' | 'dark';
  hardwareAcceleration: boolean;
  
  // 状态
  isLoading: boolean;
  error: string | null;
  
  // 操作
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<SettingsRequest>) => Promise<void>;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (language: string) => void;
  setDefaultOutputDir: (dir: string) => void;
  setHardwareAcceleration: (enabled: boolean) => void;
  clearError: () => void;
}

/**
 * 设置状态管理
 */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  // 初始状态
  ffmpegPath: '',
  ffprobePath: '',
  defaultOutputDir: '',
  language: 'zh-CN',
  theme: 'light',
  hardwareAcceleration: true,
  isLoading: false,
  error: null,

  // 加载设置
  loadSettings: async () => {
    try {
      set({ isLoading: true, error: null });
      
      const settings = await window.api.invoke<SettingsResponse>('settings/get');
      
      set({
        ffmpegPath: settings.ffmpegPath,
        ffprobePath: settings.ffprobePath,
        defaultOutputDir: settings.defaultOutputDir,
        language: settings.language,
        theme: settings.theme as 'light' | 'dark',
        hardwareAcceleration: settings.hardwareAcceleration,
        isLoading: false,
      });
    } catch (error) {
      console.error('加载设置失败:', error);
      set({
        error: error instanceof Error ? error.message : '加载设置失败',
        isLoading: false,
      });
    }
  },

  // 更新设置
  updateSettings: async (settings: Partial<SettingsRequest>) => {
    try {
      set({ isLoading: true, error: null });
      
      await window.api.invoke('settings/set', settings);
      
      // 更新本地状态
      set((state) => ({
        ...state,
        ...settings,
        isLoading: false,
      }));
    } catch (error) {
      console.error('更新设置失败:', error);
      set({
        error: error instanceof Error ? error.message : '更新设置失败',
        isLoading: false,
      });
    }
  },

  // 设置主题
  setTheme: (theme: 'light' | 'dark') => {
    set({ theme });
    get().updateSettings({ theme });
  },

  // 设置语言
  setLanguage: (language: string) => {
    set({ language });
    get().updateSettings({ language });
  },

  // 设置默认输出目录
  setDefaultOutputDir: (defaultOutputDir: string) => {
    set({ defaultOutputDir });
    get().updateSettings({ defaultOutputDir });
  },

  // 设置硬件加速
  setHardwareAcceleration: (hardwareAcceleration: boolean) => {
    set({ hardwareAcceleration });
    get().updateSettings({ hardwareAcceleration });
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },
}));
