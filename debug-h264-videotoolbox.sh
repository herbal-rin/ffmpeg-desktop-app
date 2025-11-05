#!/bin/bash
# 测试 h264_videotoolbox 编码器参数

FFMPEG="/opt/homebrew/bin/ffmpeg"
INPUT="/Users/herbal/ffmpeg-app/test-input.mp4"
OUTPUT="/tmp/test-videotoolbox-output.mp4"

# 查找测试视频
TEST_VIDEO=$(find /Users/herbal -name "*.mp4" -type f 2>/dev/null | head -1)

if [ -z "$TEST_VIDEO" ]; then
    echo "❌ 未找到测试视频文件"
    exit 1
fi

echo "📹 使用测试视频: $TEST_VIDEO"
echo ""

# 测试1: 当前使用的参数（可能有问题）
echo "🧪 测试1: 当前参数 -allow_sw 1 -b:v 0 -q:v 70"
$FFMPEG -y -i "$TEST_VIDEO" \
    -c:v h264_videotoolbox \
    -allow_sw 1 -b:v 0 -q:v 70 \
    -c:a aac -b:a 128k \
    -movflags +faststart \
    -t 3 \
    "$OUTPUT.test1.mp4" 2>&1 | tail -20

if [ $? -eq 0 ]; then
    echo "✅ 测试1 成功"
    ls -lh "$OUTPUT.test1.mp4"
else
    echo "❌ 测试1 失败，退出码: $?"
fi

echo ""
echo "---"
echo ""

# 测试2: 简化参数（只用 -q:v）
echo "🧪 测试2: 简化参数 -q:v 70"
$FFMPEG -y -i "$TEST_VIDEO" \
    -c:v h264_videotoolbox \
    -q:v 70 \
    -c:a aac -b:a 128k \
    -movflags +faststart \
    -t 3 \
    "$OUTPUT.test2.mp4" 2>&1 | tail -20

if [ $? -eq 0 ]; then
    echo "✅ 测试2 成功"
    ls -lh "$OUTPUT.test2.mp4"
else
    echo "❌ 测试2 失败，退出码: $?"
fi

echo ""
echo "---"
echo ""

# 测试3: 使用 -b:v 参数（标准方式）
echo "🧪 测试3: 标准参数 -b:v 2M"
$FFMPEG -y -i "$TEST_VIDEO" \
    -c:v h264_videotoolbox \
    -b:v 2M \
    -c:a aac -b:a 128k \
    -movflags +faststart \
    -t 3 \
    "$OUTPUT.test3.mp4" 2>&1 | tail -20

if [ $? -eq 0 ]; then
    echo "✅ 测试3 成功"
    ls -lh "$OUTPUT.test3.mp4"
else
    echo "❌ 测试3 失败，退出码: $?"
fi

echo ""
echo "---"
echo "🔍 检查 FFmpeg 版本和 VideoToolbox 支持:"
$FFMPEG -version | head -3
echo ""
$FFMPEG -hide_banner -encoders 2>&1 | grep videotoolbox

# 清理
rm -f "$OUTPUT".test*.mp4 2>/dev/null

