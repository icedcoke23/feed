# 修复 PDF 页面图片裁剪功能 Spec

## Why
PDF 页面的 `FreeLayoutPhotoEditor` 组件中，裁剪功能完全不可用。根因是裁剪覆盖层被 3 层 `overflow: hidden` 容器裁剪，且自研的边缘拖拽方案与 Rnd 组件存在事件冲突。项目已有基于 `react-easy-crop` 的成熟裁剪组件 `ImageCropDialog`，应复用它。

## What Changes
- 移除 `FreeLayoutPhotoEditor` 中的自研内联裁剪功能（边缘拖拽、裁剪覆盖层、confirmCrop 等）
- 裁剪按钮改为打开 `ImageCropDialog` 模态框进行裁剪
- 保留 `FreeLayoutPhotoEditor` 的拖拽/缩放/图层/替换/删除/恢复原图功能不变
- 修复 `ImageCropDialog` 中 `getCroppedImg` 未处理 `crossOrigin` 的问题（data URL 图片二次裁剪会失败）

## Impact
- Affected code: `src/components/business/free-layout-photo-editor.tsx`（移除裁剪逻辑，裁剪按钮改为触发回调）
- Affected code: `src/components/business/pdf-analysis-page.tsx`（添加 `ImageCropDialog` 状态管理）
- Affected code: `src/app/feedback/pdf/page.tsx`（添加裁剪对话框的状态和回调）
- Affected code: `src/components/business/image-crop-dialog.tsx`（修复 crossOrigin 问题）

## 根因分析

### 问题 1: 三层 overflow: hidden 裁剪
PDF 页面的 DOM 结构：
```
A4 页面 div (overflow-hidden)          ← 第 1 层
  └─ contentStyle div (overflow:hidden) ← 第 2 层
       └─ FreeLayoutPhotoEditor (overflow:hidden) ← 第 3 层
            └─ 裁剪覆盖层 (被裁剪!)
```
裁剪覆盖层的确认/取消按钮（`-top-10`）和超出照片边缘的手柄全部被裁剪掉，用户看不到也无法操作。

### 问题 2: 自研边缘拖拽与 Rnd 事件冲突
即使解决了 overflow 问题，裁剪手柄的 mousedown 事件仍可能被 Rnd（react-draggable）的原生事件监听器拦截。之前将手柄移到 Rnd 外部只是部分缓解，Rnd 的 window 级别事件监听仍可能干扰。

### 问题 3: ImageCropDialog 的 crossOrigin 缺陷
`getCroppedImg` 函数未设置 `img.crossOrigin`，对跨域图片可能失败；同时未对 data URL 做特殊处理，二次裁剪可能触发 CORS 错误。

## ADDED Requirements

### Requirement: PDF 页面照片裁剪使用模态框
系统 SHALL 在用户点击裁剪按钮时，打开 `ImageCropDialog` 模态框进行裁剪，而非内联裁剪。

#### Scenario: 点击裁剪按钮
- **WHEN** 用户在 PDF 页面 hover 照片并点击裁剪按钮
- **THEN** 弹出 `ImageCropDialog` 模态框，显示该照片
- **AND** 用户可在模态框中拖拽裁剪框、调整缩放和宽高比
- **AND** 确认裁剪后，裁剪结果替换原照片

#### Scenario: 取消裁剪
- **WHEN** 用户在裁剪模态框中点击取消
- **THEN** 模态框关闭，照片保持不变

### Requirement: FreeLayoutPhotoEditor 新增 onPhotoCrop 回调
系统 SHALL 提供 `onPhotoCrop` 回调 prop，当用户点击裁剪按钮时触发，传递照片 ID 和 URL，由父组件负责打开裁剪对话框。

#### Scenario: 裁剪回调触发
- **WHEN** 用户点击照片的裁剪按钮
- **THEN** 调用 `onPhotoCrop(photoId, photoUrl)`
- **AND** 父组件打开 `ImageCropDialog` 并传入 `photoUrl`

## MODIFIED Requirements

### Requirement: FreeLayoutPhotoEditor 移除内联裁剪
移除 `FreeLayoutPhotoEditor` 中的所有内联裁剪相关代码：`croppingId`、`cropRects`、`onCropEdgeDown`、`confirmCrop`、`cancelCrop`、裁剪覆盖层渲染。裁剪按钮改为调用 `onPhotoCrop` 回调。

### Requirement: ImageCropDialog 修复 crossOrigin
`getCroppedImg` 函数 SHALL 对非 data URL 的图片设置 `img.crossOrigin = "anonymous"`，对 data URL 不设置 crossOrigin，避免二次裁剪失败。

## REMOVED Requirements

### Requirement: 内联边缘拖拽裁剪
**Reason**: 自研边缘拖拽方案存在三层 overflow 裁剪和 Rnd 事件冲突的架构性问题，无法可靠修复。改用已验证的 `react-easy-crop` 模态框方案。
**Migration**: 裁剪按钮行为从"进入内联裁剪模式"变为"打开裁剪模态框"，用户体验更好（有缩放、比例控制、实时预览）。
