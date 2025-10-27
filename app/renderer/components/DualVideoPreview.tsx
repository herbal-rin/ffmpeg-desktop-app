/**
 * 双视频预览组件
 * 左侧显示原视频，右侧显示预览结果
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useToolsStore } from '../store/useToolsStore';

interface DualVideoPreviewProps {
  className?: string;
}

export const DualVideoPreview: React.FC<DualVideoPreviewProps> = ({ className = '' }) => {
  const { selectedFile, previewPath, isPreviewing, previewProgress } = useToolsStore();
  const [previewKey, setPreviewKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);

  // 为原视频创建和管理 blob URL
  const blobUrlRef = useRef<string | undefined>();
  
  const videoSrc = useMemo(() => {
    // 清理旧的 blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = undefined;
    }
    
    // 创建新的 blob URL
    if (selectedFile?.file) {
      const newBlobUrl = URL.createObjectURL(selectedFile.file);
      blobUrlRef.current = newBlobUrl;
      return newBlobUrl;
    }
    return undefined;
  }, [selectedFile?.file]);

  // 组件卸载时清理 blob URL
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = undefined;
      }
    };
  }, []);

  // 当预览文件更新时，重新加载预览
  useEffect(() => {
    if (previewPath) {
      setPreviewKey(prev => prev + 1);
    }
  }, [previewPath]);

  // 获取预览 URL
  const previewUrl = useMemo(() => {
    if (!previewPath) return undefined;
    // 使用自定义协议加载本地临时文件
    return `local-video://${previewPath}`;
  }, [previewPath]);

  // 检查是否为 GIF 文件
  const isGifPreview = previewPath?.endsWith('.gif');

  if (!selectedFile) {
    return (
      <div className={`flex items-center justify-center h-64 bg-gray-100 rounded-lg ${className}`}>
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">📹</div>
          <p>请选择视频文件</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 gap-4 ${className}`} style={{ height: '480px' }}>
      {/* 左侧：原视频 */}
      <div className="bg-gray-100 rounded-lg overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              className="w-full h-full object-contain"
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                }
              }}
            />
          </div>
          <div className="px-3 py-2 bg-gray-200 text-sm text-gray-600">
            原视频
          </div>
        </div>
      </div>

      {/* 右侧：预览结果 */}
      <div className="bg-gray-100 rounded-lg overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            {isPreviewing ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">生成预览中...</p>
                <p className="text-xs text-gray-500">{Math.round(previewProgress)}%</p>
              </div>
            ) : previewPath ? (
              isGifPreview ? (
                <img
                  key={previewKey}
                  src={previewUrl}
                  alt="GIF 预览"
                  className="w-full h-full object-contain"
                />
              ) : (
                <video
                  ref={previewRef}
                  key={previewKey}
                  src={previewUrl}
                  controls
                  className="w-full h-full object-contain"
                  onLoadedMetadata={() => {
                    if (previewRef.current) {
                      previewRef.current.currentTime = 0;
                    }
                  }}
                />
              )
            ) : (
              <div className="text-center text-gray-500">
                <div className="text-2xl mb-2">👁️</div>
                <p className="text-sm">点击"生成预览"查看效果</p>
              </div>
            )}
          </div>
          <div className="px-3 py-2 bg-gray-200 text-sm text-gray-600">
            {isGifPreview ? 'GIF 预览' : '视频预览'}
          </div>
        </div>
      </div>
    </div>
  );
};
