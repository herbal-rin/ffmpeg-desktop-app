/**
 * 硬件体检组件
 */

import React, { useState, useEffect } from 'react';

interface GPUDiagnosticResult {
  hwaccels: string[];
  encoders: string[];
  nvenc?: boolean;
  qsv?: boolean;
  videotoolbox?: boolean;
  notes?: string[];
}

interface HardwareDiagCardProps {
  preferHardwareAccel: boolean;
  onPreferHardwareAccelChange: (enabled: boolean) => void;
}

export const HardwareDiagCard: React.FC<HardwareDiagCardProps> = ({
  preferHardwareAccel,
  onPreferHardwareAccelChange
}) => {
  const [diagnosticResult, setDiagnosticResult] = useState<GPUDiagnosticResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostic = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.api.invoke('gpu/diagnose');
      setDiagnosticResult(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : '体检失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 组件挂载时自动运行体检
  useEffect(() => {
    runDiagnostic();
  }, []);

  const getStatusIcon = (available: boolean) => {
    return available ? '✅' : '❌';
  };

  const getStatusText = (available: boolean, name: string) => {
    return available ? `${name} 可用` : `${name} 不可用`;
  };

  return (
    <div className="hardware-diag-card bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          硬件加速体检
        </h3>
        <button
          onClick={runDiagnostic}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '体检中...' : '重新体检'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-sm text-red-600">
            体检失败: {error}
          </div>
        </div>
      )}

      {diagnosticResult && (
        <div className="space-y-4">
          {/* 硬件加速器状态 */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              硬件加速器支持
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <span>{getStatusIcon(diagnosticResult.nvenc || false)}</span>
                <span className="text-sm">{getStatusText(diagnosticResult.nvenc || false, 'NVIDIA NVENC')}</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <span>{getStatusIcon(diagnosticResult.qsv || false)}</span>
                <span className="text-sm">{getStatusText(diagnosticResult.qsv || false, 'Intel QSV')}</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <span>{getStatusIcon(diagnosticResult.videotoolbox || false)}</span>
                <span className="text-sm">{getStatusText(diagnosticResult.videotoolbox || false, 'Apple VideoToolbox')}</span>
              </div>
            </div>
          </div>

          {/* 检测到的编码器 */}
          {diagnosticResult.encoders.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                检测到的硬件编码器 ({diagnosticResult.encoders.length})
              </h4>
              <div className="flex flex-wrap gap-1">
                {diagnosticResult.encoders.map((encoder, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                  >
                    {encoder}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 建议和提示 */}
          {diagnosticResult.notes && diagnosticResult.notes.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                建议和提示
              </h4>
              <div className="space-y-1">
                {diagnosticResult.notes.map((note, index) => (
                  <div key={index} className="text-sm text-gray-600">
                    {note}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 硬件加速开关 */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-700">
                  优先使用硬件编码
                </div>
                <div className="text-sm text-gray-500">
                  启用后，转码任务将优先使用硬件加速编码器
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferHardwareAccel}
                  onChange={(e) => onPreferHardwareAccelChange(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
