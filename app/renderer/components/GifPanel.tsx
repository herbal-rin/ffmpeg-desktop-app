/**
 * GIF 面板组件
 */

import React from 'react';
import { useToolsStore } from '../store/useToolsStore';
import { estimateGifSize } from '../../shared/time';

interface GifPanelProps {
  className?: string;
}

export const GifPanel: React.FC<GifPanelProps> = ({ className = '' }) => {
  const {
    gifFps,
    gifMaxWidth,
    gifDithering,
    timeRange,
    selectedFile,
    setGifFps,
    setGifMaxWidth,
    setGifDithering
  } = useToolsStore();

  const fpsOptions = [
    { value: 8, label: '8 FPS - 文件最小' },
    { value: 12, label: '12 FPS - 推荐' },
    { value: 15, label: '15 FPS - 流畅' },
    { value: 20, label: '20 FPS - 很流畅' },
    { value: 24, label: '24 FPS - 电影级' },
    { value: 30, label: '30 FPS - 最高质量' }
  ];

  const widthOptions = [
    { value: 320, label: '320px - 最小' },
    { value: 480, label: '480px - 小' },
    { value: 640, label: '640px - 推荐' },
    { value: 800, label: '800px - 大' },
    { value: 1024, label: '1024px - 很大' },
    { value: 1280, label: '1280px - 最大' }
  ];

  // 计算预估文件大小
  const getEstimatedSize = () => {
    if (!selectedFile?.probeResult) return '';
    
    const { width, height } = selectedFile.probeResult;
    const duration = timeRange.endSec - timeRange.startSec;
    const actualWidth = Math.min(gifMaxWidth, width);
    const actualHeight = Math.round((actualWidth * height) / width);
    
    return estimateGifSize(actualWidth, actualHeight, gifFps, duration);
  };

  return (
    <div className={`p-4 bg-white rounded-lg border ${className}`}>
      <h3 className="text-lg font-medium text-gray-900 mb-4">GIF 制作</h3>
      
      {/* 帧率设置 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          帧率 (FPS)
        </label>
        <select
          value={gifFps}
          onChange={(e) => setGifFps(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {fpsOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="text-sm text-gray-600 mt-1">
          帧率越高，动画越流畅，但文件也越大
        </div>
      </div>

      {/* 最大宽度 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          最大宽度
        </label>
        <select
          value={gifMaxWidth}
          onChange={(e) => setGifMaxWidth(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {widthOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="text-sm text-gray-600 mt-1">
          宽度越小，文件越小，但画质会降低
        </div>
      </div>

      {/* 抖动算法 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          抖动算法
        </label>
        <div className="space-y-2">
          <label className="flex items-start">
            <input
              type="radio"
              name="gifDithering"
              value="bayer"
              checked={gifDithering === 'bayer'}
              onChange={(e) => setGifDithering(e.target.value as 'bayer' | 'floyd')}
              className="mt-1 mr-3"
            />
            <div>
              <div className="font-medium">Bayer 抖动</div>
              <div className="text-sm text-gray-600">
                默认选项，处理速度快，效果良好
              </div>
            </div>
          </label>
          <label className="flex items-start">
            <input
              type="radio"
              name="gifDithering"
              value="floyd"
              checked={gifDithering === 'floyd'}
              onChange={(e) => setGifDithering(e.target.value as 'bayer' | 'floyd')}
              className="mt-1 mr-3"
            />
            <div>
              <div className="font-medium">Floyd-Steinberg 抖动</div>
              <div className="text-sm text-gray-600">
                更高质量的抖动，但处理时间较长
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* 文件大小预估 */}
      {selectedFile?.probeResult && (
        <div className="mb-6">
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            <div className="text-sm text-gray-700">
              <div className="font-medium mb-2">📊 预估信息：</div>
              <div className="space-y-1">
                <div>预估文件大小: <span className="font-medium text-blue-600">{getEstimatedSize()}</span></div>
                <div>时长: <span className="font-medium">{(timeRange.endSec - timeRange.startSec).toFixed(1)} 秒</span></div>
                <div>帧数: <span className="font-medium">{Math.round((timeRange.endSec - timeRange.startSec) * gifFps)} 帧</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 使用说明 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
        <div className="text-sm text-yellow-800">
          <div className="font-medium mb-1">⚠️ 注意事项：</div>
          <ul className="list-disc list-inside space-y-1">
            <li>GIF 预览时长限制在 30 秒以内</li>
            <li>建议选择较短的片段以获得最佳效果</li>
            <li>GIF 文件通常比视频文件大很多</li>
            <li>生成过程需要两步：调色板 + 应用，请耐心等待</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
