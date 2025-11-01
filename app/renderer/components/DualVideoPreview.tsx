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

  // 调试：监控 previewPath 变化
  useEffect(() => {
    console.log('🎥 DualVideoPreview - previewPath 变化:', previewPath);
  }, [previewPath]);

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

  // 为预览视频创建 blob URL
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | undefined>();
  const previewBlobRef = useRef<string | undefined>();
  
  useEffect(() => {
    if (!previewPath) {
      // 清理旧的 blob URL
      if (previewBlobRef.current) {
        URL.revokeObjectURL(previewBlobRef.current);
        previewBlobRef.current = undefined;
      }
      setPreviewBlobUrl(undefined);
      return;
    }

    // 通过 IPC 读取预览文件并创建 blob URL
    (async () => {
      try {
        console.log('📖 开始读取预览文件:', previewPath);
        const result = await window.api.invoke('file/read-preview', { filePath: previewPath });
        
        // 清理旧的 blob URL
        if (previewBlobRef.current) {
          URL.revokeObjectURL(previewBlobRef.current);
        }
        
        // 创建新的 blob URL（根据文件类型设置 MIME）
        const mimeType = previewPath.endsWith('.gif') ? 'image/gif' : 'video/mp4';
        const blob = new Blob([result.buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        previewBlobRef.current = url;
        
        console.log('🔗 生成预览 blob URL:', url);
        setPreviewBlobUrl(url);
      } catch (error) {
        console.error('❌ 读取预览文件失败:', error);
      }
    })();
    
    // 清理函数
    return () => {
      if (previewBlobRef.current) {
        URL.revokeObjectURL(previewBlobRef.current);
        previewBlobRef.current = undefined;
      }
    };
  }, [previewPath]);

  const previewUrl = previewBlobUrl;

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
      <div className="bg-gray-50 rounded-lg overflow-hidden flex flex-col border border-gray-200">
        {/* 标题栏 */}
        <div className="px-3 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">📹 原视频</span>
          {selectedFile && (
            <span className="text-xs text-gray-500">
              {selectedFile.probeResult ? `${selectedFile.probeResult.durationSec.toFixed(1)}s` : ''}
            </span>
          )}
        </div>
        {/* 视频区域 */}
        <div className="flex-1 bg-gray-100 overflow-hidden relative">
          <video
            ref={videoRef}
            src={videoSrc}
            controls
            className="absolute inset-0 w-full h-full object-contain"
            onLoadedMetadata={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = 0;
              }
            }}
          />
        </div>
      </div>

      {/* 右侧：预览结果 */}
      <div className="bg-gray-50 rounded-lg overflow-hidden flex flex-col border border-gray-200">
        {/* 标题栏 */}
        <div className="px-3 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {isGifPreview ? '🎞️ GIF 预览' : '🎬 视频预览'}
          </span>
          {previewPath && !isPreviewing && (
            <span className="text-xs text-green-600 font-medium">✓ 已生成</span>
          )}
          {isPreviewing && (
            <span className="text-xs text-blue-600 font-medium">⏳ {Math.round(previewProgress)}%</span>
          )}
        </div>
        {/* 预览区域 */}
        <div className="flex-1 bg-gray-100 overflow-hidden relative">
          {isPreviewing ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-3"></div>
                <p className="text-sm text-gray-700">生成预览中...</p>
                <p className="text-xs text-gray-500 mt-1">{Math.round(previewProgress)}%</p>
              </div>
            </div>
          ) : previewPath ? (
            isGifPreview ? (
              <img
                key={previewKey}
                src={previewUrl}
                alt="GIF 预览"
                className="absolute inset-0 w-full h-full object-contain"
              />
            ) : (
              <video
                ref={previewRef}
                key={previewKey}
                src={previewUrl}
                controls
                className="absolute inset-0 w-full h-full object-contain"
                onLoadedMetadata={() => {
                  console.log('✅ 预览视频加载成功');
                  if (previewRef.current) {
                    previewRef.current.currentTime = 0;
                  }
                }}
                onError={(e) => {
                  console.error('❌ 预览视频加载失败:', {
                    src: previewUrl,
                    error: e,
                    errorCode: previewRef.current?.error?.code,
                    errorMessage: previewRef.current?.error?.message
                  });
                }}
                onLoadStart={() => {
                  console.log('📹 预览视频开始加载:', previewUrl);
                }}
              />
            )
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="text-4xl mb-3">👁️</div>
                <p className="text-sm">点击"生成预览"查看效果</p>
                <p className="text-xs text-gray-400 mt-2">预览将包含音频并保持较高画质</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
