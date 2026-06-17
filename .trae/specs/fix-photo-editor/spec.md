# 修复照片编辑器裁剪和图层功能 Spec

## Why
FreeLayoutPhotoEditor 组件的边缘裁剪和图层控制功能存在代码 bug，导致功能完全不可用或行为异常。

## What Changes
- 修复边缘裁剪的闭包陈旧值问题（`cropDragging` 在 `onMove` 中始终为 `null`）
- 修复图层 z-index 传递方式（Rnd `style` prop 可能被内部覆盖）
- 修复图层切换事件被 Rnd 拖拽逻辑拦截的问题

## Impact
- Affected code: `src/app/feedback/pdf/page.tsx` 中的 `FreeLayoutPhotoEditor` 组件

## ADDED Requirements

### Requirement: 边缘裁剪功能正常工作
系统 SHALL 在用户点击裁剪按钮后，允许用户拖拽四边绿色线条向内移动来裁剪照片。

#### Scenario: 拖拽裁剪边线
- **WHEN** 用户点击裁剪按钮进入裁剪模式
- **AND** 用户按住某条绿色边线并拖动
- **THEN** 被裁掉的区域应实时显示半透明黑色遮罩
- **AND** 保留区域应实时显示原始图片内容
- **AND** 确认裁剪后应使用 Canvas 实际裁剪图片

#### Scenario: 取消裁剪
- **WHEN** 用户点击取消按钮
- **THEN** 照片恢复原始状态，裁剪区域重置

### Requirement: 图层控制功能正常工作
系统 SHALL 允许用户通过点击和按钮控制照片的图层顺序。

#### Scenario: 点击照片置顶
- **WHEN** 用户点击某张照片
- **THEN** 该照片应自动移到最上层（z-index 最高）

#### Scenario: 使用置顶/置底按钮
- **WHEN** 用户 hover 某张照片并点击 ↑ 按钮
- **THEN** 该照片应移到所有照片最上层
- **WHEN** 用户 hover 某张照片并点击 ↓ 按钮
- **THEN** 该照片应移到所有照片最下层

## MODIFIED Requirements

### Requirement: 边缘裁剪实现方式
将 `onCropEdgeDown` 中的闭包陈旧值问题修复：使用局部变量保存拖拽信息，而非依赖异步更新的 React state。

### Requirement: 图层 z-index 传递方式
将 z-index 从 Rnd 的 `style` prop 移到外层包裹 div，避免被 Rnd 内部样式覆盖；同时在 Rnd 的 `onDragStart` 回调中触发 `bringToFront`，确保拖拽时图层正确更新。
