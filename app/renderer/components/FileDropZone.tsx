import React, { useCallback, useState } from 'react';
import { t } from '../i18n';

/**
 * 文件拖拽组件属性
 */
interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * 文件拖拽组件
 */
export function FileDropZone({ 
  onFilesSelected, 
  accept = 'video/*', 
  multiple = true, 
  disabled = false,
  className = ''
}: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragAccept, setIsDragAccept] = useState(false);
  const [isDragReject, setIsDragReject] = useState(false);

  // 处理拖拽进入
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;
    
    setIsDragOver(true);
    
    // 检查是否包含文件
    const hasFiles = e.dataTransfer.types.includes('Files');
    if (hasFiles) {
      setIsDragAccept(true);
    } else {
      setIsDragReject(true);
    }
  }, [disabled]);

  // 处理拖拽离开
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 只有当离开整个拖拽区域时才重置状态
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
      setIsDragAccept(false);
      setIsDragReject(false);
    }
  }, []);

  // 处理拖拽悬停
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // 处理文件放置
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;
    
    setIsDragOver(false);
    setIsDragAccept(false);
    setIsDragReject(false);
    
    const files = Array.from(e.dataTransfer.files);
    
    // 过滤视频文件
    const videoFiles = files.filter(file => {
      return file.type.startsWith('video/') || 
             /\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v|3gp)$/i.test(file.name);
    });
    
    if (videoFiles.length > 0) {
      onFilesSelected(videoFiles);
    } else {
      // 显示错误提示
      (window as any).showToast?.(t('error.unsupportedFormat'), 'error');
    }
  }, [disabled, onFilesSelected]);

  // 处理文件选择
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    // 重置 input 值，允许重复选择同一文件
    e.target.value = '';
  }, [onFilesSelected]);

  // 处理点击
  const handleClick = useCallback(() => {
    if (!disabled) {
      const input = document.getElementById('file-input') as HTMLInputElement;
      input?.click();
    }
  }, [disabled]);

  const getDropzoneClasses = () => {
    let classes = 'dropzone cursor-pointer transition-all duration-200 ';
    
    if (disabled) {
      classes += 'opacity-50 cursor-not-allowed ';
    } else if (isDragOver) {
      if (isDragAccept) {
        classes += 'dropzone-accept ';
      } else if (isDragReject) {
        classes += 'dropzone-reject ';
      } else {
        classes += 'dropzone-active ';
      }
    }
    
    classes += className;
    return classes;
  };

  return (
    <div
      className={getDropzoneClasses()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        id="file-input"
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />
      
      <div className="text-center">
        <div className="text-6xl mb-4">
          {isDragOver ? (isDragAccept ? '📁' : '❌') : '🎬'}
        </div>
        
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
          {t('compress.dragDrop')}
        </h3>
        
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {t('compress.selectFiles')}
        </p>
        
        <div className="text-xs text-gray-400 dark:text-gray-500">
          支持格式: MP4, MKV, AVI, MOV, WMV, FLV, WebM
        </div>
      </div>
    </div>
  );
}
