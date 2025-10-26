import React, { useState, useCallback } from 'react';
import { FileDropZone } from '../components/FileDropZone';
import { CodecSelector } from '../components/CodecSelector';
import { PresetPicker } from '../components/PresetPicker';
import { AudioOptions } from '../components/AudioOptions';
import { JobQueueTable } from '../components/JobQueueTable';
import { useJobsStore } from '../store/useJobsStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { t, formatFileSize, formatDuration } from '../i18n';
import { TranscodeOptions, AudioPolicy, Container, VideoCodec, ProbeResult, PresetName, VideoPreset } from '../../shared/types';

/**
 * 文件信息接口
 */
interface FileInfo {
  file: File;
  probeResult?: ProbeResult;
  error?: string;
  tempPath?: string; // 临时文件路径
  transferProgress?: number; // 传输进度 0-100
  isTransferring?: boolean; // 是否正在传输
}

/**
 * 获取预设参数
 */
function getPresetArgs(presetName: string, codec: VideoCodec): string[] {
  const preset = presetName as PresetName;
  
  switch (preset) {
    case 'hq_slow':
      if (codec === 'libx264') return ['-preset', 'slow', '-crf', '18'];
      if (codec === 'libx265') return ['-preset', 'slow', '-crf', '20'];
      if (codec === 'h264_videotoolbox') return ['-allow_sw', '1', '-rc:v', 'VBR', '-cq:v', '19', '-b:v', '0'];
      if (codec === 'hevc_videotoolbox') return ['-allow_sw', '1', '-rc:v', 'VBR', '-cq:v', '22', '-b:v', '0'];
      return ['-crf', '23'];
    case 'balanced':
      if (codec === 'libx264') return ['-preset', 'medium', '-crf', '23'];
      if (codec === 'libx265') return ['-preset', 'medium', '-crf', '25'];
      if (codec === 'h264_videotoolbox') return ['-allow_sw', '1', '-rc:v', 'VBR', '-cq:v', '22', '-b:v', '0'];
      if (codec === 'hevc_videotoolbox') return ['-allow_sw', '1', '-rc:v', 'VBR', '-cq:v', '25', '-b:v', '0'];
      return ['-crf', '23'];
    case 'fast_small':
      if (codec === 'libx264') return ['-preset', 'fast', '-crf', '28'];
      if (codec === 'libx265') return ['-preset', 'fast', '-crf', '30'];
      if (codec === 'h264_videotoolbox') return ['-allow_sw', '1', '-rc:v', 'VBR', '-cq:v', '25', '-b:v', '0'];
      if (codec === 'hevc_videotoolbox') return ['-allow_sw', '1', '-rc:v', 'VBR', '-cq:v', '28', '-b:v', '0'];
      return ['-crf', '28'];
    default:
      return [];
  }
}

/**
 * 压缩核心页面
 */
