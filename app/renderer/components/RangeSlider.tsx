/**
 * 时间范围选择器组件
 */

import React, { useEffect, useState, useRef } from 'react';
import { useToolsStore } from '../store/useToolsStore';
import { toHMSms, parseHMSms, validateTimeRange } from '../../shared/time';

interface RangeSliderProps {
  className?: string;
}

export const RangeSlider: React.FC<RangeSliderProps> = ({ className = '' }) => {
  const { 
    selectedFile, 
    timeRange, 
    setTimeRange 
  } = useToolsStore();

  const [startTimeStr, setStartTimeStr] = useState('');
  const [endTimeStr, setEndTimeStr] = useState('');
  const [duration, setDuration] = useState(0);
  const sliderContainerRef = useRef<HTMLDivElement>(null);

  // 更新持续时间
  useEffect(() => {
    if (selectedFile?.probeResult) {
      const durationSec = selectedFile.probeResult.durationSec;
      setDuration(durationSec);
      
      // 设置默认时间范围
      const defaultEnd = Math.min(10, durationSec);
      const newRange = { startSec: 0, endSec: defaultEnd };
      setTimeRange(newRange);
      setStartTimeStr(toHMSms(0));
      setEndTimeStr(toHMSms(defaultEnd));
    }
  }, [selectedFile, setTimeRange]);

  // 同步时间范围到字符串
  useEffect(() => {
    setStartTimeStr(toHMSms(timeRange.startSec));
    setEndTimeStr(toHMSms(timeRange.endSec));
  }, [timeRange]);

  const handleStartTimeChange = (value: string) => {
    setStartTimeStr(value);
    const startSec = parseHMSms(value);
    
    if (duration > 0) {
      // 确保开始时间不超过结束时间
      const maxStart = Math.max(0, timeRange.endSec - 0.5); // 最小区间0.5秒
      const clampedStart = Math.min(startSec, maxStart);
      
      const validation = validateTimeRange({ startSec: clampedStart, endSec: timeRange.endSec }, duration);
      if (validation.valid) {
        setTimeRange({ startSec: clampedStart, endSec: timeRange.endSec });
      } else {
        // 如果输入无效，回退到有效值
        setStartTimeStr(toHMSms(timeRange.startSec));
      }
    }
  };

  const handleEndTimeChange = (value: string) => {
    setEndTimeStr(value);
    const endSec = parseHMSms(value);
    
    if (duration > 0) {
      // 确保结束时间不小于开始时间
      const minEnd = Math.min(duration, timeRange.startSec + 0.5); // 最小区间0.5秒
      const clampedEnd = Math.max(endSec, minEnd);
      
      const validation = validateTimeRange({ startSec: timeRange.startSec, endSec: clampedEnd }, duration);
      if (validation.valid) {
        setTimeRange({ startSec: timeRange.startSec, endSec: clampedEnd });
      } else {
        // 如果输入无效，回退到有效值
        setEndTimeStr(toHMSms(timeRange.endSec));
      }
    }
  };

  const handleSliderChange = (type: 'start' | 'end', value: number) => {
    const minInterval = 0.5; // 最小区间0.5秒
    
    if (type === 'start') {
      const maxStart = Math.max(0, timeRange.endSec - minInterval);
      const clampedStart = Math.min(value, maxStart);
      const newRange = { startSec: clampedStart, endSec: timeRange.endSec };
      
      if (clampedStart < timeRange.endSec) {
        setTimeRange(newRange);
      }
    } else {
      const minEnd = Math.min(duration, timeRange.startSec + minInterval);
      const clampedEnd = Math.max(value, minEnd);
      const newRange = { startSec: timeRange.startSec, endSec: clampedEnd };
      
      if (clampedEnd > timeRange.startSec) {
        setTimeRange(newRange);
      }
    }
  };

  if (!selectedFile || duration === 0) {
    return (
      <div className={`p-4 bg-gray-50 rounded-lg ${className}`}>
        <div className="text-center text-gray-500">
          <p>请先选择视频文件</p>
        </div>
      </div>
    );
  }

  const rangeDuration = timeRange.endSec - timeRange.startSec;
  const rangePercentage = (rangeDuration / duration) * 100;

  return (
    <div className={`p-4 bg-gray-50 rounded-lg ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">时间范围选择</h3>
        <div className="text-sm text-gray-600">
          总时长: {toHMSms(duration)} | 选择范围: {toHMSms(rangeDuration)}
        </div>
      </div>

      {/* 时间输入框 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            开始时间
          </label>
          <input
            type="text"
            value={startTimeStr}
            onChange={(e) => handleStartTimeChange(e.target.value)}
            placeholder="HH:MM:SS.mmm"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            结束时间
          </label>
          <input
            type="text"
            value={endTimeStr}
            onChange={(e) => handleEndTimeChange(e.target.value)}
            placeholder="HH:MM:SS.mmm"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 可视化时间轴 */}
      <div className="relative" ref={sliderContainerRef}>
        <div className="h-8 bg-gray-200 rounded-lg flex items-center px-3">
          {/* 时间轴背景（深灰色细线，左右留空隙） */}
          <div className="flex-1 h-1 bg-gray-300 rounded relative">
            {/* 选择范围（蓝色进度条） */}
            <div
              className="absolute h-1 bg-blue-500 rounded"
              style={{
                left: `${(timeRange.startSec / duration) * 100}%`,
                width: `${rangePercentage}%`,
                top: 0
              }}
            ></div>
            
            {/* 开始时间拖拽点 */}
            <div
              className="absolute w-4 h-4 bg-blue-600 rounded-full cursor-pointer hover:bg-blue-700"
              style={{ 
                left: `${(timeRange.startSec / duration) * 100}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10
              }}
              onMouseDown={(_e) => {
                const handleMouseMove = (e: MouseEvent) => {
                  const container = sliderContainerRef.current;
                  if (container) {
                    const sliderBar = container.querySelector('.flex-1') as HTMLElement;
                    if (sliderBar) {
                      const rect = sliderBar.getBoundingClientRect();
                      const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      const newTime = percentage * duration;
                      handleSliderChange('start', newTime);
                    }
                  }
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            ></div>
            
            {/* 结束时间拖拽点 */}
            <div
              className="absolute w-4 h-4 bg-blue-600 rounded-full cursor-pointer hover:bg-blue-700"
              style={{ 
                left: `${(timeRange.endSec / duration) * 100}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10
              }}
              onMouseDown={(_e) => {
                const handleMouseMove = (e: MouseEvent) => {
                  const container = sliderContainerRef.current;
                  if (container) {
                    const sliderBar = container.querySelector('.flex-1') as HTMLElement;
                    if (sliderBar) {
                      const rect = sliderBar.getBoundingClientRect();
                      const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      const newTime = percentage * duration;
                      handleSliderChange('end', newTime);
                    }
                  }
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            ></div>
          </div>
        </div>
        
        {/* 时间刻度 */}
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>00:00:00</span>
          <span>{toHMSms(duration)}</span>
        </div>
      </div>

      {/* 快速选择按钮 */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => {
            const newRange = { startSec: 0, endSec: Math.min(10, duration) };
            setTimeRange(newRange);
          }}
          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
        >
          前10秒
        </button>
        <button
          onClick={() => {
            const newRange = { startSec: Math.max(0, duration - 10), endSec: duration };
            setTimeRange(newRange);
          }}
          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
        >
          后10秒
        </button>
        <button
          onClick={() => {
            const newRange = { startSec: 0, endSec: duration };
            setTimeRange(newRange);
          }}
          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
        >
          全片
        </button>
      </div>
    </div>
  );
};
