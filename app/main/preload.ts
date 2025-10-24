import { contextBridge, ipcRenderer } from 'electron';

/**
 * 暴露给渲染进程的 API
 */
const api = {
  /**
   * 调用主进程方法
   */
  invoke: <T = any>(channel: string, payload?: any): Promise<T> => {
    return ipcRenderer.invoke(channel, payload);
  },

  /**
   * 监听主进程事件
   */
  on: (channel: 'queue/events' | 'tools/events', callback: (payload: any) => void): (() => void) => {
    const handler = (_event: any, payload: any) => callback(payload);
    ipcRenderer.on(channel, handler);
    
    // 返回取消监听的函数
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  },

  /**
   * 监听菜单事件
   */
  onMenu: (callback: (action: string) => void): (() => void) => {
    const handler = (_event: any, action: string) => callback(action);
    ipcRenderer.on('menu:add-files', () => handler(null, 'add-files'));
    ipcRenderer.on('menu:set-output', () => handler(null, 'set-output'));
    ipcRenderer.on('menu:about', () => handler(null, 'about'));
    
    // 返回取消监听的函数
    return () => {
      ipcRenderer.removeAllListeners('menu:add-files');
      ipcRenderer.removeAllListeners('menu:set-output');
      ipcRenderer.removeAllListeners('menu:about');
    };
  },

  /**
   * 监听应用事件
   */
  onApp: (callback: (event: string) => void): (() => void) => {
    const handler = (_event: any, eventType: string) => callback(eventType);
    ipcRenderer.on('app:before-quit', () => handler(null, 'before-quit'));
    
    // 返回取消监听的函数
    return () => {
      ipcRenderer.removeAllListeners('app:before-quit');
    };
  }
};

// 将 API 暴露到 window.api
contextBridge.exposeInMainWorld('api', api);

// 类型声明（供 TypeScript 使用）
declare global {
  interface Window {
    api: typeof api;
  }
}
