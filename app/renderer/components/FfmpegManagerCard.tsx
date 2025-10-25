/**
 * FFmpeg管理器组件
 */

import React, { useState, useEffect } from 'react';

interface FFmpegLocation {
  found: boolean;
  ffmpeg?: string;
  ffprobe?: string;
  source: 'PATH' | 'which' | 'where' | 'manual';
}

interface FFmpegState {
  managed: boolean;
  active: {
    ffmpeg: string;
    ffprobe: string;
  };
  versions?: Array<{
    name: string;
    path: string;
  }>;
}

interface DownloadProgress {
  taskId: string;
  phase: 'downloading' | 'verifying' | 'extracting' | 'done' | 'error';
  receivedBytes?: number;
  totalBytes?: number;
  percent?: number;
  message?: string;
}

interface FfmpegManagerCardProps {
  ffmpegPath: string;
  ffprobePath: string;
  ffmpegManaged: boolean;
  onFFmpegPathChange: (path: string) => void;
  onFFprobePathChange: (path: string) => void;
  onFFmpegManagedChange: (managed: boolean) => void;
}

export const FfmpegManagerCard: React.FC<FfmpegManagerCardProps> = ({
  ffmpegPath,
  ffprobePath,
  ffmpegManaged,
  onFFmpegPathChange,
  onFFprobePathChange,
  onFFmpegManagedChange
}) => {
  const [ffmpegLocation, setFFmpegLocation] = useState<FFmpegLocation | null>(null);
  const [ffmpegState, setFFmpegState] = useState<FFmpegState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadVersion, setDownloadVersion] = useState('6.1');

  // 检测系统FFmpeg
  const detectSystemFFmpeg = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const location = await window.api.invoke('ffmpeg/locate');
      setFFmpegLocation(location);
    } catch (error) {
      setError(error instanceof Error ? error.message : '检测失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 获取FFmpeg状态
  const getFFmpegState = async () => {
    try {
      const state = await window.api.invoke('ffmpeg/getState');
      setFFmpegState(state);
    } catch (error) {
      console.error('获取FFmpeg状态失败:', error);
    }
  };

  // 选择FFmpeg路径
  const selectFFmpegPath = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.api.invoke('settings/selectFFmpegPath');
      
      if (result.success) {
        onFFmpegPathChange(result.path);
      } else {
        setError(result.error || '选择失败');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '选择失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 选择FFprobe路径
  const selectFFprobePath = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.api.invoke('settings/selectFFprobePath');
      
      if (result.success) {
        onFFprobePathChange(result.path);
      } else {
        setError(result.error || '选择失败');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '选择失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 开始下载FFmpeg
  const startDownload = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const taskId = await window.api.invoke('ffmpeg/download', {
        provider: 'official',
        version: downloadVersion,
        includeProbe: true
      });

      // 监听下载进度
      const unsubscribe = window.api.on('ffmpeg/download-progress', (progress: DownloadProgress) => {
        if (progress.taskId === taskId) {
          setDownloadProgress(progress);
          
          if (progress.phase === 'done') {
            setIsLoading(false);
            getFFmpegState(); // 刷新状态
          } else if (progress.phase === 'error') {
            setIsLoading(false);
            setError(progress.message || '下载失败');
          }
        }
      });

      // 清理监听器
      setTimeout(() => {
        unsubscribe?.();
      }, 300000); // 5分钟后清理

    } catch (error) {
      setError(error instanceof Error ? error.message : '下载失败');
      setIsLoading(false);
    }
  };

  // 取消下载
  const cancelDownload = async () => {
    if (!downloadProgress) return;

    try {
      await window.api.invoke('ffmpeg/cancelDownload', { taskId: downloadProgress.taskId });
      setDownloadProgress(null);
      setIsLoading(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : '取消下载失败');
    }
  };

  // 切换到系统FFmpeg
  const switchToSystem = async () => {
    if (!ffmpegLocation?.found) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.api.invoke('ffmpeg/switch', {
        ffmpegPath: ffmpegLocation.ffmpeg!,
        ffprobePath: ffmpegLocation.ffprobe,
        managed: false
      });

      if (result.ok) {
        onFFmpegPathChange(ffmpegLocation.ffmpeg!);
        if (ffmpegLocation.ffprobe) {
          onFFprobePathChange(ffmpegLocation.ffprobe);
        }
        onFFmpegManagedChange(false);
        getFFmpegState();
      } else {
        setError('切换失败');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '切换失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 组件挂载时获取状态
  useEffect(() => {
    detectSystemFFmpeg();
    getFFmpegState();
  }, []);

  return (
    <div className="ffmpeg-manager-card bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        FFmpeg 管理
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-sm text-red-600">
            {error}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* 当前状态 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            当前状态
          </h4>
          <div className="p-3 bg-gray-50 rounded-md">
            <div className="text-sm">
              <div className="mb-1">
                <strong>FFmpeg:</strong> {ffmpegPath || '未设置'}
              </div>
              <div className="mb-1">
                <strong>FFprobe:</strong> {ffprobePath || '未设置'}
              </div>
              <div>
                <strong>管理方式:</strong> {ffmpegManaged ? '应用托管' : '系统版本'}
              </div>
            </div>
          </div>
        </div>

        {/* 系统检测 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            系统检测
          </h4>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={detectSystemFFmpeg}
              disabled={isLoading}
              className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
            >
              检测系统 FFmpeg
            </button>
          </div>
          
          {ffmpegLocation && (
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="text-sm">
                {ffmpegLocation.found ? (
                  <div>
                    <div className="text-green-600 mb-1">✅ 检测到系统 FFmpeg</div>
                    <div className="mb-1">FFmpeg: {ffmpegLocation.ffmpeg}</div>
                    <div className="mb-2">FFprobe: {ffmpegLocation.ffprobe}</div>
                    <button
                      onClick={switchToSystem}
                      disabled={isLoading}
                      className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
                    >
                      切换到系统版本
                    </button>
                  </div>
                ) : (
                  <div className="text-red-600">❌ 未检测到系统 FFmpeg</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 手动选择 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            手动选择
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={ffmpegPath}
                onChange={(e) => onFFmpegPathChange(e.target.value)}
                placeholder="FFmpeg 路径"
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
              />
              <button
                onClick={selectFFmpegPath}
                disabled={isLoading}
                className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
              >
                选择
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={ffprobePath}
                onChange={(e) => onFFprobePathChange(e.target.value)}
                placeholder="FFprobe 路径"
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
              />
              <button
                onClick={selectFFprobePath}
                disabled={isLoading}
                className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
              >
                选择
              </button>
            </div>
          </div>
        </div>

        {/* 下载托管版本 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            下载托管版本
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm">版本:</label>
              <input
                type="text"
                value={downloadVersion}
                onChange={(e) => setDownloadVersion(e.target.value)}
                placeholder="6.1"
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            
            {downloadProgress ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="text-sm">
                  <div className="mb-1">
                    {downloadProgress.phase === 'downloading' && '下载中...'}
                    {downloadProgress.phase === 'verifying' && '验证中...'}
                    {downloadProgress.phase === 'extracting' && '解压中...'}
                    {downloadProgress.phase === 'done' && '完成'}
                    {downloadProgress.phase === 'error' && '失败'}
                  </div>
                  {downloadProgress.percent !== undefined && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${downloadProgress.percent}%` }}
                      ></div>
                    </div>
                  )}
                  {downloadProgress.message && (
                    <div className="text-xs text-gray-600">{downloadProgress.message}</div>
                  )}
                  {downloadProgress.phase === 'downloading' && (
                    <button
                      onClick={cancelDownload}
                      className="mt-2 px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                    >
                      取消下载
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={startDownload}
                disabled={isLoading}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                下载托管版本
              </button>
            )}
          </div>
        </div>

        {/* 托管版本列表 */}
        {ffmpegState && ffmpegState.versions && ffmpegState.versions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              托管版本 ({ffmpegState.versions.length})
            </h4>
            <div className="space-y-1">
              {ffmpegState.versions.map((version, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm">{version.name}</span>
                  <button
                    onClick={() => {
                      // 切换到托管版本
                      onFFmpegManagedChange(true);
                    }}
                    className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                  >
                    使用
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
