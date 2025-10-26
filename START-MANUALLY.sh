#!/bin/bash

echo "🔧 手动启动 Electron 开发模式..."
echo ""

# 停止所有 Electron 进程
pkill -f Electron
sleep 1

# 启动 Electron 并设置环境变量
cd /Users/herbal/ffmpeg-app
export NODE_ENV=development
export VITE_PORT=5173

echo "✅ 环境变量设置完成"
echo "   NODE_ENV=$NODE_ENV"
echo "   VITE_PORT=$VITE_PORT"
echo ""
echo "🚀 启动 Electron..."
echo ""

electron .
