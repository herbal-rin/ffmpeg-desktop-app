/**
 * 输出目录选择器组件
 */

import React, { useState } from 'react';

interface OutputDirPickerProps {
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
}

export const OutputDirPicker: React.FC<OutputDirPickerProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectDirectory = async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.api.invoke('settings/selectOutputDir');
      
      if (result.success) {
        onChange(result.path);
      } else {
        setError(result.error || '选择目录失败');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '选择目录失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="output-dir-picker">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="选择默认输出目录"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={disabled}
        />
        <button
          onClick={handleSelectDirectory}
          disabled={disabled || isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '选择中...' : '浏览'}
        </button>
      </div>
      
      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
      
      <div className="mt-1 text-sm text-gray-500">
        所有任务的默认输出目录，可在任务中单独修改
      </div>
    </div>
  );
};
