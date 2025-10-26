# MKV 文件支持问题修复总结

## 问题描述
MKV格式的视频文件无法添加到压缩队列，用户拖拽MKV文件后无法被处理和探测。

## 根本原因
**ArrayBuffer 序列化问题**：在 `CompressPage.tsx` 中，文件数据通过 IPC 传递时使用了 `ArrayBuffer` 类型，但 Electron 的 IPC 在序列化数据时需要支持 JSON 格式。`ArrayBuffer` 对象在序列化时会丢失实际的二进制数据。

## 修复方案

### 1. 修改 CompressPage.tsx（文件保存逻辑）
将 ArrayBuffer 转换为数字数组再进行 IPC 传递：

```typescript
// 修复前：
const fileData = await file.arrayBuffer();
const result = await window.api.invoke('file/save-temp', {
  fileData,
  fileName: file.name
});

// 修复后：
const fileData = await file.arrayBuffer();
// 将 ArrayBuffer 转换为数组，因为 IPC 不支持直接传递 ArrayBuffer
const fileDataArray = Array.from(new Uint8Array(fileData));
const result = await window.api.invoke('file/save-temp', {
  fileData: fileDataArray,
  fileName: file.name
});
```

### 2. 修改 app/main/ipc.ts（IPC 处理器）
更新 `file/save-temp` IPC 处理器的类型和实现：

```typescript
// 修复前：
ipcMain.handle('file/save-temp', async (_event, { fileData, fileName }: { fileData: ArrayBuffer, fileName: string }) => {
  // ...
  const buffer = Buffer.from(fileData);
  // ...
});

// 修复后：
ipcMain.handle('file/save-temp', async (_event, { fileData, fileName }: { fileData: number[], fileName: string }) => {
  // ...
  // 写入文件 - 将数字数组转换为 Buffer
  const buffer = Buffer.from(fileData);
  // ...
});
```

### 3. 修改 app/types/preload.d.ts（类型定义）
更新 TypeScript 类型定义：

```typescript
// 修复前：
export interface SaveTempRequest {
  fileData: ArrayBuffer;
  fileName: string;
}

// 修复后：
export interface SaveTempRequest {
  fileData: number[]; // 使用数字数组而不是ArrayBuffer，因为IPC需要序列化
  fileName: string;
}
```

## 相关修复

### 1. 输出文件命名功能
- 添加了 `outputFileName` 状态变量
- 在UI中添加了"输出文件名（可选）"输入框
- 更新了 `handleStartCompression` 以使用自定义文件名

### 2. 预设大小描述修正
- **高质量慢速**：修正为"最大（CRF值18-20）"
- **快速小文件**：修正为"最小（CRF值28-30）"

### 3. 自定义预设参数说明
添加了详细的参数说明和建议：
- **CRF（质量）**：值越低质量越高体积越大，推荐值
- **Preset（编码速度）**：控制速度与压缩效率平衡
- **最大码率**：可选，留空则不限制码率
- **缓冲区大小**：可选，留空则自动计算

## 测试建议

1. **测试 MKV 文件**：
   - 拖拽一个 MKV 视频文件到应用
   - 确认文件能被成功探测并添加到队列
   - 验证文件信息（时长、分辨率等）正确显示

2. **测试其他格式**：
   - 测试 MP4、AVI、MOV 等格式
   - 确认所有支持的格式都能正常添加

3. **测试自定义文件名**：
   - 输入自定义输出文件名
   - 确认生成的文件使用了自定义名称

4. **测试预设**：
   - 使用"高质量慢速"预设，验证生成最大文件
   - 使用"快速小文件"预设，验证生成较小文件
   - 使用自定义预设，调整 CRF 和 preset 参数

## 修改的文件
- `app/renderer/pages/CompressPage.tsx`
- `app/renderer/components/PresetPicker.tsx`
- `app/main/ipc.ts`
- `app/types/preload.d.ts`

## 状态
✅ 所有4个问题已修复并编译通过
✅ 应用已重新启动并准备测试
