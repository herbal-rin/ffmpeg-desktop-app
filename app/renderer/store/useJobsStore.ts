import { create } from 'zustand';
import { Job, QueueEventPayload, TranscodeOptions } from '../../shared/types';

/**
 * 任务状态接口
 */
interface JobsState {
  // 任务数据
  jobs: Job[];
  currentJob: Job | null;
  
  // 队列状态
  isProcessing: boolean;
  queueLength: number;
  
  // GPU 信息
  gpuInfo: {
    hwaccels: string[];
    encoders: string[];
  };
  
  // 状态
  isLoading: boolean;
  error: string | null;
  
  // 操作
  initializeQueue: () => void;
  addJob: (options: TranscodeOptions) => Promise<string>;
  startQueue: () => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
  pauseJob: (jobId: string) => Promise<void>;
  resumeJob: (jobId: string) => Promise<void>;
  removeJob: (jobId: string) => void;
  clearQueue: () => Promise<void>;
  detectGPU: () => Promise<void>;
  clearError: () => void;
  
  // 内部方法
  handleQueueEvent: (payload: QueueEventPayload) => void;
}

/**
 * 任务状态管理
 */
export const useJobsStore = create<JobsState>((set, get) => ({
  // 初始状态
  jobs: [],
  currentJob: null,
  isProcessing: false,
  queueLength: 0,
  gpuInfo: {
    hwaccels: [],
    encoders: [],
  },
  isLoading: false,
  error: null,

  // 初始化队列监听
  initializeQueue: () => {
    const unsubscribe = window.api.on('queue/events', (payload: QueueEventPayload) => {
      get().handleQueueEvent(payload);
    });

    // 检测 GPU 信息
    get().detectGPU();

    // 返回清理函数（如果需要的话）
    return unsubscribe;
  },

  // 添加任务
  addJob: async (options: TranscodeOptions) => {
    try {
      set({ isLoading: true, error: null });
      
      const response = await window.api.invoke('ffmpeg/queue/enqueue', options);
      
      // 同步本地jobs列表
      set((state) => ({
        jobs: [
          ...state.jobs,
          {
            id: response.jobId,
            opts: options,
            status: 'queued',
            createdAt: Date.now(),
          }
        ],
        queueLength: state.jobs.length + 1,
        isLoading: false,
      }));
      
      return response.jobId;
    } catch (error) {
      console.error('添加任务失败:', error);
      set({
        error: error instanceof Error ? error.message : '添加任务失败',
        isLoading: false,
      });
      throw error;
    }
  },

  // 开始队列
  startQueue: async () => {
    try {
      set({ isLoading: true, error: null });
      
      await window.api.invoke('ffmpeg/queue/start');
      
      set({ isLoading: false });
    } catch (error) {
      console.error('启动队列失败:', error);
      set({
        error: error instanceof Error ? error.message : '启动队列失败',
        isLoading: false,
      });
      throw error;
    }
  },

  // 取消任务
  cancelJob: async (jobId: string) => {
    try {
      console.log(`📤 发送取消任务请求: ${jobId}`);
      const result = await window.api.invoke('ffmpeg/queue/cancel', { jobId });
      console.log(`✅ 取消任务响应:`, result);
    } catch (error) {
      console.error('❌ 取消任务失败:', error);
      set({
        error: error instanceof Error ? error.message : '取消任务失败',
      });
      throw error;
    }
  },

  // 暂停任务
  pauseJob: async (jobId: string) => {
    try {
      await window.api.invoke('ffmpeg/queue/pause', { jobId });
    } catch (error) {
      console.error('暂停任务失败:', error);
      set({
        error: error instanceof Error ? error.message : '暂停任务失败',
      });
      throw error;
    }
  },

  // 恢复任务
  resumeJob: async (jobId: string) => {
    try {
      await window.api.invoke('ffmpeg/queue/resume', { jobId });
    } catch (error) {
      console.error('恢复任务失败:', error);
      set({
        error: error instanceof Error ? error.message : '恢复任务失败',
      });
      throw error;
    }
  },

  // 移除任务
  removeJob: (jobId: string) => {
    set((state) => ({
      jobs: state.jobs.filter(job => job.id !== jobId),
      queueLength: state.jobs.filter(job => job.id !== jobId).length,
    }));
  },

  // 清空任务队列
  clearQueue: async () => {
    try {
      await window.api.invoke('ffmpeg/queue/clear');
      set({
        jobs: [],
        currentJob: null,
        isProcessing: false,
        queueLength: 0,
      });
    } catch (error) {
      console.error('清空队列失败:', error);
      set({
        error: error instanceof Error ? error.message : '清空队列失败',
      });
      throw error;
    }
  },

  // 检测 GPU
  detectGPU: async () => {
    try {
      const gpuInfo = await window.api.invoke('gpu/detect');
      set({ gpuInfo });
    } catch (error) {
      console.error('GPU 检测失败:', error);
      // GPU 检测失败不应该影响应用运行
    }
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },

  // 处理队列事件
  handleQueueEvent: (payload: QueueEventPayload) => {
    const { type, job, progress, error } = payload;
    console.log(`📨 收到队列事件: ${type}`, { jobId: job?.id, status: job?.status });
    
    switch (type) {
      case 'job-start':
        if (job) {
          console.log(`▶️ 任务开始: ${job.id}`);
          set((state) => ({
            jobs: state.jobs.map(j => j.id === job.id ? { ...j, status: 'running', startedAt: Date.now() } : j),
            currentJob: job,
            isProcessing: true,
          }));
        }
        break;
        
      case 'job-progress':
        if (job && progress) {
          set((state) => ({
            jobs: state.jobs.map(j => 
              j.id === job.id 
                ? { ...j, lastProgress: progress, status: 'running' as const }
                : j
            ),
          }));
        }
        break;
        
      case 'job-done':
        if (job) {
          console.log(`✅ 任务完成: ${job.id}`);
          set((state) => ({
            jobs: state.jobs.map(j => 
              j.id === job.id 
                ? { 
                    ...j, 
                    status: 'completed' as const, 
                    finishedAt: Date.now(),
                    // 确保完成时显示100%
                    lastProgress: j.lastProgress ? {
                      ...j.lastProgress,
                      ratio: 1.0
                    } : undefined
                  }
                : j
            ),
            currentJob: null,
            isProcessing: state.queueLength > 1,
          }));
        }
        break;
        
      case 'job-failed':
      case 'job-error':
        if (job) {
          // 确保错误消息是字符串
          const errorMessage = error instanceof Error 
            ? error.message 
            : typeof error === 'string' 
              ? error 
              : String(error);
          
          console.log(`❌ 任务失败: ${job.id}`, { error, payload });
          console.error('任务失败详情:', {
            jobId: job.id,
            errorMessage,
            errorType: typeof error,
            isErrorObject: error instanceof Error
          });
          
          set((state) => ({
            jobs: state.jobs.map(j => 
              j.id === job.id 
                ? { ...j, status: 'failed' as const, error: errorMessage || '未知错误', finishedAt: Date.now() }
                : j
            ),
            currentJob: null,
            isProcessing: state.queueLength > 1,
            error: errorMessage || '任务执行失败',
          }));
        }
        break;
        
      case 'job-canceled':
        if (job) {
          console.log(`🚫 任务已取消: ${job.id}`);
          set((state) => ({
            jobs: state.jobs.map(j => 
              j.id === job.id 
                ? { ...j, status: 'canceled' as const, finishedAt: Date.now() }
                : j
            ),
            currentJob: null,
            isProcessing: state.queueLength > 1,
          }));
          console.log(`✅ 状态已更新为 canceled: ${job.id}`);
        }
        break;
        
      case 'queue-empty':
        console.log(`📭 队列为空`);
        set((state) => ({
          isProcessing: false,
          currentJob: null,
          queueLength: 0,
        }));
        break;
    }
  },
}));
