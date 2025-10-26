# 🔍 调试 FFmpeg 退出码 234

## 📋 已添加的日志

现在会输出完整的 FFmpeg 命令：
```
[2] [INFO] FFmpeg 命令 {
  jobId: '...',
  command: '/opt/homebrew/bin/ffmpeg',
  args: '-y -i /path/input.mp4 -c:v libx264 -preset medium -crf 23 ...'
}
```

## 🎯 下一步

1. 重启应用：`npm run dev`
2. 添加视频文件
3. 点击"开始压缩"
4. **在终端中查找 `[2] [INFO] FFmpeg 命令` 日志**
5. 复制完整的 `args` 值给我

---

## 🔍 可能的原因

退出码 234 通常表示：
- 参数顺序错误
- 缺少必需参数
- 文件路径问题
- 输出目录权限问题

有了完整的命令后，我可以立即修复！

