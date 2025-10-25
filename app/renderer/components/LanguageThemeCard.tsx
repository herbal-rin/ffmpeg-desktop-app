/**
 * 语言和主题选择组件
 */

import React from 'react';

interface LanguageThemeCardProps {
  language: 'zh' | 'en';
  theme: 'light' | 'dark' | 'system';
  onLanguageChange: (language: 'zh' | 'en') => void;
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
}

export const LanguageThemeCard: React.FC<LanguageThemeCardProps> = ({
  language,
  theme,
  onLanguageChange,
  onThemeChange
}) => {
  return (
    <div className="language-theme-card bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        界面设置
      </h3>
      
      <div className="space-y-6">
        {/* 语言选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            语言 / Language
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="language"
                value="zh"
                checked={language === 'zh'}
                onChange={(e) => onLanguageChange(e.target.value as 'zh')}
                className="mr-2"
              />
              <span className="text-sm">中文</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="language"
                value="en"
                checked={language === 'en'}
                onChange={(e) => onLanguageChange(e.target.value as 'en')}
                className="mr-2"
              />
              <span className="text-sm">English</span>
            </label>
          </div>
        </div>

        {/* 主题选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            主题 / Theme
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="theme"
                value="light"
                checked={theme === 'light'}
                onChange={(e) => onThemeChange(e.target.value as 'light')}
                className="mr-2"
              />
              <span className="text-sm">浅色</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="theme"
                value="dark"
                checked={theme === 'dark'}
                onChange={(e) => onThemeChange(e.target.value as 'dark')}
                className="mr-2"
              />
              <span className="text-sm">深色</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="theme"
                value="system"
                checked={theme === 'system'}
                onChange={(e) => onThemeChange(e.target.value as 'system')}
                className="mr-2"
              />
              <span className="text-sm">跟随系统</span>
            </label>
          </div>
        </div>

        {/* 预览 */}
        <div className="pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            <div className="mb-2">预览效果：</div>
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="text-sm">
                语言: {language === 'zh' ? '中文界面' : 'English Interface'}
              </div>
              <div className="text-sm">
                主题: {
                  theme === 'light' ? '浅色主题' :
                  theme === 'dark' ? '深色主题' : '系统主题'
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
