# Tasks

- [x] Task 1: 修复 ImageCropDialog 的 crossOrigin 问题
  - [x] 1.1: 在 `getCroppedImg` 函数中，对非 data URL 的图片设置 `img.crossOrigin = "anonymous"`
  - [x] 1.2: 对 data URL 图片不设置 crossOrigin，避免 CORS 错误

- [x] Task 2: 重构 FreeLayoutPhotoEditor，移除内联裁剪，新增 onPhotoCrop 回调
  - [x] 2.1: 移除 `croppingId`、`cropRects`、`cropping` 状态和 `onCropEdgeDown`、`confirmCrop`、`cancelCrop` 函数
  - [x] 2.2: 移除裁剪覆盖层渲染代码（手柄、遮罩、确认/取消按钮）
  - [x] 2.3: 移除 `activeListenersRef` 及其清理 useEffect
  - [x] 2.4: 新增 `onPhotoCrop?: (photoId: string, photoUrl: string) => void` prop
  - [x] 2.5: 裁剪按钮的 onClick 改为调用 `onPhotoCrop(layout.id, layout.url)`
  - [x] 2.6: 移除容器 style 中的 `userSelect`/`touchAction` 裁剪相关逻辑
  - [x] 2.7: 移除 `CropRect` 接口定义

- [x] Task 3: 在 PDF 页面集成 ImageCropDialog 裁剪流程
  - [x] 3.1: 在 `pdf/page.tsx` 中添加裁剪对话框状态（`cropDialogOpen`、`cropPhotoId`、`cropPhotoUrl`）
  - [x] 3.2: 实现 `handlePhotoCrop` 回调：设置裁剪照片信息并打开对话框
  - [x] 3.3: 实现 `handleCropComplete` 回调：裁剪完成后调用 `handlePhotoEdit` 更新照片 URL
  - [x] 3.4: 将 `onPhotoCrop` 回调通过 `PdfAnalysisPage` 传递到 `FreeLayoutPhotoEditor`
  - [x] 3.5: 在 `PdfAnalysisPage` 的 props 接口中添加 `onPhotoCrop`
  - [x] 3.6: 渲染 `ImageCropDialog` 组件，绑定状态和回调

# Task Dependencies
- Task 2 依赖 Task 1（先修复 ImageCropDialog，再集成）
- Task 3 依赖 Task 2（需要 onPhotoCrop 回调才能集成）
