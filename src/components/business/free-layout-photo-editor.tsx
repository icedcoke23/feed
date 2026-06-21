"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
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
  fillContainer?: boolean;
}

/** 加载图片并获取其原始宽高比 */
function loadImageAspect(url: string): Promise<number> {
  return new Promise((resolve) => {
    if (!url || url.trim() === "") {
      resolve(4 / 3);
      return;
    }
    const img = new window.Image();
    if (!url.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      resolve(isFinite(ratio) && ratio > 0 ? ratio : 4 / 3);
    };
    img.onerror = () => resolve(4 / 3); // fallback
    img.src = url;
  });
}

export function FreeLayoutPhotoEditor({ photos, onPhotoEdit, onPhotoDelete, onPhotoReplace, onPhotoCrop, containerHeight = 320, fillContainer = false }: FreeLayoutPhotoEditorProps) {
  const isEditable = !!onPhotoEdit;
  const containerRef = useRef<HTMLDivElement>(null);

  const validPhotos = photos.slice(0, 6).filter(p => p.url && p.url.trim());
  if (photos.length > 0 && validPhotos.length === 0) {
    console.warn("[PhotoEditor] photos provided but none have valid URLs:", photos);
  }

  const [layouts, setLayouts] = useState<PhotoLayout[]>([]);
  const [prevPhotoIds, setPrevPhotoIds] = useState<string>("");
  const [zIndices, setZIndices] = useState<Record<string, number>>({});
  const nextZRef = useRef(10);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

  const currentPhotoIds = useMemo(
    () => photos.slice(0, 6).map(p => p.id).join(","),
    [photos]
  );

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
      if (!cancelled) {
        setTimeout(() => setLayouts(updated), 0);
      }
    };
    updateLayouts();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  // 初始化布局：读取每张图片的实际宽高比
  useEffect(() => {
    if (currentPhotoIds === prevPhotoIds) return;

    setTimeout(() => setPrevPhotoIds(currentPhotoIds), 0);

    // 过滤掉没有有效URL的照片
    const validPhotos = photos.slice(0, 6).filter(p => p.url && p.url.trim());
    console.log('[PhotoEditor] input photos:', photos.length, 'validPhotos:', validPhotos.length, 'urls:', validPhotos.map(p => ({id: p.id, urlLen: p.url?.length, urlPrefix: p.url?.slice(0, 30)})));
    const count = validPhotos.length;

    // 清理已不存在照片的失败记录
    setTimeout(() => {
      setFailedImageIds(prev => {
        const next = new Set(prev);
        next.forEach(id => {
          if (!validPhotos.find(p => p.id === id)) next.delete(id);
        });
        return next;
      });
    }, 0);

    if (count === 0) { console.warn('[PhotoEditor] no valid photos'); setTimeout(() => setLayouts([]), 0); return; }

    const initLayouts = async () => {
      const cols = count <= 2 ? count : 3;
      const gap = 12;
      const containerWidth = containerRef.current?.offsetWidth || 600;
      const photoWidth = (containerWidth - gap * (cols - 1)) / cols;

      // 并行加载所有图片的宽高比
      const aspects = await Promise.all(validPhotos.map(p => loadImageAspect(p.url)));

      const newLayouts = validPhotos.map((photo, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const ratio = aspects[i];
        const w = Math.max(10, photoWidth);
        const h = Math.max(10, photoWidth / (isFinite(ratio) && ratio > 0 ? ratio : 4 / 3));
        return {
          id: photo.id,
          url: photo.url,
          originalUrl: photo.url,
          x: col * (photoWidth + gap),
          y: row * (h + gap),
          width: w,
          height: h,
          aspectRatio: isFinite(ratio) && ratio > 0 ? ratio : 4 / 3,
        };
      });
      setTimeout(() => {
        setLayouts(newLayouts);
        const newZ: Record<string, number> = {};
        newLayouts.forEach((l, i) => { newZ[l.id] = i + 1; });
        setZIndices(newZ);
        nextZRef.current = newLayouts.length + 1;
      }, 0);
    };
    initLayouts();
  }, [currentPhotoIds, prevPhotoIds, photos]);

  // 重试机制：首次计算时容器宽度可能为 0，延迟重新计算
  useEffect(() => {
    if (!currentPhotoIds) return;

    const timer = setTimeout(() => {
      const actualWidth = containerRef.current?.offsetWidth;
      if (actualWidth && actualWidth > 0) {
        // 检查当前布局是否使用了 fallback 宽度（600），如果是则重新计算
        const usedFallback = layouts.length > 0 && Math.abs(layouts[0].width - ((600 - 12 * (Math.min(photos.length, 6) <= 2 ? Math.min(photos.length, 6) : 3) - 1) / (Math.min(photos.length, 6) <= 2 ? Math.min(photos.length, 6) : 3))) < 1;
        if (usedFallback) {
          setPrevPhotoIds(""); // 重置以触发重新计算
        }
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [currentPhotoIds, layouts, photos]);

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
      className="relative print:relative print-overflow-visible"
      style={{
        height: fillContainer ? '100%' : `${containerHeight}px`,
        minHeight: '200px',
        backgroundColor: isEditable ? '#fafafa' : 'transparent',
        borderRadius: '8px',
        border: isEditable ? '1px dashed #d1d5db' : '2px solid red',
        overflow: 'hidden',
      }}
    >
      {layouts.length === 0 && <div className="flex items-center justify-center h-full text-gray-400 text-sm">正在加载照片...</div>}
      {layouts.map((layout) => {
        const zIndex = zIndices[layout.id] || 1;
        const canReset = layout.url !== layout.originalUrl;
        const isHovered = hoveredId === layout.id;

        return (
          <Rnd
            key={layout.id}
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
            enableResizing={isEditable ? {
              top: false, right: false, bottom: false, left: false,
              topRight: true, bottomRight: true, bottomLeft: true, topLeft: true,
            } : false}
            disableDragging={!isEditable}
            lockAspectRatio={layout.aspectRatio}
            minWidth={80}
            minHeight={60}
            resizeHandleStyles={{
              topRight: { width: '16px', height: '16px', top: '-4px', right: '-4px', cursor: 'nesw-resize' },
              bottomRight: { width: '16px', height: '16px', bottom: '-4px', right: '-4px', cursor: 'nwse-resize' },
              bottomLeft: { width: '16px', height: '16px', bottom: '-4px', left: '-4px', cursor: 'nesw-resize' },
              topLeft: { width: '16px', height: '16px', top: '-4px', left: '-4px', cursor: 'nwse-resize' },
            }}
            resizeHandleComponent={{
              topRight: <div className={`w-3 h-3 bg-white border-2 border-blue-500 rounded-full shadow-sm print:hidden transition-opacity duration-150 ${isHovered ? 'opacity-100' : 'opacity-0'}`} />,
              bottomRight: <div className={`w-3 h-3 bg-white border-2 border-blue-500 rounded-full shadow-sm print:hidden transition-opacity duration-150 ${isHovered ? 'opacity-100' : 'opacity-0'}`} />,
              bottomLeft: <div className={`w-3 h-3 bg-white border-2 border-blue-500 rounded-full shadow-sm print:hidden transition-opacity duration-150 ${isHovered ? 'opacity-100' : 'opacity-0'}`} />,
              topLeft: <div className={`w-3 h-3 bg-white border-2 border-blue-500 rounded-full shadow-sm print:hidden transition-opacity duration-150 ${isHovered ? 'opacity-100' : 'opacity-0'}`} />,
            }}
            style={{ position: 'absolute', zIndex }}
            className="group/photo"
            onMouseEnter={() => setHoveredId(layout.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div style={{
              width: '100%', height: '100%', overflow: 'hidden', borderRadius: '6px',
              border: isEditable ? '1px solid #d1d5db' : '1px solid #e5e7eb',
              backgroundColor: '#fafafa', position: 'relative',
            }}>
              {failedImageIds.has(layout.id) ? (
                <div style={{
                  width: '100%', height: '100%',
                  backgroundColor: '#e5e7eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#9ca3af', fontSize: '14px',
                }}>
                  图片加载失败
                </div>
              ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={layout.url}
                  alt="学员照片"
                  loading="eager"
                  onLoad={() => console.log('[Photo] loaded:', layout.id)}
                  onError={() => {
                    console.error('[Photo] load failed:', layout.id, layout.url);
                    setFailedImageIds(prev => new Set(prev).add(layout.id));
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    pointerEvents: 'none',
                    backgroundColor: '#f5f5f5',
                  }}
                />
              </>
              )}

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
        );
      })}
    </div>
  );
}
