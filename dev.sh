#!/bin/bash
# 开发启动脚本

# 设置环境变量
export NODE_ENV=development

# 清理旧进程
pkill -f "electron|vite" 2>/dev/null

# 等待一秒
sleep 1

# 启动应用
npm run dev

