import React from 'react';
import { t } from '../i18n';

/**
 * Toast 组件属性
 */
interface ToastProps {
  message?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose?: () => void;
}

/**
 * Toast 组件状态
 */
interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

/**
 * Toast 组件
 */
export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const [state, setState] = React.useState<ToastState>({
    visible: false,
    message: '',
    type: 'info'
  });

  // 显示 Toast
  const showToast = React.useCallback((msg: string, toastType: 'success' | 'error' | 'warning' | 'info') => {
    setState({
      visible: true,
      message: msg,
      type: toastType
    });

    // 自动隐藏
    setTimeout(() => {
      setState(prev => ({ ...prev, visible: false }));
      onClose?.();
    }, duration);
  }, [duration, onClose]);

  // 暴露全局方法
  React.useEffect(() => {
    (window as any).showToast = showToast;
    return () => {
      delete (window as any).showToast;
    };
  }, [showToast]);

  // 处理外部消息
  React.useEffect(() => {
    if (message) {
      showToast(message, type);
    }
  }, [message, type, showToast]);

  if (!state.visible) {
    return null;
  }

  const getIcon = () => {
    switch (state.type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  const getBgColor = () => {
    switch (state.type) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'info':
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-up">
      <div className={`${getBgColor()} text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 max-w-sm`}>
        <span className="text-lg">{getIcon()}</span>
        <span className="flex-1">{state.message}</span>
        <button
          onClick={() => setState(prev => ({ ...prev, visible: false }))}
          className="text-white hover:text-gray-200 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
