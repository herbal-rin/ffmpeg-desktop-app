import React from 'react';
import { useJobsStore } from '../store/useJobsStore';
import { t, formatProgress, formatSpeed, formatETA, getJobStatusText, getContainerDisplayName } from '../i18n';
import { JobStatus } from '@types/preload';

/**
 * 任务队列表格组件
 */
export function JobQueueTable() {
  const { 
    jobs, 
    isProcessing, 
    cancelJob, 
    pauseJob, 
    resumeJob, 
    removeJob 
  } = useJobsStore();

  // 获取状态颜色
  const getStatusColor = (status: JobStatus): string => {
    switch (status) {
      case 'queued':
        return 'text-blue-600 dark:text-blue-400';
      case 'running':
        return 'text-green-600 dark:text-green-400';
      case 'paused':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'canceled':
        return 'text-gray-500 dark:text-gray-400';
      case 'failed':
        return 'text-red-600 dark:text-red-400';
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  // 获取状态图标
  const getStatusIcon = (status: JobStatus): string => {
    switch (status) {
      case 'queued':
        return '⏳';
      case 'running':
        return '▶️';
      case 'paused':
        return '⏸️';
      case 'canceled':
        return '⏹️';
      case 'failed':
        return '❌';
      case 'completed':
        return '✅';
      default:
        return '❓';
    }
  };

  // 处理任务操作
  const handleJobAction = async (action: string, jobId: string) => {
    try {
      switch (action) {
        case 'cancel':
          await cancelJob(jobId);
          break;
        case 'pause':
          await pauseJob(jobId);
          break;
        case 'resume':
          await resumeJob(jobId);
          break;
        case 'remove':
          removeJob(jobId);
          break;
        case 'openFolder':
          // 打开输出文件夹
          const job = jobs.find(j => j.id === jobId);
          if (job) {
            await window.api.invoke('shell/open-path', { 
              path: job.opts.outputDir 
            });
          }
          break;
      }
    } catch (error) {
      console.error(`任务操作失败 (${action}):`, error);
      (window as any).showToast?.(
        error instanceof Error ? error.message : '操作失败', 
        'error'
      );
    }
  };

  // 检查是否可以暂停/恢复
  const canPauseResume = (status: JobStatus): boolean => {
    return status === 'running' || status === 'paused';
  };

  // 检查是否是 Windows 平台
  const isWindows = navigator.platform.toLowerCase().includes('win');

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <div className="text-4xl mb-2">📋</div>
        <p>{t('queue.empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 队列标题和快捷操作 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('queue.title')}</h3>
        <div className="flex items-center space-x-2">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('queue.processing')}: {isProcessing ? t('common.yes') : t('common.no')}
          </div>
          {/* 快捷操作按钮 */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => window.api.invoke('ffmpeg/queue/start')}
              disabled={isProcessing || jobs.length === 0}
              className="btn btn-sm btn-primary"
            >
              ▶️ {t('queue.start')}
            </button>
            <button
              onClick={() => {
                const completedJob = jobs.find(j => j.status === 'completed');
                if (completedJob?.output) {
                  const path = require('path');
                  window.api.invoke('system/openDirectory', path.dirname(completedJob.output));
                }
              }}
              disabled={!jobs.some(j => j.status === 'completed')}
              className="btn btn-sm btn-outline"
            >
              📁 {t('queue.openOutputDir')}
            </button>
          </div>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="space-y-3">
        {jobs.map((job) => (
        <div
          key={job.id}
          className={`p-4 border rounded-lg transition-all ${
            job.status === 'completed' 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : job.status === 'failed'
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              : job.status === 'canceled'
              ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
          }`}
        >
          {/* 任务基本信息 */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                {job.opts.outputName || job.opts.input.split('/').pop()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {getContainerDisplayName(job.opts.container)} • {job.opts.videoCodec}
              </div>
            </div>
            
            <div className="flex items-center space-x-1 ml-2">
              <span className="text-lg">{getStatusIcon(job.status)}</span>
              <span className={`text-xs font-medium ${getStatusColor(job.status)}`}>
                {getJobStatusText(job.status)}
              </span>
            </div>
          </div>

          {/* 进度信息 */}
          {job.lastProgress && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                <span>{formatProgress(job.lastProgress.ratio)}</span>
                <span>{formatSpeed(job.lastProgress.speed)}</span>
                {job.lastProgress.etaSec && (
                  <span>{formatETA(job.lastProgress.etaSec)}</span>
                )}
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${job.lastProgress.ratio * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* 错误信息 */}
          {job.error && (
            <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400">
              {job.error}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-1">
              {/* 取消按钮 */}
              {(job.status === 'queued' || job.status === 'running') && (
                <button
                  onClick={() => handleJobAction('cancel', job.id)}
                  disabled={isProcessing}
                  className="btn btn-sm btn-outline text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  {t('job.actions.cancel')}
                </button>
              )}

              {/* 暂停/恢复按钮 */}
              {canPauseResume(job.status) && (
                <>
                  {job.status === 'running' && (
                    <button
                      onClick={() => handleJobAction('pause', job.id)}
                      disabled={isProcessing || isWindows}
                      className={`btn btn-sm btn-outline ${
                        isWindows 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                      }`}
                      title={isWindows ? t('tooltip.pauseUnsupported') : ''}
                    >
                      {t('job.actions.pause')}
                    </button>
                  )}
                  
                  {job.status === 'paused' && (
                    <button
                      onClick={() => handleJobAction('resume', job.id)}
                      disabled={isProcessing || isWindows}
                      className={`btn btn-sm btn-outline ${
                        isWindows 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20'
                      }`}
                      title={isWindows ? t('tooltip.pauseUnsupported') : ''}
                    >
                      {t('job.actions.resume')}
                    </button>
                  )}
                </>
              )}

              {/* 移除按钮 */}
              {(job.status === 'completed' || job.status === 'failed' || job.status === 'canceled') && (
                <button
                  onClick={() => handleJobAction('remove', job.id)}
                  disabled={isProcessing}
                  className="btn btn-sm btn-outline text-gray-600 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t('job.actions.remove')}
                </button>
              )}
            </div>

            {/* 打开文件夹按钮 */}
            {job.status === 'completed' && (
              <button
                onClick={() => handleJobAction('openFolder', job.id)}
                className="btn btn-sm btn-ghost text-blue-600 hover:text-blue-700"
              >
                {t('job.actions.openFolder')}
              </button>
            )}
          </div>
        </div>
      ))}

      {/* 队列统计 */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{t('queue.total')}: {jobs.length}</span>
          <span>
            {t('queue.completed')}: {jobs.filter(j => j.status === 'completed').length} • 
            {t('queue.failed')}: {jobs.filter(j => j.status === 'failed').length}
          </span>
        </div>
      </div>
      </div>
    </div>
  );
}