export function CompressPage() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [outputDir, setOutputDir] = useState<string>('');
  const [outputFileName, setOutputFileName] = useState<string>(''); // 新增输出文件名
  const [container, setContainer] = useState<Container>('mp4');
  const [videoCodec, setVideoCodec] = useState<VideoCodec | 'auto'>('auto');
  const [preset, setPreset] = useState<string>('balanced');
  const [audio, setAudio] = useState<AudioPolicy>({ mode: 'copy' });
  const [subtitleMode, setSubtitleMode] = useState<'none' | 'soft' | 'burn'>('none');
  const [subtitleFile, setSubtitleFile] = useState<string>('');
  
  const { 
    isProcessing, 
    gpuInfo, 
    addJob, 
    startQueue,
    clearQueue: clearCompressionQueue,
    detectGPU
  } = useJobsStore();
  
  const { 
    defaultOutputDir, 
    loadSettings 
  } = useSettingsStore();

  // 初始化
  React.useEffect(() => {
    loadSettings();
    detectGPU();
  }, [loadSettings, detectGPU]);

  // 设置默认输出目录
  React.useEffect(() => {
    if (defaultOutputDir && !outputDir) {
      setOutputDir(defaultOutputDir);
    }
  }, [defaultOutputDir, outputDir]);

  // 处理文件选择
  const handleFilesSelected = useCallback(async (selectedFiles: File[]) => {
    console.log('📁 收到文件:', selectedFiles.length, '个文件');
    
    for (const file of selectedFiles) {
      console.log('📄 处理文件:', file.name, '类型:', file.type, '大小:', formatFileSize(file.size));
      
      const fileInfo: FileInfo = { 
        file,
        isTransferring: true,
        transferProgress: 0
      };
      
      // 先添加到列表显示进度
      setFiles(prev => [...prev, fileInfo]);
      
      try {
        // 将文件保存到临时目录
        console.log('💾 保存文件到临时目录...');
        
        // 使用File API复制文件到主进程，采用分块传输避免数组长度限制
        const fileBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(fileBuffer);
        
        // 分块传输以避免数组长度限制（每个chunk限制较小以避免内存问题）
        const maxChunkSize = 10 * 1024 * 1024; // 10MB chunks，避免数组长度限制同时提高效率
        let tempPath = '';
        
        for (let offset = 0; offset < uint8Array.length; offset += maxChunkSize) {
          const end = Math.min(offset + maxChunkSize, uint8Array.length);
          const chunk = uint8Array.slice(offset, end);
          
          // 使用循环转换为数组，避免Array.from的大数组限制
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
          setFiles((prev) => {
            const updated = [...prev];
            const index = updated.findIndex(f => 
              f.file.name === file.name && f.file.size === file.size
            );
            if (index >= 0) {
              updated[index] = { 
                ...updated[index], 
                transferProgress: progress,
                isTransferring: end < uint8Array.length
              };
            }
            return updated;
          });
          
          console.log(`📦 传输进度: ${end}/${uint8Array.length} (${progress}%)`);
        }
        
        console.log('✅ 临时文件已保存:', tempPath);
        
        // 使用临时路径进行探测
        console.log('🔍 开始探测文件信息...');
        const probeResult = await window.api.invoke('ffmpeg/probe', {
          input: tempPath
        });
        
        console.log('✅ 探测完成:', probeResult);
        
        // 更新文件信息（包括probeResult和tempPath）
        setFiles((prev) => {
          const updated = [...prev];
          const index = updated.findIndex(f => 
            f.file.name === file.name && f.file.size === file.size
          );
          if (index >= 0) {
            updated[index] = { 
              ...updated[index],
              probeResult,
              tempPath,
              isTransferring: false,
              transferProgress: 100
            };
          }
          return updated;
        });
        
        console.log('文件探测完成:', file.name, formatFileSize(file.size));
      } catch (error) {
        console.error('❌ 文件探测失败:', file.name, error);
        
        // 显示详细错误信息给用户
        if (error instanceof Error) {
          console.error('错误详情:', error.message);
          if (error.stack) {
            console.error('错误堆栈:', error.stack);
          }
        }
        
        // 更新错误信息
        setFiles((prev) => {
          const updated = [...prev];
          const index = updated.findIndex(f => 
            f.file.name === file.name && f.file.size === file.size
          );
          if (index >= 0) {
            updated[index] = { 
              ...updated[index],
              error: error instanceof Error ? error.message : '探测失败',
              isTransferring: false
            };
          }
          return updated;
        });
      }
    }
    
    console.log('📊 文件添加完成');
  }, []);

  // 移除文件
  const handleRemoveFile = useCallback(async (index: number) => {
    const fileToRemove = files[index];
    
    // 清理临时文件
    if (fileToRemove?.tempPath) {
      try {
        await window.api.invoke('file/cleanup-temp', {
          tempPath: fileToRemove.tempPath
        });
      } catch (error) {
        console.warn('清理临时文件失败:', error);
      }
    }
    
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, [files]);

  // 选择输出目录
  const handleSelectOutputDir = useCallback(async () => {
    try {
      const result = await window.api.invoke('dialog/select-output-dir');
      if (!result.canceled && result.filePaths.length > 0) {
        setOutputDir(result.filePaths[0]);
      }
    } catch (error) {
      console.error('选择输出目录失败:', error);
      (window as any).showToast?.(t('error.invalidOutput'), 'error');
    }
  }, []);

  // 选择字幕文件
  const handleSelectSubtitleFile = useCallback(async () => {
    try {
      const result = await window.api.invoke('dialog/select-subtitle');
      if (!result.canceled && result.filePaths.length > 0) {
        setSubtitleFile(result.filePaths[0]);
      }
    } catch (error) {
      console.error('选择字幕文件失败:', error);
      (window as any).showToast?.(t('error.invalidInput'), 'error');
    }
  }, []);

  // 检查是否有文件正在传输
  const hasTransferringFiles = files.some(f => f.isTransferring === true);

  // 开始压缩
  const handleStartCompression = useCallback(async () => {
    if (files.length === 0) {
      (window as any).showToast?.(t('compress.addFiles'), 'warning');
      return;
    }

    if (!outputDir) {
      (window as any).showToast?.(t('compress.selectOutputDir'), 'warning');
      return;
    }

    // 检查是否有文件正在传输
    if (hasTransferringFiles) {
      (window as any).showToast?.('请等待文件传输完成', 'warning');
      return;
    }

    try {
      // 为每个文件创建任务
      for (const fileInfo of files) {
        if (!fileInfo.tempPath) {
          console.warn('文件缺少临时路径，跳过:', fileInfo.file.name);
          continue;
        }

        const actualCodec = videoCodec === 'auto' ? 'libx264' : videoCodec;
        const presetArgs = getPresetArgs(preset, actualCodec);
        
        const options: TranscodeOptions = {
          input: fileInfo.tempPath, // 使用临时路径
          outputDir,
          outputName: outputFileName || undefined, // 添加输出文件名
          container,
          videoCodec: actualCodec,
          videoPreset: {
            name: preset as PresetName,
            args: presetArgs
          },
          audio,
          fastStart: container === 'mp4'
        };

        await addJob(options);
      }

      // 开始处理队列
      await startQueue();
      
      (window as any).showToast?.(t('compress.startQueue'), 'success');
    } catch (error) {
      console.error('开始压缩失败:', error);
      (window as any).showToast?.(error instanceof Error ? error.message : t('error.unknown'), 'error');
    }
  }, [files, outputDir, container, videoCodec, preset, audio, addJob, startQueue, hasTransferringFiles]);

  // 清空已选择的文件列表
  const handleClearFiles = useCallback(async () => {
    // 清理所有临时文件
    for (const fileInfo of files) {
      if (fileInfo.tempPath) {
        try {
          await window.api.invoke('file/cleanup-temp', {
            tempPath: fileInfo.tempPath
          });
        } catch (error) {
          console.warn('清理临时文件失败:', error);
        }
      }
    }
    setFiles([]);
  }, [files]);
  
  // 清空压缩任务队列
  const handleClearQueue = useCallback(async () => {
    try {
      await clearCompressionQueue();
      (window as any).showToast?.('任务队列已清空', 'success');
    } catch (error) {
      console.error('清空队列失败:', error);
      (window as any).showToast?.('清空队列失败', 'error');
    }
  }, [clearCompressionQueue]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('compress.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            选择视频文件，配置压缩参数，开始批量处理
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧：文件选择和配置 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 文件选择区域 */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">{t('compress.addFiles')}</h2>
              </div>
              <div className="card-content">
                <FileDropZone
                  onFilesSelected={handleFilesSelected}
                  disabled={isProcessing}
                />
                
                {/* 已选择的文件列表 */}
                {files.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300">
                        已选择文件 ({files.length})
                      </h3>
                      <button
                        onClick={handleClearFiles}
                        disabled={isProcessing}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        清空
                      </button>
                    </div>
                    {files.map((fileInfo, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {fileInfo.file.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(fileInfo.file.size)}
                            {fileInfo.probeResult && (
                              <span className="ml-2">
                                • {formatDuration(fileInfo.probeResult.durationSec)}
                                {fileInfo.probeResult.width && fileInfo.probeResult.height && (
                                  <span> • {fileInfo.probeResult.width}×{fileInfo.probeResult.height}</span>
                                )}
                              </span>
                            )}
                          </div>
                          {fileInfo.isTransferring && (
                            <div className="mt-2">
                              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 transition-all duration-300"
                                  style={{ width: `${fileInfo.transferProgress || 0}%` }}
                                />
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                传输中... {fileInfo.transferProgress || 0}%
                              </div>
                            </div>
                          )}
                          {fileInfo.error && (
                            <div className="text-xs text-red-500 mt-1">
                              {fileInfo.error}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveFile(index)}
                          disabled={isProcessing || fileInfo.isTransferring}
                          className="btn btn-sm btn-ghost text-red-500 hover:text-red-700"
                        >
                          移除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 压缩配置 */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">{t('settings.title')}</h2>
              </div>
              <div className="card-content space-y-6">
                {/* 视频设置 */}
                <div>
                  <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-4">
                    {t('settings.video')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 编码器选择 */}
                    <CodecSelector
                      value={videoCodec}
                      onChange={setVideoCodec}
                      gpuInfo={gpuInfo}
                      disabled={isProcessing}
                    />
                    
                    {/* 容器格式 */}
                    <div className="space-y-2">
                      <label className="label">容器格式</label>
                      <div className="flex space-x-4">
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="container"
                            value="mp4"
                            checked={container === 'mp4'}
                            onChange={(e) => setContainer(e.target.value as Container)}
                            disabled={isProcessing}
                            className="text-primary"
                          />
                          <span className="text-sm">{t('container.mp4')}</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="container"
                            value="mkv"
                            checked={container === 'mkv'}
                            onChange={(e) => setContainer(e.target.value as Container)}
                            disabled={isProcessing}
                            className="text-primary"
                          />
                          <span className="text-sm">{t('container.mkv')}</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  {/* 预设选择 */}
                  <div className="mt-4">
                    <PresetPicker
                      value={preset}
                      onChange={(preset) => setPreset(preset)}
                      disabled={isProcessing}
                    />
                  </div>
                </div>

                {/* 音频设置 */}
                <div>
                  <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-4">
                    {t('settings.audio')}
                  </h3>
                  <AudioOptions
                    value={audio}
                    onChange={setAudio}
                    disabled={isProcessing}
                  />
                </div>

                {/* 字幕设置 */}
                <div>
                  <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-4">
                    {t('settings.subtitle')}
                  </h3>
                  <div className="space-y-4">
                    <div className="flex space-x-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="subtitleMode"
                          value="none"
                          checked={subtitleMode === 'none'}
                          onChange={(e) => setSubtitleMode(e.target.value as any)}
                          disabled={isProcessing}
                          className="text-primary"
                        />
                        <span className="text-sm">{t('subtitle.none')}</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="subtitleMode"
                          value="soft"
                          checked={subtitleMode === 'soft'}
                          onChange={(e) => setSubtitleMode(e.target.value as any)}
                          disabled={isProcessing}
                          className="text-primary"
                        />
                        <span className="text-sm">{t('subtitle.soft')}</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="subtitleMode"
                          value="burn"
                          checked={subtitleMode === 'burn'}
                          onChange={(e) => setSubtitleMode(e.target.value as any)}
                          disabled={isProcessing}
                          className="text-primary"
                        />
                        <span className="text-sm">{t('subtitle.burn')}</span>
                      </label>
                    </div>
                    
                    {(subtitleMode === 'soft' || subtitleMode === 'burn') && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={subtitleFile}
                          onChange={(e) => setSubtitleFile(e.target.value)}
                          placeholder="字幕文件路径"
                          disabled={isProcessing}
                          className="input flex-1"
                        />
                        <button
                          onClick={handleSelectSubtitleFile}
                          disabled={isProcessing}
                          className="btn btn-outline"
                        >
                          选择
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 输出设置 */}
                <div>
                  <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-4">
                    {t('settings.output')}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={outputDir}
                        onChange={(e) => setOutputDir(e.target.value)}
                        placeholder="输出目录"
                        disabled={isProcessing}
                        className="input flex-1"
                      />
                      <button
                        onClick={handleSelectOutputDir}
                        disabled={isProcessing}
                        className="btn btn-outline"
                      >
                        {t('compress.selectOutputDir')}
                      </button>
                    </div>
                    {/* 输出文件名 */}
                    <div>
                      <label className="label text-xs">输出文件名 (可选)</label>
                      <input
                        type="text"
                        value={outputFileName}
                        onChange={(e) => setOutputFileName(e.target.value)}
                        placeholder="留空则自动使用输入文件名"
                        disabled={isProcessing}
                        className="input"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：任务队列 */}
          <div className="lg:col-span-1">
            <div className="card">
              <div className="card-header">
                <div className="flex items-center justify-between">
                  <h2 className="card-title">{t('queue.title')}</h2>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleStartCompression}
                      disabled={isProcessing || files.length === 0 || hasTransferringFiles}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-lg flex items-center space-x-2"
                    >
                      <span className="text-lg">🚀</span>
                      <span>{hasTransferringFiles ? '文件传输中...' : t('compress.startQueue')}</span>
                    </button>
                    <button
                      onClick={handleClearQueue}
                      disabled={isProcessing}
                      className="px-4 py-3 border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('compress.clearQueue')}
                    </button>
                  </div>
                </div>
              </div>
              <div className="card-content">
                <JobQueueTable />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
