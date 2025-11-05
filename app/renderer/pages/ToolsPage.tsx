/**
 * 工具页面主组件
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useToolsStore } from '../store/useToolsStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useNavigationStore } from '../store/useNavigationStore';
import { DualVideoPreview } from '../components/DualVideoPreview';
import { AudioPreview } from '../components/AudioPreview';
import { RangeSlider } from '../components/RangeSlider';
import { TrimPanel } from '../components/TrimPanel';
import { GifPanel } from '../components/GifPanel';
import { AudioExtractPanel } from '../components/AudioExtractPanel';
import { PreviewBar } from '../components/PreviewBar';
import { Toast } from '../components/Toast';

// localStorage key for temporary output directory
const TEMP_OUTPUT_DIR_KEY = 'ffmpeg-app-temp-output-dir';

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
    isPreviewing,
    previewProgress,
    setSelectedFile,
    setPreviewPath,
    setIsPreviewing,
    setPreviewProgress,
    setWaveformData,
    setOutputDir
  } = useToolsStore();

  // 从设置中获取默认输出目录
  const {
    defaultOutputDir,
    loadSettings
  } = useSettingsStore();

  // 导航功能
  const { navigateTo } = useNavigationStore();

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
    details?: string;
  }>({ show: false, message: '', type: 'info' });

  const [isTransferringFile, setIsTransferringFile] = useState(false);
  const [transferProgress, setTransferProgress] = useState(0);
  const lastLoadedFileName = React.useRef<string>('');
  const [outputFileName, setOutputFileName] = useState('');
  
  // 添加选项卡状态
  const [activeTab, setActiveTab] = useState<'trim' | 'gif' | 'audio'>('trim');

  // 用于追踪是否已经显示过输出目录设置的提示
  const hasShownOutputDirToast = React.useRef(false);

  // 初始化：加载设置和恢复临时输出目录
  useEffect(() => {
    loadSettings();
    
    // 从 localStorage 恢复临时输出目录
    const tempDir = localStorage.getItem(TEMP_OUTPUT_DIR_KEY);
    if (tempDir && !outputDir) {
      console.log('📁 从本地存储恢复输出目录:', tempDir);
      setOutputDir(tempDir);
    }
  }, [loadSettings]);

  // 设置默认输出目录（优先级：临时保存 > 设置中的默认目录）
  useEffect(() => {
    // 只在没有设置输出目录时自动设置
    if (!outputDir && defaultOutputDir) {
      // 优先使用设置中的默认输出目录
      console.log('📁 使用设置中的默认输出目录:', defaultOutputDir);
      setOutputDir(defaultOutputDir);
      
      // 只显示一次提示
      if (!hasShownOutputDirToast.current) {
        hasShownOutputDirToast.current = true;
        setToast({
          show: true,
          message: `输出目录已设置为: ${defaultOutputDir}`,
          type: 'success'
        });
      }
    }
  }, [defaultOutputDir, outputDir, setOutputDir]);

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
      console.log('🔔 收到 tools/events 事件', payload);
      switch (payload.type) {
        case 'preview-start':
          console.log('📹 预览开始');
          setIsPreviewing(true);
          setPreviewProgress(0);
          break;
        case 'preview-progress':
          if (payload.progress) {
            setPreviewProgress(payload.progress.percentage || 0);
          }
          break;
        case 'preview-done':
          console.log('✅ 预览完成', { tempPath: payload.tempPath });
          setIsPreviewing(false);
          setPreviewProgress(100);
          if (payload.tempPath) {
            console.log('🎬 设置预览路径:', payload.tempPath);
            setPreviewPath(payload.tempPath);
          } else {
            console.warn('⚠️ preview-done 事件没有 tempPath');
          }
          setToast({
            show: true,
            message: '预览生成完成',
            type: 'success'
          });
          break;
        case 'preview-error':
          console.error('❌ 预览错误', payload.error);
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
          console.log('🚫 预览已取消');
          setIsPreviewing(false);
          setPreviewProgress(0);
          setToast({
            show: true,
            message: '预览已取消',
            type: 'info'
          });
          break;
        default:
          console.warn('⚠️ 未知的事件类型:', payload.type);
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
    console.log('📁 handleFileSelect 被调用，文件数量:', files.length);
    if (files.length === 0) return;

    const file = files[0];
    if (!file) {
      showToast('请选择文件', 'error');
      return;
    }
    
    console.log('📄 处理文件:', file.name);
    
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
      
      // 只在文件名变化时显示 Toast
      if (lastLoadedFileName.current !== file.name) {
        console.log('显示文件加载 Toast:', file.name);
        console.log('上一次加载的文件:', lastLoadedFileName.current);
        lastLoadedFileName.current = file.name;
        setToast({
          show: true,
          message: `已加载文件: ${file.name}`,
          type: 'success'
        });
      } else {
        console.log('文件已加载，跳过 Toast');
      }
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
    e.stopPropagation(); // 阻止事件冒泡到其他页面
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

  // 生成预览（直接调用，不使用防抖）
  const handlePreviewGeneration = async (type: 'trim' | 'gif' | 'audio') => {
    if (!selectedFile) {
      console.warn('❌ 没有选择文件，无法生成预览');
      return;
    }

    console.log('🎬 开始生成预览', { type, tempPath: selectedFile.tempPath, timeRange });
    
    try {
      if (type === 'trim') {
        console.log('📹 调用 trim/preview');
        const result = await window.api.invoke('tools/trim/preview', {
          input: selectedFile.tempPath,
          range: timeRange,
          previewSeconds: 8,
          scaleHalf: true
        });
        console.log('✅ trim/preview 调用成功', result);
        
        // 手动更新 previewPath 到 store
        if (result && result.previewPath) {
          console.log('📺 更新预览路径到 store:', result.previewPath);
          setPreviewPath(result.previewPath);
        }
      } else if (type === 'gif') {
        console.log('🎞️ 调用 gif/preview');
        const result = await window.api.invoke('tools/gif/preview', {
          input: selectedFile.tempPath,
          range: timeRange,
          fps: gifFps,
          maxWidth: gifMaxWidth,
          dithering: gifDithering
        });
        console.log('✅ gif/preview 调用成功', result);
        
        // 手动更新 previewPath 到 store
        if (result && result.previewPath) {
          console.log('📺 更新预览路径到 store:', result.previewPath);
          setPreviewPath(result.previewPath);
        }
      } else if (type === 'audio') {
        console.log('🎵 调用 audio/preview');
        const result = await window.api.invoke('tools/audio/preview', {
          input: selectedFile.tempPath,
          range: timeRange,
          format: 'mp3'
        });
        console.log('✅ audio/preview 调用成功', result);
        
        // 更新预览路径和波形数据到 store
        if (result && result.previewPath) {
          console.log('📺 更新音频预览路径到 store:', result.previewPath);
          setPreviewPath(result.previewPath);
          if (result.waveformData) {
            console.log('📊 更新波形数据到 store');
            setWaveformData(result.waveformData);
          }
        }
      }
    } catch (error) {
      console.error('❌ 预览生成失败', error);
      setToast({
        show: true,
        message: '预览生成失败',
        type: 'error',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };


  // 导出文件
  const handleExport = async (type: 'trim' | 'gif' | 'audio') => {
    if (!selectedFile || !outputDir) {
      console.warn('❌ 缺少必要参数', { hasSelectedFile: !!selectedFile, hasOutputDir: !!outputDir });
      return;
    }

    try {
      // 生成输出文件名
      const getOutputName = () => {
        if (outputFileName.trim()) {
          return outputFileName.trim();
        }
        
        // 默认文件名基于原文件名和时间范围
        const baseName = selectedFile.file.name.replace(/\.[^/.]+$/, '');
        const start = Math.floor(timeRange.startSec);
        const end = Math.floor(timeRange.endSec);
        
        if (type === 'trim') {
          return `${baseName}_${start}s-${end}s.${trimContainer}`;
        } else if (type === 'gif') {
          return `${baseName}_${start}s-${end}s.gif`;
        } else {
          // 音频
          const ext = audioMode === 'copy' ? 'm4a' : 
            audioCodec === 'libmp3lame' ? 'mp3' :
            audioCodec === 'aac' ? 'aac' :
            audioCodec === 'flac' ? 'flac' :
            audioCodec === 'libopus' ? 'opus' : 'm4a';
          return `${baseName}_${start}s-${end}s.${ext}`;
        }
      };

      const finalOutputName = getOutputName();
      
      console.log('📤 准备导出', { type, tempPath: selectedFile.tempPath, outputDir, outputName: finalOutputName });
      if (type === 'trim') {
        console.log('📤 调用 trim/export', { 
          range: timeRange, 
          mode: trimMode, 
          container: trimContainer,
          startSec: timeRange.startSec,
          endSec: timeRange.endSec,
          duration: timeRange.endSec - timeRange.startSec
        });
        // 转换 audio 参数为 AudioPolicy 对象
        const audioPolicy = trimAudio === 'copy' 
          ? { mode: 'copy' as const }
          : { 
              mode: 'encode' as const,
              codec: 'aac' as const,
              bitrateK: 128
            };
        
        // 无损快剪可能失败回退到精准剪，所以即使选择无损也要提供 videoCodec 作为备选
        await window.api.invoke('tools/trim/export', {
          input: selectedFile.tempPath,
          range: timeRange,
          mode: trimMode,
          container: trimContainer,
          videoCodec: trimMode === 'precise' ? trimVideoCodec : trimVideoCodec, // 总是提供 videoCodec
          audio: audioPolicy,
          outputDir,
          outputName: finalOutputName
        });
      } else if (type === 'gif') {
        await window.api.invoke('tools/gif/export', {
          input: selectedFile.tempPath,
          range: timeRange,
          fps: gifFps,
          maxWidth: gifMaxWidth,
          dithering: gifDithering,
          outputDir,
          outputName: finalOutputName
        });
      } else if (type === 'audio') {
        await window.api.invoke('tools/audio/extract', {
          input: selectedFile.tempPath,
          range: timeRange,
          mode: audioMode,
          codec: audioMode === 'encode' ? audioCodec : undefined,
          bitrateK: audioMode === 'encode' && audioCodec !== 'flac' ? audioBitrate : undefined,
          outputDir,
          outputName: finalOutputName
        });
      }

      console.log('✅ 导出成功');
      setToast({
        show: true,
        message: '文件导出成功',
        type: 'success'
      });
    } catch (error) {
      console.error('❌ 导出失败', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('错误详情:', errorMsg);
      setToast({
        show: true,
        message: '文件导出失败',
        type: 'error',
        details: errorMsg
      });
      throw error; // 重新抛出以便上层捕获
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
        const selectedDir = result.filePaths[0];
        setOutputDir(selectedDir);
        
        // 保存到 localStorage
        localStorage.setItem(TEMP_OUTPUT_DIR_KEY, selectedDir);
        console.log('💾 已保存输出目录到本地存储:', selectedDir);
        
        setToast({
          show: true,
          message: `输出目录已设置为: ${selectedDir}`,
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

  // 将当前输出目录设为默认
  const handleSetAsDefault = async () => {
    if (!outputDir) {
      setToast({
        show: true,
        message: '请先选择输出目录',
        type: 'error'
      });
      return;
    }

    try {
      await window.api.invoke('settings/set', { defaultOutputDir: outputDir });
      setToast({
        show: true,
        message: '已设置为默认输出目录',
        type: 'success'
      });
    } catch (error) {
      setToast({
        show: true,
        message: '设置默认目录失败',
        type: 'error',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  // 处理预览按钮点击
  const handlePreview = async () => {
    console.log('🔍 点击生成预览按钮', { activeTab, selectedFile: !!selectedFile, isPreviewing, timeRange });
    if (!selectedFile) {
      console.warn('❌ 没有选择文件');
      showToast('请先选择视频文件', 'error');
      return;
    }
    try {
      if (activeTab === 'trim') {
        await handlePreviewGeneration('trim');
      } else if (activeTab === 'gif') {
        await handlePreviewGeneration('gif');
      } else if (activeTab === 'audio') {
        await handlePreviewGeneration('audio');
      }
    } catch (error) {
      console.error('❌ 预览失败:', error);
      showToast('预览生成失败', 'error');
    }
  };

  // 处理导出按钮点击
  const handleExportClick = async () => {
    console.log('🔍 点击导出文件', { 
      activeTab, 
      selectedFile: !!selectedFile, 
      outputDir, 
      timeRange,
      trimMode,
      trimContainer,
      trimAudio
    });
    if (!selectedFile) {
      console.warn('❌ 没有选择文件');
      return;
    }
    if (!outputDir) {
      console.warn('❌ 没有设置输出目录');
      return;
    }
    try {
      await handleExport(activeTab);
    } catch (error) {
      console.error('导出失败:', error);
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
            onClick={() => document.getElementById('tools-file-input')?.click()}
          >
            <input
              id="tools-file-input"
              type="file"
              accept="video/*,.mkv,.avi,.flv,.webm,.m4v,.3gp"
              onChange={handleFileInput}
              className="hidden"
            />
            <div className="text-4xl mb-4">📁</div>
            <p className="text-lg text-gray-600 mb-2">
              {selectedFile ? `已选择: ${selectedFile.file.name}` : '点击或拖拽选择视频文件'}
            </p>
            {isTransferringFile && (
              <div className="mt-2">
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${transferProgress}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  上传中... {transferProgress}%
                </div>
              </div>
            )}
            <p className="text-sm text-gray-500">支持 MP4、MKV、AVI、MOV 等格式</p>
          </div>
          {/* 清空按钮 */}
          {selectedFile && !isTransferringFile && (
            <div className="mt-2 text-right">
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (selectedFile?.tempPath) {
                    try {
                      await window.api.invoke('file/cleanup-temp', { tempPath: selectedFile.tempPath });
                    } catch (error) {
                      console.warn('清理临时文件失败:', error);
                    }
                  }
                  setSelectedFile(null);
                }}
                className="text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                清空已选择的文件
              </button>
            </div>
          )}
        </div>

        {/* 输出目录选择 */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">输出目录:</label>
            <div className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm">
              {outputDir || '未设置'}
            </div>
            <button
              onClick={handleSelectOutputDir}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              选择目录
            </button>
            {outputDir && (
              <button
                onClick={handleSetAsDefault}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors whitespace-nowrap"
                title="将当前目录设为默认输出目录"
              >
                设为默认
              </button>
            )}
          </div>
          {!defaultOutputDir && (
            <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
              <span>💡</span>
              <span>提示：可以在<button onClick={() => navigateTo('settings')} className="text-blue-500 hover:underline">设置页</button>配置默认输出目录</span>
            </div>
          )}
        </div>

        {/* 预览组件（根据选项卡显示不同的预览） */}
        <div className="mb-6">
          {(activeTab === 'trim' || activeTab === 'gif') && <DualVideoPreview />}
          {activeTab === 'audio' && <AudioPreview />}
        </div>

        {/* 时间范围选择 */}
        <div className="mb-6">
          <RangeSlider />
        </div>

        {/* 选项卡切换按钮 */}
        <div className="mb-6">
          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
            <button
              onClick={() => setActiveTab('trim')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'trim' 
                  ? 'bg-blue-500 text-white shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              视频裁剪
            </button>
            <button
              onClick={() => setActiveTab('gif')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'gif' 
                  ? 'bg-blue-500 text-white shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              GIF 制作
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'audio' 
                  ? 'bg-blue-500 text-white shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              音频提取
            </button>
          </div>
        </div>

        {/* 操作按钮1（在选项卡下） */}
        {selectedFile && (
          <div className="mb-6 flex gap-3">
            <button
              onClick={handlePreview}
              disabled={isPreviewing}
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
            <button
              onClick={handleExportClick}
              disabled={!outputDir || isPreviewing}
              className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
                !outputDir || isPreviewing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              导出文件
            </button>
          </div>
        )}

        {/* 工具面板（根据选项卡显示对应的面板） */}
        <div className="mb-6">
          {activeTab === 'trim' && <TrimPanel />}
          {activeTab === 'gif' && <GifPanel />}
          {activeTab === 'audio' && <AudioExtractPanel />}
        </div>

        {/* 操作按钮2（在工具面板下） */}
        {selectedFile && (
          <div className="mb-6 flex gap-3">
            <button
              onClick={handlePreview}
              disabled={isPreviewing}
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
            <button
              onClick={handleExportClick}
              disabled={!outputDir || isPreviewing}
              className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
                !outputDir || isPreviewing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              导出文件
            </button>
          </div>
        )}

        {/* 输出目录提示 */}
        {!outputDir && (
          <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="text-sm text-yellow-800">
              ⚠️ 请先设置输出目录
            </div>
          </div>
        )}

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
