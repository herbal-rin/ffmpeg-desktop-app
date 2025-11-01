import { create } from 'zustand';

/**
 * 页面类型
 */
export type PageType = 'compress' | 'tools' | 'settings';

/**
 * 导航状态接口
 */
interface NavigationState {
  currentPage: PageType;
  navigateTo: (page: PageType) => void;
}

/**
 * 导航状态管理
 */
export const useNavigationStore = create<NavigationState>((set) => ({
  currentPage: 'compress',
  navigateTo: (page: PageType) => set({ currentPage: page }),
}));

