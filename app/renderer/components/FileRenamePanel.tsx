/**
 * 文件重命名面板组件
 * 支持单文件和多文件的重命名、批量前缀/后缀、拖拽排序
 */

import React, { useState, useCallback } from 'react';

interface FileInfo {
  file: File;
  probeResult?: any;
  error?: string;
  tempPath?: string;
  transferProgress?: number;
  isTransferring?: boolean;
  customOutputName?: string; // 自定义输出文件名（不含扩展名）
}

interface FileRenamePanelProps {
  files: FileInfo[];
  container: string;
  videoCodec: string;
  onFilesUpdate: (files: FileInfo[]) => void;
  disabled?: boolean;
}

// 获取文件基础名（不含扩展名）
function getBasename(filePath: string): string {
  const name = filePath.split(/[/\\]/).pop() || '';
  return name.split('.').slice(0, -1).join('.') || name;
}

export const FileRenamePanel: React.FC<FileRenamePanelProps> = ({
  files,
  container,
  videoCodec,
  onFilesUpdate,
  disabled = false
}) => {
  const [batchPrefix, setBatchPrefix] = useState('');
  const [batchSuffix, setBatchSuffix] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // 获取编码器后缀
  const getCodecSuffix = () => {
    return videoCodec.includes('h264') ? 'X264' : 'X265';
  };

  // 获取文件的显示输出名（包含后缀和扩展名）
  const getDisplayOutputName = (fileInfo: FileInfo, index: number) => {
    const basename = fileInfo.customOutputName || getBasename(fileInfo.file.name);
    const codecSuffix = getCodecSuffix();
    return `${basename}_${codecSuffix}.${container}`;
  };

  // 更新单个文件的自定义名称
  const handleFileNameChange = (index: number, newName: string) => {
    const updated = [...files];
    updated[index] = {
      ...updated[index],
      customOutputName: newName.trim() || undefined
    };
    onFilesUpdate(updated);
  };

  // 应用批量前缀和后缀
  const handleApplyBatch = () => {
    if (!batchPrefix.trim() && !batchSuffix.trim()) {
      return;
    }

    const updated = files.map((fileInfo, index) => {
      const originalName = fileInfo.customOutputName || getBasename(fileInfo.file.name);
      const number = String(index + 1).padStart(2, '0');
      
      // 构建新名称：前缀 + 序号（如果有前缀）+ 原名 + 后缀
      let newName = originalName;
      
      if (batchPrefix.trim()) {
        newName = `${batchPrefix.trim()}_${number}_${newName}`;
      }
      
      if (batchSuffix.trim()) {
        newName = `${newName}_${batchSuffix.trim()}`;
      }
      
      return {
        ...fileInfo,
        customOutputName: newName
      };
    });

    onFilesUpdate(updated);
    
    // 显示成功提示
    (window as any).showToast?.('批量命名已应用', 'success');
  };

  // 重置所有自定义名称
  const handleResetAll = () => {
    const updated = files.map(fileInfo => ({
      ...fileInfo,
      customOutputName: undefined
    }));
    onFilesUpdate(updated);
    setBatchPrefix('');
    setBatchSuffix('');
    (window as any).showToast?.('已重置为原文件名', 'success');
  };

  // 拖拽开始
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  // 拖拽悬停
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const updated = [...files];
    const draggedItem = updated[draggedIndex];
    updated.splice(draggedIndex, 1);
    updated.splice(index, 0, draggedItem);

    onFilesUpdate(updated);
    setDraggedIndex(index);
  };

  // 拖拽结束
  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // 单文件模式
  if (files.length === 1) {
    const fileInfo = files[0];
    const customName = fileInfo.customOutputName || '';
    const placeholder = getBasename(fileInfo.file.name);

    return (
      <div className="space-y-3">
        <label className="label text-sm mb-2 flex items-center gap-2">
          输出文件名
          <span className="text-xs text-gray-500 dark:text-gray-400">(不含扩展名)</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customName}
            onChange={(e) => handleFileNameChange(0, e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="input flex-1"
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            _{getCodecSuffix()}.{container}
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          留空将使用输入文件名，将自动添加编码器后缀
        </p>
      </div>
    );
  }

  // 多文件模式
  return (
    <div className="space-y-4">
      {/* 批量命名控制 */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
          📝 批量命名
        </h4>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label text-xs mb-1">前缀</label>
            <input
              type="text"
              value={batchPrefix}
              onChange={(e) => setBatchPrefix(e.target.value)}
              placeholder="例如: Project"
              disabled={disabled}
              className="input w-full text-sm"
            />
          </div>
          
          <div>
            <label className="label text-xs mb-1">后缀</label>
            <input
              type="text"
              value={batchSuffix}
              onChange={(e) => setBatchSuffix(e.target.value)}
              placeholder="例如: Final"
              disabled={disabled}
              className="input w-full text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleApplyBatch}
            disabled={disabled || (!batchPrefix.trim() && !batchSuffix.trim())}
            className="btn btn-sm btn-primary flex-1"
          >
            应用批量命名
          </button>
          <button
            onClick={handleResetAll}
            disabled={disabled}
            className="btn btn-sm btn-outline"
          >
            重置全部
          </button>
        </div>

        <p className="text-xs text-blue-600 dark:text-blue-400">
          💡 格式：前缀_序号_原文件名_后缀_编码器.{container}
        </p>
      </div>

      {/* 文件列表（可拖拽排序） */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            🎬 输出文件列表 ({files.length})
          </h4>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            拖动文件可调整顺序
          </span>
        </div>

        {files.map((fileInfo, index) => {
          const outputName = getDisplayOutputName(fileInfo, index);
          const customName = fileInfo.customOutputName || getBasename(fileInfo.file.name);

          return (
            <div
              key={index}
              draggable={!disabled}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`p-3 border rounded-lg transition-all ${
                draggedIndex === index
                  ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
              } ${!disabled ? 'cursor-move hover:shadow-md' : ''}`}
            >
              <div className="flex items-start gap-3">
                {/* 序号和拖拽图标 */}
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <span className="text-xs font-mono font-bold min-w-[24px] text-center">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {!disabled && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  {/* 原文件名 */}
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    📁 {fileInfo.file.name}
                  </div>

                  {/* 自定义名称输入 */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => handleFileNameChange(index, e.target.value)}
                      placeholder={getBasename(fileInfo.file.name)}
                      disabled={disabled}
                      className="input text-sm flex-1"
                    />
                  </div>

                  {/* 输出文件名预览 */}
                  <div className="text-xs font-mono text-green-600 dark:text-green-400 flex items-center gap-1">
                    <span>📤</span>
                    <span>{outputName}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 提示信息 */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>• 可以单独编辑每个文件的输出名称</p>
        <p>• 拖动文件可以调整处理顺序</p>
        <p>• 使用批量命名可以快速添加前缀和后缀</p>
      </div>
    </div>
  );
};

