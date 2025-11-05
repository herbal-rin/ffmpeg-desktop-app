#!/bin/bash
# 测试不同质量参数的文件大小

FFMPEG="/opt/homebrew/bin/ffmpeg"
TEST_VIDEO=$(find /Users/herbal -name "*.mp4" -type f 2>/dev/null | head -1)

if [ -z "$TEST_VIDEO" ]; then
    echo "❌ 未找到测试视频"
    exit 1
fi

echo "📹 测试视频: $TEST_VIDEO"
echo "📊 原始文件信息:"
ls -lh "$TEST_VIDEO"
$FFMPEG -i "$TEST_VIDEO" 2>&1 | grep -E "Duration|Stream.*Video|bitrate"
echo ""
echo "=========================================="
echo ""

# 测试 VideoToolbox q:v 参数（如果可用）
if $FFMPEG -hide_banner -encoders 2>&1 | grep -q "h264_videotoolbox"; then
    echo "🧪 测试 VideoToolbox q:v 参数对文件大小的影响"
    echo ""
    
    # q:v = 60 (应该是高质量?)
    echo "测试1: -q:v 60"
    $FFMPEG -y -i "$TEST_VIDEO" -t 5 -c:v h264_videotoolbox -allow_sw 1 -b:v 0 -q:v 60 -an /tmp/vt_q60.mp4 2>&1 | tail -5
    ls -lh /tmp/vt_q60.mp4 2>/dev/null
    echo ""
    
    # q:v = 70
    echo "测试2: -q:v 70"
    $FFMPEG -y -i "$TEST_VIDEO" -t 5 -c:v h264_videotoolbox -allow_sw 1 -b:v 0 -q:v 70 -an /tmp/vt_q70.mp4 2>&1 | tail -5
    ls -lh /tmp/vt_q70.mp4 2>/dev/null
    echo ""
    
    # q:v = 80 (应该是低质量小文件?)
    echo "测试3: -q:v 80"
    $FFMPEG -y -i "$TEST_VIDEO" -t 5 -c:v h264_videotoolbox -allow_sw 1 -b:v 0 -q:v 80 -an /tmp/vt_q80.mp4 2>&1 | tail -5
    ls -lh /tmp/vt_q80.mp4 2>/dev/null
    echo ""
    
    echo "📊 VideoToolbox 文件大小对比:"
    ls -lh /tmp/vt_q*.mp4 2>/dev/null | awk '{print $5 "\t" $9}'
    echo ""
fi

echo "=========================================="
echo ""
echo "🧪 测试 libx264 CRF 参数对文件大小的影响"
echo ""

# CRF 18 (高质量)
echo "测试1: -crf 18 (高质量)"
$FFMPEG -y -i "$TEST_VIDEO" -t 5 -c:v libx264 -preset medium -crf 18 -an /tmp/x264_crf18.mp4 2>&1 | tail -5
ls -lh /tmp/x264_crf18.mp4 2>/dev/null
echo ""

# CRF 23 (中等)
echo "测试2: -crf 23 (中等)"
$FFMPEG -y -i "$TEST_VIDEO" -t 5 -c:v libx264 -preset medium -crf 23 -an /tmp/x264_crf23.mp4 2>&1 | tail -5
ls -lh /tmp/x264_crf23.mp4 2>/dev/null
echo ""

# CRF 28 (低质量小文件)
echo "测试3: -crf 28 (低质量)"
$FFMPEG -y -i "$TEST_VIDEO" -t 5 -c:v libx264 -preset medium -crf 28 -an /tmp/x264_crf28.mp4 2>&1 | tail -5
ls -lh /tmp/x264_crf28.mp4 2>/dev/null
echo ""

echo "📊 libx264 文件大小对比:"
ls -lh /tmp/x264_crf*.mp4 2>/dev/null | awk '{print $5 "\t" $9}'
echo ""
echo "✅ 测试完成！"
echo ""
echo "📋 总结："
echo "  - q:v 数值 ↑ = 质量 ? / 文件大小 ?"
echo "  - CRF 数值 ↑ = 质量 ↓ / 文件大小 ↓ (正确)"

# 清理
rm -f /tmp/vt_q*.mp4 /tmp/x264_crf*.mp4 2>/dev/null

