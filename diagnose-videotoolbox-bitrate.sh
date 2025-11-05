#!/bin/bash
# 诊断 VideoToolbox 码率问题

FFMPEG="/opt/homebrew/bin/ffmpeg"

# 查找用户最近录制的视频（通常在这些目录）
TEST_VIDEO=""
for dir in ~/Desktop ~/Downloads ~/Movies ~/Documents; do
    TEST_VIDEO=$(find "$dir" -name "*.mp4" -o -name "*.mov" 2>/dev/null | head -1)
    if [ -n "$TEST_VIDEO" ]; then
        break
    fi
done

if [ -z "$TEST_VIDEO" ]; then
    echo "❌ 未找到测试视频，请提供视频路径"
    exit 1
fi

echo "📹 测试视频: $TEST_VIDEO"
echo ""
echo "📊 原始视频信息:"
ls -lh "$TEST_VIDEO"
echo ""
$FFMPEG -i "$TEST_VIDEO" 2>&1 | grep -E "Duration|Stream.*Video|Stream.*Audio|bitrate" | head -10
echo ""
echo "=========================================="
echo ""

# 测试不同的 VideoToolbox 参数策略
echo "🧪 测试1: -b:v 0 -q:v 85 (当前高质量参数 - 可能过大)"
$FFMPEG -y -i "$TEST_VIDEO" -t 10 \
    -c:v hevc_videotoolbox -allow_sw 1 -b:v 0 -q:v 85 \
    -c:a copy \
    /tmp/vt_test1.mp4 2>&1 | tail -10
echo "输出文件大小:"
ls -lh /tmp/vt_test1.mp4 2>/dev/null
echo ""

echo "🧪 测试2: -b:v 2M (固定码率 2Mbps)"
$FFMPEG -y -i "$TEST_VIDEO" -t 10 \
    -c:v hevc_videotoolbox -allow_sw 1 -b:v 2M \
    -c:a copy \
    /tmp/vt_test2.mp4 2>&1 | tail -10
echo "输出文件大小:"
ls -lh /tmp/vt_test2.mp4 2>/dev/null
echo ""

echo "🧪 测试3: -b:v 1M (固定码率 1Mbps)"
$FFMPEG -y -i "$TEST_VIDEO" -t 10 \
    -c:v hevc_videotoolbox -allow_sw 1 -b:v 1M \
    -c:a copy \
    /tmp/vt_test3.mp4 2>&1 | tail -10
echo "输出文件大小:"
ls -lh /tmp/vt_test3.mp4 2>/dev/null
echo ""

echo "🧪 测试4: -q:v 50 (质量50，可能更合理)"
$FFMPEG -y -i "$TEST_VIDEO" -t 10 \
    -c:v hevc_videotoolbox -allow_sw 1 -b:v 0 -q:v 50 \
    -c:a copy \
    /tmp/vt_test4.mp4 2>&1 | tail -10
echo "输出文件大小:"
ls -lh /tmp/vt_test4.mp4 2>/dev/null
echo ""

echo "🧪 测试5: libx265 -crf 23 (对比软件编码)"
$FFMPEG -y -i "$TEST_VIDEO" -t 10 \
    -c:v libx265 -preset medium -crf 23 \
    -c:a copy \
    /tmp/x265_test.mp4 2>&1 | tail -10
echo "输出文件大小:"
ls -lh /tmp/x265_test.mp4 2>/dev/null
echo ""

echo "=========================================="
echo "📊 文件大小对比汇总:"
ls -lh /tmp/vt_test*.mp4 /tmp/x265_test.mp4 2>/dev/null | awk '{print $5 "\t" $9}'
echo ""
echo "🎯 分析结果："
echo "  - 如果 test1 (q:v 85) 最大 → 说明质量参数太高"
echo "  - 如果 test2/test3 (固定码率) 更小 → 应该使用固定码率策略"
echo "  - 对比 x265 软件编码的文件大小"

# 清理
rm -f /tmp/vt_test*.mp4 /tmp/x265_test.mp4 2>/dev/null

