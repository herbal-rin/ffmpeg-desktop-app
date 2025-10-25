import React from 'react';

/**
 * Toast 组件属性
 */
interface ToastProps {
  message?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose?: () => void;
  details?: string | undefined; // 错误详情
  show?: boolean; // 显示状态
}

/**
 * Toast 组件状态
 */
interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  details?: string | undefined;
  showDetails: boolean;
}

/**
 * Toast 组件
 */
export function Toast({ message, type = 'info', duration = 3000, onClose, details }: ToastProps) {
  const [state, setState] = React.useState<ToastState>({
    visible: false,
    message: '',
    type: 'info',
    details: undefined,
    showDetails: false
  });

  // 显示 Toast
  const showToast = React.useCallback((msg: string, toastType: 'success' | 'error' | 'warning' | 'info', errorDetails?: string) => {
    setState({
      visible: true,
      message: msg,
      type: toastType,
      details: errorDetails,
      showDetails: false
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
      showToast(message, type, details);
    }
  }, [message, type, details, showToast]);

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
      <div className={`${getBgColor()} text-white px-4 py-3 rounded-lg shadow-lg max-w-md`}>
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getIcon()}</span>
          <span className="flex-1">{state.message}</span>
          <button
            onClick={() => setState(prev => ({ ...prev, visible: false }))}
            className="text-white hover:text-gray-200 transition-colors"
          >
            ✕
          </button>
        </div>
        
        {/* 错误详情 */}
        {state.type === 'error' && state.details && (
          <div className="mt-2">
            <button
              onClick={() => setState(prev => ({ ...prev, showDetails: !prev.showDetails }))}
              className="text-xs text-gray-200 hover:text-white underline"
            >
              {state.showDetails ? '隐藏详情' : '查看详情'}
            </button>
            {state.showDetails && (
              <div className="mt-2 p-2 bg-black/20 rounded text-xs font-mono max-h-32 overflow-y-auto">
                <div className="text-gray-300">FFmpeg 错误信息:</div>
                <div className="text-white whitespace-pre-wrap">{state.details}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
