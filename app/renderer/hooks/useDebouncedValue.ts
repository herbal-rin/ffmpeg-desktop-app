/**
 * 防抖 Hook
 * 用于防止频繁触发预览生成
 */

import { useState, useEffect } from 'react';

/**
 * 防抖值 Hook
 * @param value 原始值
 * @param ms 防抖延迟时间（毫秒）
 * @returns 防抖后的值
 */
export function useDebouncedValue<T>(value: T, ms: number = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, ms);

    return () => clearTimeout(timer);
  }, [value, ms]);

  return debouncedValue;
}

/**
 * 防抖回调 Hook
 * @param callback 回调函数
 * @param ms 防抖延迟时间（毫秒）
 * @returns 防抖后的回调函数
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  ms: number = 400
): T {
  const [debouncedCallback] = useState(() => {
    let timeoutId: NodeJS.Timeout;
    
    return ((...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        callback(...args);
      }, ms);
    }) as T;
  });

  return debouncedCallback;
}
