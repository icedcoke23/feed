# Tasks

- [x] Task 1: 修复边缘裁剪闭包陈旧值问题
  - [x] 1.1: 将 `onCropEdgeDown` 中的 `cropDragging` state 替换为局部变量 `dragInfo`，保存 edge/startX/startY/startRect
  - [x] 1.2: 移除 `onMove` 中的 `if (!cropDragging) return;` 判断，改用局部变量 `dragInfo`
  - [x] 1.3: 修正 dx/dy 计算，使用 `dragInfo.startX/startY` 和 `dragInfo.startRect` 作为基准
  - [x] 1.4: 移除不再需要的 `cropDragging` state

- [x] Task 2: 修复图层 z-index 传递和事件拦截问题
  - [x] 2.1: 在 Rnd 外层包裹一个 div，将 z-index 设置在外层 div 上，而非 Rnd 的 style prop
  - [x] 2.2: 在 Rnd 的 `onDragStart` 回调中触发 `bringToFront`，替代 `onMouseDown`
  - [x] 2.3: 移除 `handlePhotoMouseDown`，改用 `onDragStart` + 图层按钮两种方式触发图层切换

# Task Dependencies
- Task 2 依赖 Task 1（裁剪模式下拖拽被禁用，需确保裁剪逻辑正确后再调整拖拽行为）
