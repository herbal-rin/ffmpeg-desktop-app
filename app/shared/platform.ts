/**
 * 平台和架构检测工具
 */

export interface PlatformInfo {
  platform: 'win32' | 'darwin' | 'linux';
  arch: 'x64' | 'arm64';
  platformName: 'win' | 'mac' | 'linux';
  archName: 'x64' | 'arm64';
}

/**
 * 获取当前平台信息
 */
export function getPlatformInfo(): PlatformInfo {
  const platform = process.platform as 'win32' | 'darwin' | 'linux';
  const arch = process.arch as 'x64' | 'arm64';
  
  let platformName: 'win' | 'mac' | 'linux';
  switch (platform) {
    case 'win32':
      platformName = 'win';
      break;
    case 'darwin':
      platformName = 'mac';
      break;
    case 'linux':
      platformName = 'linux';
      break;
    default:
      platformName = 'linux';
  }
  
  return {
    platform,
    arch,
    platformName,
    archName: arch
  };
}

/**
 * 获取FFmpeg可执行文件名
 */
export function getFFmpegExecutableName(platformInfo: PlatformInfo): { ffmpeg: string; ffprobe: string } {
  const { platform } = platformInfo;
  
  return {
    ffmpeg: platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
    ffprobe: platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'
  };
}

/**
 * 获取FFmpeg下载文件名
 */
export function getFFmpegDownloadFilename(version: string, platformInfo: PlatformInfo): string {
  const { platformName, archName } = platformInfo;
  
  switch (platformName) {
    case 'win':
      return `ffmpeg-${version}-win64-gpl.zip`;
    case 'mac':
      return `ffmpeg-${version}-macos-gpl.tar.xz`;
    case 'linux':
      return `ffmpeg-${version}-linux-${archName}-gpl.tar.xz`;
    default:
      throw new Error(`Unsupported platform: ${platformName}`);
  }
}

/**
 * 获取FFmpeg下载URL
 */
export function getFFmpegDownloadUrl(version: string, platformInfo: PlatformInfo, provider: 'official' | 'mirrorA' | 'mirrorB' = 'official'): string {
  const filename = getFFmpegDownloadFilename(version, platformInfo);
  
  switch (provider) {
    case 'official':
      return `https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-${version}/${filename}`;
    case 'mirrorA':
      // 备用镜像1
      return `https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-${version}/${filename}`;
    case 'mirrorB':
      // 备用镜像2
      return `https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-${version}/${filename}`;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * 检查路径是否为绝对路径
 */
export function isAbsolutePath(path: string): boolean {
  if (process.platform === 'win32') {
    return /^[a-zA-Z]:\\/.test(path) || /^\\\\/.test(path);
  } else {
    return path.startsWith('/');
  }
}

/**
 * 规范化路径分隔符
 */
export function normalizePath(path: string): string {
  if (process.platform === 'win32') {
    return path.replace(/\//g, '\\');
  } else {
    return path.replace(/\\/g, '/');
  }
}
