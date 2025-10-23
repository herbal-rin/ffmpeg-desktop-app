#!/usr/bin/env node

/**
 * 阻断性问题修复验证脚本
 * 检查所有关键问题是否已解决
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 检查阻断性问题修复...\n');

// 1. 检查 FFmpeg 服务文件是否存在
console.log('1. 检查 FFmpeg 服务文件:');
const ffmpegFiles = [
  'app/services/ffmpeg/ffmpegService.ts',
  'app/services/ffmpeg/argsBuilder.ts',
  'app/services/ffmpeg/probe.ts',
  'app/services/ffmpeg/progressParser.ts',
  'app/services/ffmpeg/hardwareAccelBlacklist.ts',
  'app/services/ffmpeg/pathEscapeUtils.ts'
];

let allFilesExist = true;
for (const file of ffmpegFiles) {
  const exists = fs.existsSync(file);
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
}

// 2. 检查 IPC 中的私有属性访问是否修复
console.log('\n2. 检查 IPC 私有属性访问修复:');
const ipcContent = fs.readFileSync('app/main/ipc.ts', 'utf8');
const hasPrivateAccess = ipcContent.includes("ffmpegService['ffprobeService']");
const hasPublicAPI = ipcContent.includes('ffmpegService.probe(');

console.log(`   ${!hasPrivateAccess ? '✅' : '❌'} 已移除私有属性访问`);
console.log(`   ${hasPublicAPI ? '✅' : '❌'} 已使用公开 API`);

// 3. 检查 FfmpegService 是否暴露 probe 方法
console.log('\n3. 检查 FfmpegService 公开 API:');
const ffmpegServiceContent = fs.readFileSync('app/services/ffmpeg/ffmpegService.ts', 'utf8');
const hasProbeMethod = ffmpegServiceContent.includes('async probe(input: string)');

console.log(`   ${hasProbeMethod ? '✅' : '❌'} 已暴露 probe 方法`);

// 4. 检查文件处理 IPC 是否添加
console.log('\n4. 检查文件处理 IPC:');
const hasFileSaveTemp = ipcContent.includes('file/save-temp');
const hasFileCleanupTemp = ipcContent.includes('file/cleanup-temp');

console.log(`   ${hasFileSaveTemp ? '✅' : '❌'} 已添加 file/save-temp IPC`);
console.log(`   ${hasFileCleanupTemp ? '✅' : '❌'} 已添加 file/cleanup-temp IPC`);

// 5. 检查压缩页面文件处理是否修复
console.log('\n5. 检查压缩页面文件处理:');
const compressPageContent = fs.readFileSync('app/renderer/pages/CompressPage.tsx', 'utf8');
const hasTempPathUsage = compressPageContent.includes('fileInfo.tempPath');
const hasFileSaveTempCall = compressPageContent.includes('file/save-temp');
const hasFileCleanupCall = compressPageContent.includes('file/cleanup-temp');

console.log(`   ${hasTempPathUsage ? '✅' : '❌'} 已使用临时路径`);
console.log(`   ${hasFileSaveTempCall ? '✅' : '❌'} 已调用文件保存 IPC`);
console.log(`   ${hasFileCleanupCall ? '✅' : '❌'} 已调用文件清理 IPC`);

// 6. 检查类型定义是否更新
console.log('\n6. 检查类型定义更新:');
const preloadTypesContent = fs.readFileSync('app/types/preload.d.ts', 'utf8');
const hasFileSaveTempType = preloadTypesContent.includes('SaveTempRequest');
const hasFileCleanupTempType = preloadTypesContent.includes('CleanupTempRequest');

console.log(`   ${hasFileSaveTempType ? '✅' : '❌'} 已添加文件保存类型`);
console.log(`   ${hasFileCleanupTempType ? '✅' : '❌'} 已添加文件清理类型`);

// 总结
console.log('\n📊 修复总结:');
const issues = [
  { name: 'FFmpeg 服务文件缺失', fixed: allFilesExist },
  { name: 'IPC 私有属性访问', fixed: !hasPrivateAccess && hasPublicAPI },
  { name: 'FfmpegService 公开 API', fixed: hasProbeMethod },
  { name: '文件处理 IPC', fixed: hasFileSaveTemp && hasFileCleanupTemp },
  { name: '压缩页面文件处理', fixed: hasTempPathUsage && hasFileSaveTempCall && hasFileCleanupCall },
  { name: '类型定义更新', fixed: hasFileSaveTempType && hasFileCleanupTempType }
];

let allFixed = true;
for (const issue of issues) {
  console.log(`   ${issue.fixed ? '✅' : '❌'} ${issue.name}`);
  if (!issue.fixed) allFixed = false;
}

console.log(`\n${allFixed ? '🎉 所有阻断性问题已修复！' : '⚠️  仍有问题需要修复'}`);

if (allFixed) {
  console.log('\n✅ 现在可以安全地进行 P0/P1 交付了！');
} else {
  console.log('\n❌ 请先修复剩余问题再继续开发。');
}
