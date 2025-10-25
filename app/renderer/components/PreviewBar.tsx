/**
 * 预览操作栏组件
 */

import React, { useState } from 'react';
import { useToolsStore } from '../store/useToolsStore';

interface PreviewBarProps {
  className?: string;
  onPreview: (type: 'trim' | 'gif') => Promise<void>;
  onExport: (type: 'trim' | 'gif' | 'audio') => Promise<void>;
  onCancel: () => Promise<void>;
}

export const PreviewBar: React.FC<PreviewBarProps> = ({ 
  className = '', 
  onPreview, 
  onExport, 
  onCancel 
}) => {
  const { 
    selectedFile, 
    isPreviewing, 
    previewProgress,
    trimMode,
    trimContainer,
    trimVideoCodec,
    trimAudio,
    gifFps,
    gifMaxWidth,
    gifDithering,
    audioMode,
    audioCodec,
    audioBitrate,
    outputDir
  } = useToolsStore();

  const [activeTab, setActiveTab] = useState<'trim' | 'gif' | 'audio'>('trim');

  const handlePreview = async () => {
    if (!selectedFile) return;
    
    try {
      if (activeTab === 'trim') {
        await onPreview('trim');
      } else if (activeTab === 'gif') {
        await onPreview('gif');
      }
    } catch (error) {
      console.error('预览失败:', error);
    }
  };

  const handleExport = async () => {
    if (!selectedFile || !outputDir) return;
    
    try {
      await onExport(activeTab);
    } catch (error) {
      console.error('导出失败:', error);
    }
  };

  const handleCancel = async () => {
    try {
      await onCancel();
    } catch (error) {
      console.error('取消失败:', error);
    }
  };

  if (!selectedFile) {
    return (
      <div className={`p-4 bg-gray-50 rounded-lg ${className}`}>
        <div className="text-center text-gray-500">
          <p>请先选择视频文件</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-white rounded-lg border ${className}`}>
      {/* 工具选择标签 */}
      <div className="flex mb-4">
        <button
          onClick={() => setActiveTab('trim')}
          className={`px-4 py-2 rounded-l-md border ${
            activeTab === 'trim' 
              ? 'bg-blue-500 text-white border-blue-500' 
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          视频裁剪
        </button>
        <button
          onClick={() => setActiveTab('gif')}
          className={`px-4 py-2 border-t border-b ${
            activeTab === 'gif' 
              ? 'bg-blue-500 text-white border-blue-500' 
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          GIF 制作
        </button>
        <button
          onClick={() => setActiveTab('audio')}
          className={`px-4 py-2 rounded-r-md border ${
            activeTab === 'audio' 
              ? 'bg-blue-500 text-white border-blue-500' 
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          音频提取
        </button>
      </div>

      {/* 当前工具配置摘要 */}
      <div className="mb-4 p-3 bg-gray-50 rounded-md">
        <div className="text-sm text-gray-700">
          <div className="font-medium mb-1">当前配置：</div>
          {activeTab === 'trim' && (
            <div className="space-y-1">
              <div>模式: {trimMode === 'lossless' ? '无损快剪' : '精准剪'}</div>
              <div>格式: {trimContainer.toUpperCase()}</div>
              {trimMode === 'precise' && <div>编码器: {trimVideoCodec}</div>}
              <div>音频: {trimAudio === 'copy' ? '复制' : '重编码'}</div>
            </div>
          )}
          {activeTab === 'gif' && (
            <div className="space-y-1">
              <div>帧率: {gifFps} FPS</div>
              <div>最大宽度: {gifMaxWidth}px</div>
              <div>抖动: {gifDithering === 'bayer' ? 'Bayer' : 'Floyd-Steinberg'}</div>
            </div>
          )}
          {activeTab === 'audio' && (
            <div className="space-y-1">
              <div>模式: {audioMode === 'copy' ? '直接复制' : '重新编码'}</div>
              {audioMode === 'encode' && (
                <>
                  <div>编码器: {audioCodec}</div>
                  {audioCodec !== 'flac' && <div>码率: {audioBitrate} kbps</div>}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3">
        {/* 预览按钮 */}
        {activeTab !== 'audio' && (
          <button
            onClick={handlePreview}
            disabled={isPreviewing || !outputDir}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
              isPreviewing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {isPreviewing ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                生成预览中... {Math.round(previewProgress)}%
              </div>
            ) : (
              '生成预览'
            )}
          </button>
        )}

        {/* 导出按钮 */}
        <button
          onClick={handleExport}
          disabled={isPreviewing || !outputDir}
          className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
            isPreviewing || !outputDir
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          导出文件
        </button>

        {/* 取消按钮 */}
        {isPreviewing && (
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-md font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            取消
          </button>
        )}
      </div>

      {/* 输出目录提示 */}
      {!outputDir && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="text-sm text-yellow-800">
            ⚠️ 请先设置输出目录
          </div>
        </div>
      )}
    </div>
  );
};
