/**
 * 工具页面主组件
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useToolsStore } from '../store/useToolsStore';
import { DualVideoPreview } from '../components/DualVideoPreview';
import { RangeSlider } from '../components/RangeSlider';
import { TrimPanel } from '../components/TrimPanel';
import { GifPanel } from '../components/GifPanel';
import { AudioExtractPanel } from '../components/AudioExtractPanel';
import { PreviewBar } from '../components/PreviewBar';
import { Toast } from '../components/Toast';
import { useDebouncedCallback } from '../hooks/useDebouncedValue';

export const ToolsPage: React.FC = () => {
  const {
    selectedFile,
    timeRange,
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
    outputDir,
    setSelectedFile,
    setPreviewPath,
    setIsPreviewing,
    setPreviewProgress,
    setOutputDir
  } = useToolsStore();

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
    details?: string;
  }>({ show: false, message: '', type: 'info' });

  const [isTransferringFile, setIsTransferringFile] = useState(false);
  const [transferProgress, setTransferProgress] = useState(0);

  // 显示提示
  const showToast = (message: string, type: 'info' | 'error' | 'success' | 'warning') => {
    setToast({
      show: true,
      message,
      type: type as 'success' | 'error' | 'info'
    });
  };

  // 监听工具事件
  useEffect(() => {
    const handleToolsEvent = (payload: any) => {
      switch (payload.type) {
        case 'preview-start':
          setIsPreviewing(true);
          setPreviewProgress(0);
          break;
        case 'preview-progress':
          if (payload.progress) {
            setPreviewProgress(payload.progress.percentage || 0);
          }
          break;
        case 'preview-done':
          setIsPreviewing(false);
          setPreviewProgress(100);
          if (payload.tempPath) {
            setPreviewPath(payload.tempPath);
          }
          setToast({
            show: true,
            message: '预览生成完成',
            type: 'success'
          });
          break;
        case 'preview-error':
          setIsPreviewing(false);
          setPreviewProgress(0);
          setToast({
            show: true,
            message: '预览生成失败',
            type: 'error',
            details: payload.error
          });
          break;
        case 'preview-cancelled':
          setIsPreviewing(false);
          setPreviewProgress(0);
          setToast({
            show: true,
            message: '预览已取消',
            type: 'info'
          });
          break;
      }
    };

    const unsubscribe = window.api.on('tools/events', handleToolsEvent);

    // 组件卸载时清理事件监听
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [setIsPreviewing, setPreviewProgress, setPreviewPath]);

  // 处理文件选择
  const handleFileSelect = async (files: FileList) => {
    if (files.length === 0) return;

    const file = files[0];
    if (!file) {
      showToast('请选择文件', 'error');
      return;
    }
    
    try {
      setIsTransferringFile(true);
      setTransferProgress(0);
      
      // 使用分块传输避免大文件数组长度限制
      const fileBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(fileBuffer);
      
      const maxChunkSize = 10 * 1024 * 1024; // 10MB chunks
      let tempPath = '';
      
      for (let offset = 0; offset < uint8Array.length; offset += maxChunkSize) {
        const end = Math.min(offset + maxChunkSize, uint8Array.length);
        const chunk = uint8Array.slice(offset, end);
        
        // 使用循环转换为数组，避免 Array.from 的大数组限制
        const chunkArray: number[] = new Array(chunk.length);
        for (let i = 0; i < chunk.length; i++) {
          chunkArray[i] = chunk[i];
        }
        
        const isFirstChunk = offset === 0;
        const isLastChunk = end >= uint8Array.length;
        
        const result = await window.api.invoke('file/save-temp-chunk', {
          fileData: chunkArray,
          fileName: file.name,
          isFirstChunk,
          isLastChunk
        });
        
        if (isFirstChunk || !tempPath) {
          tempPath = result.tempPath;
        }
        
        // 更新传输进度
        const progress = Math.round((end / uint8Array.length) * 100);
        setTransferProgress(progress);
      }

      // 获取媒体信息
      const probeResult = await window.api.invoke('ffmpeg/probe', { input: tempPath });

      const fileInfo = {
        file: file!,
        tempPath,
        probeResult
      };

      setSelectedFile(fileInfo);
      setIsTransferringFile(false);
      setTransferProgress(100);
      
      setToast({
        show: true,
        message: `已加载文件: ${file.name}`,
        type: 'success'
      });
    } catch (error) {
      setIsTransferringFile(false);
      setTransferProgress(0);
      
      setToast({
        show: true,
        message: '文件加载失败',
        type: 'error',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  // 处理拖拽
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  // 处理文件输入
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleFileSelect(files);
    }
  };

  // 生成预览（防抖版本）
  const _handlePreviewDebounced = useDebouncedCallback(async (type: 'trim' | 'gif') => {
    if (!selectedFile) return;

    try {
      if (type === 'trim') {
        await window.api.invoke('tools/trim/preview', {
          input: selectedFile.tempPath,
          range: timeRange,
          previewSeconds: 8,
          scaleHalf: true
        });
      } else if (type === 'gif') {
        await window.api.invoke('tools/gif/preview', {
          input: selectedFile.tempPath,
          range: timeRange,
          fps: gifFps,
          maxWidth: gifMaxWidth,
          dithering: gifDithering
        });
      }
    } catch (error) {
      setToast({
        show: true,
        message: '预览生成失败',
        type: 'error',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }, 400); // 400ms 防抖


  // 导出文件
  const handleExport = async (type: 'trim' | 'gif' | 'audio') => {
    if (!selectedFile || !outputDir) return;

    try {
      if (type === 'trim') {
        await window.api.invoke('tools/trim/export', {
          input: selectedFile.tempPath,
          range: timeRange,
          mode: trimMode,
          container: trimContainer,
          videoCodec: trimMode === 'precise' ? trimVideoCodec : undefined,
          audio: trimAudio,
          outputDir,
          outputName: `trimmed_${Date.now()}.${trimContainer}`
        });
      } else if (type === 'gif') {
        await window.api.invoke('tools/gif/export', {
          input: selectedFile.tempPath,
          range: timeRange,
          fps: gifFps,
          maxWidth: gifMaxWidth,
          dithering: gifDithering,
          outputDir,
          outputName: `gif_${Date.now()}.gif`
        });
      } else if (type === 'audio') {
        await window.api.invoke('tools/audio/extract', {
          input: selectedFile.tempPath,
          range: timeRange,
          mode: audioMode,
          codec: audioMode === 'encode' ? audioCodec : undefined,
          bitrateK: audioMode === 'encode' && audioCodec !== 'flac' ? audioBitrate : undefined,
          outputDir,
          outputName: `audio_${Date.now()}.${audioMode === 'copy' ? 'm4a' : 
            audioCodec === 'libmp3lame' ? 'mp3' :
            audioCodec === 'aac' ? 'aac' :
            audioCodec === 'flac' ? 'flac' :
            audioCodec === 'libopus' ? 'opus' : 'm4a'}`
        });
      }

      setToast({
        show: true,
        message: '文件导出成功',
        type: 'success'
      });
    } catch (error) {
      setToast({
        show: true,
        message: '文件导出失败',
        type: 'error',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  // 取消预览
  const handleCancel = async () => {
    try {
      await window.api.invoke('tools/preview/cancel', {});
    } catch (error) {
      setToast({
        show: true,
        message: '取消失败',
        type: 'error',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  // 选择输出目录
  const handleSelectOutputDir = async () => {
    try {
      const result = await window.api.invoke('dialog/select-output-dir', {});
      if (result && result.filePaths && result.filePaths.length > 0) {
        setOutputDir(result.filePaths[0]);
        setToast({
          show: true,
          message: `输出目录已设置为: ${result.filePaths[0]}`,
          type: 'success'
        });
      }
    } catch (error) {
      setToast({
        show: true,
        message: '选择输出目录失败',
        type: 'error',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">小工具</h1>
          <p className="text-gray-600 mt-2">视频裁剪、GIF 制作、音频提取</p>
        </div>

        {/* 文件选择区域 */}
        <div className="mb-6">
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept="video/*"
              onChange={handleFileInput}
              className="hidden"
            />
            <div className="text-4xl mb-4">📁</div>
            <p className="text-lg text-gray-600 mb-2">
              {selectedFile ? `已选择: ${selectedFile.file.name}` : '点击或拖拽选择视频文件'}
            </p>
            <p className="text-sm text-gray-500">支持 MP4、MKV、AVI、MOV 等格式</p>
          </div>
        </div>

        {/* 输出目录选择 */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">输出目录:</label>
            <div className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md">
              {outputDir || '未设置'}
            </div>
            <button
              onClick={handleSelectOutputDir}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              选择目录
            </button>
          </div>
        </div>

        {/* 双视频预览 */}
        <div className="mb-6">
          <DualVideoPreview />
        </div>

        {/* 时间范围选择 */}
        <div className="mb-6">
          <RangeSlider />
        </div>

        {/* 工具面板 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <TrimPanel />
          <GifPanel />
          <AudioExtractPanel />
        </div>

        {/* 预览操作栏 */}
        <div className="mb-6">
          <PreviewBar
            onPreview={_handlePreviewDebounced}
            onExport={handleExport}
            onCancel={handleCancel}
          />
        </div>

        {/* Toast 通知 */}
        <Toast
          show={toast.show}
          message={toast.message}
          type={toast.type}
          details={toast.details}
          onClose={() => setToast(prev => ({ ...prev, show: false }))}
        />
      </div>
    </div>
  );
};
