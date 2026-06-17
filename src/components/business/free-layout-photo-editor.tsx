"use client";

import React, { useState, useRef, useEffect } from "react";
import { Rnd } from "react-rnd";
import { Crop, Replace, X, RotateCcw } from "lucide-react";

// 照片布局数据
interface PhotoLayout {
  id: string;
  url: string;
  originalUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: number; // 宽/高比，用于锁定缩放
}

export interface FreeLayoutPhotoEditorProps {
  photos: Array<{ id: string; url: string }>;
  onPhotoEdit?: (photoId: string, newUrl: string) => void;
  onPhotoDelete?: (photoId: string) => void;
  onPhotoReplace?: (photoId: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onPhotoCrop?: (photoId: string, photoUrl: string) => void;
  containerHeight?: number;
}

/** 加载图片并获取其原始宽高比 */
function loadImageAspect(url: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new window.Image();
    if (!url.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight);
    img.onerror = () => resolve(4 / 3); // fallback
    img.src = url;
  });
}

export function FreeLayoutPhotoEditor({ photos, onPhotoEdit, onPhotoDelete, onPhotoReplace, onPhotoCrop, containerHeight = 320 }: FreeLayoutPhotoEditorProps) {
  const isEditable = !!onPhotoEdit;
  const containerRef = useRef<HTMLDivElement>(null);

  const [layouts, setLayouts] = useState<PhotoLayout[]>([]);
  const [prevPhotoIds, setPrevPhotoIds] = useState<string>("");
  const [zIndices, setZIndices] = useState<Record<string, number>>({});
  const nextZRef = useRef(10);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // 同步 photos prop 中的 URL 变更，并重新计算宽高比
  useEffect(() => {
    let cancelled = false;
    const updateLayouts = async () => {
      const updated = await Promise.all(
        layouts.map(async (layout) => {
          const photo = photos.find(p => p.id === layout.id);
          if (photo && photo.url !== layout.url) {
            const newRatio = await loadImageAspect(photo.url);
            // 保持宽度不变，按新比例调整高度
            return {
              ...layout,
              url: photo.url,
              originalUrl: layout.originalUrl || photo.url,
              aspectRatio: newRatio,
              height: layout.width / newRatio,
            };
          }
          return layout;
        })
      );
      if (!cancelled) setLayouts(updated);
    };
    updateLayouts();
    return () => { cancelled = true; };
  }, [photos]);

  // 初始化布局：读取每张图片的实际宽高比
  useEffect(() => {
    const currentPhotoIds = photos.slice(0, 6).map(p => p.id).join(",");
    if (currentPhotoIds === prevPhotoIds) return;
    setPrevPhotoIds(currentPhotoIds);

    const count = Math.min(photos.length, 6);
    if (count === 0) { setLayouts([]); return; }

    let cancelled = false;
    const initLayouts = async () => {
      const cols = count <= 2 ? count : 3;
      const gap = 12;
      const containerWidth = containerRef.current?.offsetWidth || 600;
      const photoWidth = (containerWidth - gap * (cols - 1)) / cols;

      // 并行加载所有图片的宽高比
      const aspects = await Promise.all(photos.slice(0, 6).map(p => loadImageAspect(p.url)));

      if (cancelled) return;

      const newLayouts = photos.slice(0, 6).map((photo, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const ratio = aspects[i];
        const w = photoWidth;
        const h = photoWidth / ratio;
        return {
          id: photo.id,
          url: photo.url,
          originalUrl: photo.url,
          x: col * (photoWidth + gap),
          y: row * (h + gap),
          width: w,
          height: h,
          aspectRatio: ratio,
        };
      });
      setLayouts(newLayouts);
      const newZ: Record<string, number> = {};
      newLayouts.forEach((l, i) => { newZ[l.id] = i + 1; });
      setZIndices(newZ);
      nextZRef.current = newLayouts.length + 1;
    };
    initLayouts();
    return () => { cancelled = true; };
  }, [photos.map(p => p.id).join(","), prevPhotoIds]);

  const handleDragStop = (id: string, d: { x: number; y: number }) => {
    setLayouts(prev => prev.map(l => l.id === id ? { ...l, x: d.x, y: d.y } : l));
  };

  const handleResizeStop = (id: string, d: { x: number; y: number; width: number; height: number }) => {
    setLayouts(prev => prev.map(l => l.id === id ? { ...l, x: d.x, y: d.y, width: d.width, height: d.height } : l));
  };

  const bringToFront = (id: string) => {
    setZIndices(prev => ({ ...prev, [id]: nextZRef.current++ }));
  };

  const sendToBack = (id: string) => {
    setZIndices(prev => {
      const minZ = Math.min(...Object.values(prev));
      return { ...prev, [id]: minZ - 1 };
    });
  };

  const resetPhoto = (photoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const layout = layouts.find(l => l.id === photoId);
    if (!layout || layout.url === layout.originalUrl) return;
    setLayouts(prev => prev.map(l => l.id === photoId ? { ...l, url: l.originalUrl } : l));
    onPhotoEdit?.(photoId, layout.originalUrl);
  };

  if (photos.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="relative print:relative"
      style={{
        height: `${containerHeight}px`,
        minHeight: '200px',
        backgroundColor: isEditable ? '#fafafa' : 'transparent',
        borderRadius: '8px',
        border: isEditable ? '1px dashed #d1d5db' : 'none',
        overflow: 'hidden',
      }}
    >
      {layouts.map((layout) => {
        const zIndex = zIndices[layout.id] || 1;
        const canReset = layout.url !== layout.originalUrl;

        return (
          <div key={layout.id} style={{ position: 'absolute', zIndex }}>
          <Rnd
            position={{ x: layout.x, y: layout.y }}
            size={{ width: layout.width, height: layout.height }}
            onDragStart={() => bringToFront(layout.id)}
            onDragStop={(_e, d) => handleDragStop(layout.id, d)}
            onResizeStop={(_e, _dir, _ref, _delta, pos) => {
              handleResizeStop(layout.id, {
                x: pos.x,
                y: pos.y,
                width: parseFloat(_ref.style.width),
                height: parseFloat(_ref.style.height),
              });
            }}
            enableResizing={isEditable && hoveredId === layout.id ? {
              top: true, right: true, bottom: true, left: true,
              topRight: true, bottomRight: true, bottomLeft: true, topLeft: true,
            } : false}
            disableDragging={!isEditable}
            lockAspectRatio={layout.aspectRatio}
            minWidth={80}
            minHeight={60}
            resizeHandleStyles={{
              top: { width: '100%', height: '8px', top: '-4px', cursor: 'ns-resize' },
              bottom: { width: '100%', height: '8px', bottom: '-4px', cursor: 'ns-resize' },
              left: { height: '100%', width: '8px', left: '-4px', cursor: 'ew-resize' },
              right: { height: '100%', width: '8px', right: '-4px', cursor: 'ew-resize' },
              topLeft: { width: '12px', height: '12px', top: '-4px', left: '-4px', cursor: 'nwse-resize' },
              topRight: { width: '12px', height: '12px', top: '-4px', right: '-4px', cursor: 'nesw-resize' },
              bottomLeft: { width: '12px', height: '12px', bottom: '-4px', left: '-4px', cursor: 'nesw-resize' },
              bottomRight: { width: '12px', height: '12px', bottom: '-4px', right: '-4px', cursor: 'nwse-resize' },
            }}
            resizeHandleComponent={{
              topLeft: <div className="w-3 h-3 bg-white border-2 border-blue-500 rounded-full shadow-sm print:hidden" />,
              topRight: <div className="w-3 h-3 bg-white border-2 border-blue-500 rounded-full shadow-sm print:hidden" />,
              bottomLeft: <div className="w-3 h-3 bg-white border-2 border-blue-500 rounded-full shadow-sm print:hidden" />,
              bottomRight: <div className="w-3 h-3 bg-white border-2 border-blue-500 rounded-full shadow-sm print:hidden" />,
            }}
            style={{ position: 'absolute' }}
            className="group/photo"
            onMouseEnter={() => setHoveredId(layout.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div style={{
              width: '100%', height: '100%', overflow: 'hidden', borderRadius: '6px',
              border: isEditable ? '1px solid #d1d5db' : '1px solid #e5e7eb',
              backgroundColor: '#fafafa', position: 'relative',
            }}>
              <img
                src={layout.url}
                alt="学员照片"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  pointerEvents: 'none',
                  backgroundColor: '#f5f5f5',
                }}
              />

              {/* hover 操作按钮 */}
              {isEditable && (
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/photo:opacity-100 transition-opacity print:hidden" style={{ zIndex: 5 }}>
                  {onPhotoCrop && (
                    <button onClick={(e) => { e.stopPropagation(); onPhotoCrop(layout.id, layout.url); }} className="h-7 w-7 flex items-center justify-center rounded bg-green-500 text-white hover:bg-green-600 shadow-sm" title="裁剪">
                      <Crop className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canReset && (
                    <button onClick={(e) => resetPhoto(layout.id, e)} className="h-7 w-7 flex items-center justify-center rounded bg-amber-500 text-white hover:bg-amber-600 shadow-sm" title="恢复原图">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {onPhotoReplace && (
                    <>
                      <input type="file" accept="image/*" onChange={(e) => { e.stopPropagation(); onPhotoReplace(layout.id, e); }} className="hidden" id={`free-replace-${layout.id}`} />
                      <button onClick={(e) => { e.stopPropagation(); document.getElementById(`free-replace-${layout.id}`)?.click(); }} className="h-7 w-7 flex items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 shadow-sm" title="替换">
                        <Replace className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  {onPhotoDelete && (
                    <button onClick={(e) => { e.stopPropagation(); onPhotoDelete(layout.id); }} className="h-7 w-7 flex items-center justify-center rounded bg-red-500 text-white hover:bg-red-600 shadow-sm" title="删除">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* 图层控制按钮 */}
              {isEditable && hoveredId === layout.id && (
                <div className="absolute top-1 left-1 flex flex-col gap-1 print:hidden" style={{ zIndex: 5 }}>
                  <button onClick={(e) => { e.stopPropagation(); bringToFront(layout.id); }} className="h-6 w-6 flex items-center justify-center rounded bg-purple-500 text-white hover:bg-purple-600 shadow-sm text-xs font-bold" title="置顶">↑</button>
                  <button onClick={(e) => { e.stopPropagation(); sendToBack(layout.id); }} className="h-6 w-6 flex items-center justify-center rounded bg-purple-400 text-white hover:bg-purple-500 shadow-sm text-xs font-bold" title="置底">↓</button>
                </div>
              )}

              {/* 操作提示 */}
              {isEditable && (
                <div className="absolute bottom-1 left-1 right-1 text-center print:hidden" style={{ zIndex: 5 }}>
                  <span className="bg-black/50 text-white text-xs px-2 py-0.5 rounded opacity-0 group-hover/photo:opacity-100 transition-opacity">
                    拖拽移动 | 角落缩放 | ↑↓图层
                  </span>
                </div>
              )}
            </div>
          </Rnd>
          </div>
        );
      })}
    </div>
  );
}
