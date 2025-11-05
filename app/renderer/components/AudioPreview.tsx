/**
 * 音频预览组件
 * 显示原视频（可听音频）和音频预览（含波形可视化）
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useToolsStore } from '../store/useToolsStore';

interface AudioPreviewProps {
  className?: string;
}

// 格式化时间（秒 -> MM:SS）
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const AudioPreview: React.FC<AudioPreviewProps> = ({ className = '' }) => {
  const { selectedFile, previewPath, isPreviewing, previewProgress, waveformData: storeWaveformData } = useToolsStore();
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [previewKey, setPreviewKey] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  // 为原视频创建 blob URL（使用 state 而不是 useMemo）
  const [videoSrc, setVideoSrc] = useState<string | undefined>();
  const videoBlobRef = useRef<string | undefined>();
  
  useEffect(() => {
    console.log('🎬 AudioPreview - 更新原视频 blob URL', {
      hasSelectedFile: !!selectedFile,
      hasFile: !!selectedFile?.file,
      tempPath: selectedFile?.tempPath
    });

    // 如果有新文件，创建新的 blob URL
    if (selectedFile?.file) {
      const newBlobUrl = URL.createObjectURL(selectedFile.file);
      console.log('✅ 原视频 blob URL 创建成功:', newBlobUrl);
      
      // 设置新的 blob URL
      videoBlobRef.current = newBlobUrl;
      setVideoSrc(newBlobUrl);
    } else {
      console.warn('⚠️ selectedFile.file 不存在');
      setVideoSrc(undefined);
    }

    // 清理函数：只在文件更改或组件卸载时执行
    return () => {
      if (videoBlobRef.current) {
        console.log('🧹 清理原视频 blob URL:', videoBlobRef.current);
        URL.revokeObjectURL(videoBlobRef.current);
        videoBlobRef.current = undefined;
      }
    };
  }, [selectedFile?.tempPath]); // 使用 tempPath 作为依赖，避免 file 对象变化导致重复创建

  // 同步波形数据从 store
  useEffect(() => {
    console.log('📊 AudioPreview - storeWaveformData 变化:', {
      hasData: !!storeWaveformData,
      length: storeWaveformData?.length || 0,
      data: storeWaveformData
    });
    
    if (storeWaveformData && storeWaveformData.length > 0) {
      console.log('✅ 同步波形数据到组件 state');
      setWaveformData(storeWaveformData);
    } else {
      console.warn('⚠️ storeWaveformData 为空或长度为0，清空波形');
      setWaveformData([]);
    }
  }, [storeWaveformData]);

  // 当预览文件更新时，重新加载
  useEffect(() => {
    if (previewPath) {
      setPreviewKey(prev => prev + 1);
    }
  }, [previewPath]);

  // 为预览音频创建 blob URL 并获取波形数据
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | undefined>();
  const previewBlobRef = useRef<string | undefined>();
  
  useEffect(() => {
    if (!previewPath) {
      if (previewBlobRef.current) {
        URL.revokeObjectURL(previewBlobRef.current);
        previewBlobRef.current = undefined;
      }
      setPreviewBlobUrl(undefined);
      setWaveformData([]);
      return;
    }

    (async () => {
      try {
        console.log('📖 读取音频预览文件:', previewPath);
        const result = await window.api.invoke('file/read-preview', { filePath: previewPath });
        
        if (result && result.buffer) {
          const blob = new Blob([result.buffer], { type: result.mimeType || 'audio/mpeg' });
          const newBlobUrl = URL.createObjectURL(blob);
          
          if (previewBlobRef.current) {
            URL.revokeObjectURL(previewBlobRef.current);
          }
          
          previewBlobRef.current = newBlobUrl;
          setPreviewBlobUrl(newBlobUrl);
          
          console.log('✅ 音频预览加载成功');
        }
      } catch (error) {
        console.error('❌ 读取音频预览失败:', error);
        setPreviewBlobUrl(undefined);
        setWaveformData([]);
      }
    })();
  }, [previewPath]);

  // 绘制波形（包括播放进度指示器）
  const drawWaveform = useCallback((playbackProgress: number = 0) => {
    if (!canvasRef.current || waveformData.length === 0) {
      console.log('⚠️ drawWaveform 跳过：', {
        hasCanvas: !!canvasRef.current,
        waveformLength: waveformData.length
      });
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / waveformData.length;
    const centerY = height / 2;

    // 清空画布
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, width, height);

    // 绘制中线
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // 绘制波形
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#3b82f6');
    gradient.addColorStop(0.5, '#60a5fa');
    gradient.addColorStop(1, '#93c5fd');

    const playedGradient = ctx.createLinearGradient(0, 0, 0, height);
    playedGradient.addColorStop(0, '#1e40af');
    playedGradient.addColorStop(0.5, '#2563eb');
    playedGradient.addColorStop(1, '#3b82f6');

    waveformData.forEach((value, index) => {
      const x = index * barWidth;
      const barHeight = value * (height / 2) * 0.9; // 留10%边距
      const barProgress = (x + barWidth / 2) / width;

      // 根据播放进度使用不同颜色
      ctx.fillStyle = barProgress <= playbackProgress ? playedGradient : gradient;
      ctx.fillRect(x, centerY - barHeight, barWidth - 1, barHeight * 2);
    });

    // 绘制播放进度线
    if (playbackProgress > 0) {
      const x = playbackProgress * width;
      ctx.strokeStyle = '#ef4444'; // 红色指示线
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      // 绘制顶部三角形指示器
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 5, 10);
      ctx.lineTo(x + 5, 10);
      ctx.closePath();
      ctx.fill();
    }
  }, [waveformData]);

  // 初始绘制波形（当波形数据或预览URL变化时）
  useEffect(() => {
    console.log('🎨 AudioPreview - waveformData 或 previewBlobUrl 变化，准备绘制', {
      waveformLength: waveformData.length,
      hasPreviewBlobUrl: !!previewBlobUrl,
      hasCanvas: !!canvasRef.current
    });
    
    // 只有当波形数据存在且预览 URL 也存在（canvas 已渲染）时才绘制
    if (waveformData.length > 0 && previewBlobUrl) {
      // 使用 setTimeout 确保 canvas 元素已经完全渲染到 DOM
      setTimeout(() => {
        if (canvasRef.current) {
          console.log('✅ 开始绘制波形');
          drawWaveform(0);
        } else {
          console.warn('⚠️ canvas ref 不存在，延迟绘制');
        }
      }, 50); // 给 canvas 一点时间渲染
    } else {
      console.log('⚠️ 条件不满足，跳过绘制', {
        hasWaveformData: waveformData.length > 0,
        hasPreviewBlobUrl: !!previewBlobUrl
      });
    }
  }, [waveformData, previewBlobUrl]);

  // 监听音频播放进度并更新波形（依赖 previewBlobUrl 确保音频元素已渲染）
  useEffect(() => {
    // 必须有波形数据和音频预览 URL，才需要设置监听器
    if (!previewBlobUrl || waveformData.length === 0) {
      console.log('⚠️ 音频播放监听器：条件不满足', {
        hasPreviewBlobUrl: !!previewBlobUrl,
        hasWaveformData: waveformData.length > 0
      });
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      console.log('⚠️ 音频播放监听器：audio ref 不存在');
      return;
    }

    console.log('🎧 设置音频播放监听器', {
      hasDuration: audio.duration > 0,
      duration: audio.duration
    });

    const updateProgress = () => {
      if (audio.duration > 0) {
        const progress = audio.currentTime / audio.duration;
        setCurrentTime(audio.currentTime);
        drawWaveform(progress);
      }
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    };

    const handlePlay = () => {
      console.log('▶️ 音频开始播放');
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    };

    const handlePause = () => {
      console.log('⏸️ 音频暂停');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };

    const handleSeeked = () => {
      console.log('⏩ 音频跳转');
      if (audio.duration > 0) {
        const progress = audio.currentTime / audio.duration;
        drawWaveform(progress);
      }
    };

    const handleLoadedMetadata = () => {
      console.log('📊 音频元数据加载完成', { duration: audio.duration });
      setDuration(audio.duration);
      setCurrentTime(0);
      drawWaveform(0);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handlePause);
    audio.addEventListener('seeked', handleSeeked);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    // 重要：如果音频已经加载完成（metadata 已存在），立即初始化
    if (audio.duration > 0) {
      console.log('✅ 音频已加载完成，立即初始化进度显示');
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
      drawWaveform(audio.currentTime / audio.duration);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handlePause);
      audio.removeEventListener('seeked', handleSeeked);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [drawWaveform, previewBlobUrl, waveformData]);

  return (
    <div className={`grid grid-cols-2 gap-4 ${className}`} style={{ height: '480px' }}>
      {/* 左侧：原视频 */}
      <div className="bg-gray-50 rounded-lg overflow-hidden flex flex-col border border-gray-200">
        <div className="px-3 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">📹 原视频</span>
          {selectedFile && (
            <span className="text-xs text-gray-500">
              {selectedFile.probeResult ? `${selectedFile.probeResult.durationSec.toFixed(1)}s` : ''}
            </span>
          )}
        </div>
        <div className="flex-1 bg-gray-100 overflow-hidden relative">
          {videoSrc ? (
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              className="absolute inset-0 w-full h-full object-contain"
              onLoadedMetadata={() => {
                console.log('✅ AudioPreview - 原视频加载成功');
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                }
              }}
              onError={(e) => {
                console.error('❌ AudioPreview - 原视频加载失败:', {
                  src: videoSrc,
                  error: e,
                  errorCode: videoRef.current?.error?.code,
                  errorMessage: videoRef.current?.error?.message
                });
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-2">📹</div>
                <p className="text-sm">原视频加载中...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 右侧：音频预览 */}
      <div className="bg-gray-50 rounded-lg overflow-hidden flex flex-col border border-gray-200">
        <div className="px-3 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">🎵 音频预览</span>
          {previewPath && !isPreviewing && (
            <span className="text-xs text-green-600 font-medium">✓ 已生成</span>
          )}
          {isPreviewing && (
            <span className="text-xs text-blue-600 font-medium">⏳ {Math.round(previewProgress)}%</span>
          )}
        </div>
        <div className="flex-1 bg-gray-100 overflow-hidden relative flex flex-col">
          {isPreviewing ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-3"></div>
                <p className="text-sm text-gray-700">生成音频预览中...</p>
                <p className="text-xs text-gray-500 mt-1">{Math.round(previewProgress)}%</p>
              </div>
            </div>
          ) : previewBlobUrl ? (
            <>
              {/* 波形可视化 */}
              <div className="flex-1 p-4 flex flex-col items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={150}
                  className="w-full h-auto max-h-full rounded shadow-sm cursor-pointer"
                  onClick={(e) => {
                    // 点击波形跳转到对应位置
                    const audio = audioRef.current;
                    if (!audio || audio.duration === 0) return;
                    
                    const rect = canvasRef.current!.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const progress = x / rect.width;
                    audio.currentTime = progress * audio.duration;
                  }}
                />
                {duration > 0 && (
                  <div className="text-xs text-gray-500 mt-2">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                )}
              </div>
              
              {/* 音频播放器 */}
              <div className="p-4 bg-white border-t border-gray-200">
                <audio
                  ref={audioRef}
                  key={previewKey}
                  src={previewBlobUrl}
                  controls
                  className="w-full"
                  onLoadedMetadata={() => {
                    console.log('✅ 音频预览加载成功');
                    if (audioRef.current) {
                      audioRef.current.currentTime = 0;
                    }
                  }}
                  onError={(e) => {
                    console.error('❌ 音频预览加载失败:', e);
                  }}
                />
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="text-4xl mb-3">🎧</div>
                <p className="text-sm">点击"生成预览"查看波形</p>
                <p className="text-xs text-gray-400 mt-2">预览将包含音频和波形可视化</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

