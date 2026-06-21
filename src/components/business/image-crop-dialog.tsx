"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCw, RotateCcw, FlipHorizontal, FlipVertical, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { toast } from "sonner";

interface ImageCropDialogProps {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedImageDataUrl: string) => void;
  title?: string;
  defaultAspect?: number | undefined;
  showAspectOptions?: boolean;
  maxZoom?: number;
}

const ASPECT_OPTIONS = [
  { label: "自由", value: undefined },
  { label: "1:1", value: 1 },
  { label: "3:4", value: 3 / 4 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
] as const;

// 裁剪输出
function getCroppedImg(
  imageSrc: string,
  pixelArea: { x: number; y: number; width: number; height: number },
  rotation: number = 0,
  flipH: boolean = false,
  flipV: boolean = false
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    if (!imageSrc.startsWith("data:")) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("无法创建 canvas 上下文")); return; }

      const rotRad = (rotation * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rotRad));
      const cos = Math.abs(Math.cos(rotRad));
      const cropW = pixelArea.width;
      const cropH = pixelArea.height;
      const rotW = cropW * cos + cropH * sin;
      const rotH = cropW * sin + cropH * cos;

      canvas.width = Math.round(rotW);
      canvas.height = Math.round(rotH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rotRad);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(image, pixelArea.x, pixelArea.y, cropW, cropH, -cropW / 2, -cropH / 2, cropW, cropH);
      const isPng = imageSrc.startsWith("data:image/png");
      const outputType = isPng ? "image/png" : "image/jpeg";
      const quality = isPng ? undefined : 0.9;
      resolve(canvas.toDataURL(outputType, quality));
    };
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = imageSrc;
  });
}

// ==================== 自由裁剪组件 ====================
type DragHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "move" | null;

interface FreeCropRect {
  x: number; // 百分比 0-1
  y: number;
  width: number;
  height: number;
}

function FreeCropOverlay({
  containerWidth,
  containerHeight,
  cropRect,
  onCropRectChange,
}: {
  containerWidth: number;
  containerHeight: number;
  cropRect: FreeCropRect;
  onCropRectChange: (rect: FreeCropRect) => void;
}) {
  const [dragging, setDragging] = useState<DragHandle>(null);
  const dragStartRef = useRef<{ mx: number; my: number; rect: FreeCropRect } | null>(null);

  const handleMouseDown = useCallback((handle: DragHandle, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(handle);
    dragStartRef.current = { mx: e.clientX, my: e.clientY, rect: { ...cropRect } };
  }, [cropRect]);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const { mx, my, rect } = dragStartRef.current;
      const dx = (e.clientX - mx) / containerWidth;
      const dy = (e.clientY - my) / containerHeight;
      const MIN = 0.05;

      const newRect = { ...rect };
      const handle = dragging;

      if (handle === "move") {
        newRect.x = Math.max(0, Math.min(1 - rect.width, rect.x + dx));
        newRect.y = Math.max(0, Math.min(1 - rect.height, rect.y + dy));
      } else {
        // 水平边
        if (handle.includes("w")) {
          const newX = Math.max(0, Math.min(rect.x + rect.width - MIN, rect.x + dx));
          newRect.width = rect.x + rect.width - newX;
          newRect.x = newX;
        }
        if (handle.includes("e")) {
          newRect.width = Math.max(MIN, Math.min(1 - rect.x, rect.width + dx));
        }
        // 垂直边
        if (handle.includes("n")) {
          const newY = Math.max(0, Math.min(rect.y + rect.height - MIN, rect.y + dy));
          newRect.height = rect.y + rect.height - newY;
          newRect.y = newY;
        }
        if (handle.includes("s")) {
          newRect.height = Math.max(MIN, Math.min(1 - rect.y, rect.height + dy));
        }
      }

      onCropRectChange(newRect);
    };
    const handleMouseUp = () => { setDragging(null); dragStartRef.current = null; };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [dragging, containerWidth, containerHeight, onCropRectChange]);

  // 触摸支持
  useEffect(() => {
    if (!dragging) return;
    const handleTouchMove = (e: TouchEvent) => {
      if (!dragStartRef.current || !e.touches[0]) return;
      e.preventDefault();
      const { mx, my, rect } = dragStartRef.current;
      const dx = (e.touches[0].clientX - mx) / containerWidth;
      const dy = (e.touches[0].clientY - my) / containerHeight;
      const MIN = 0.05;
      const newRect = { ...rect };
      const handle = dragging;
      if (handle === "move") {
        newRect.x = Math.max(0, Math.min(1 - rect.width, rect.x + dx));
        newRect.y = Math.max(0, Math.min(1 - rect.height, rect.y + dy));
      } else {
        if (handle.includes("w")) { const nX = Math.max(0, Math.min(rect.x + rect.width - MIN, rect.x + dx)); newRect.width = rect.x + rect.width - nX; newRect.x = nX; }
        if (handle.includes("e")) { newRect.width = Math.max(MIN, Math.min(1 - rect.x, rect.width + dx)); }
        if (handle.includes("n")) { const nY = Math.max(0, Math.min(rect.y + rect.height - MIN, rect.y + dy)); newRect.height = rect.y + rect.height - nY; newRect.y = nY; }
        if (handle.includes("s")) { newRect.height = Math.max(MIN, Math.min(1 - rect.y, rect.height + dy)); }
      }
      onCropRectChange(newRect);
    };
    const handleTouchEnd = () => { setDragging(null); dragStartRef.current = null; };
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    return () => { window.removeEventListener("touchmove", handleTouchMove); window.removeEventListener("touchend", handleTouchEnd); };
  }, [dragging, containerWidth, containerHeight, onCropRectChange]);

  const px = (v: number, total: number) => v * total;
  const left = px(cropRect.x, containerWidth);
  const top = px(cropRect.y, containerHeight);
  const width = px(cropRect.width, containerWidth);
  const height = px(cropRect.height, containerHeight);

  const handleStyle = (pos: string): React.CSSProperties => ({
    position: "absolute",
    ...(pos.includes("n") ? { top: -5 } : pos.includes("s") ? { bottom: -5 } : { top: "50%", marginTop: -5 }),
    ...(pos.includes("w") ? { left: -5 } : pos.includes("e") ? { right: -5 } : { left: "50%", marginLeft: -5 }),
    width: pos === "n" || pos === "s" ? width + 10 : 10,
    height: pos === "e" || pos === "w" ? height + 10 : 10,
    cursor: `${pos === "move" ? "move" : pos + "-resize"}`,
    zIndex: 10,
  });

  const cornerStyle = (pos: string): React.CSSProperties => ({
    position: "absolute",
    width: 12, height: 12, borderRadius: 2,
    backgroundColor: "white", border: "2px solid #3b82f6",
    ...(pos === "nw" ? { top: -6, left: -6, cursor: "nwse-resize" } :
      pos === "ne" ? { top: -6, right: -6, cursor: "nesw-resize" } :
      pos === "sw" ? { bottom: -6, left: -6, cursor: "nesw-resize" } :
      { bottom: -6, right: -6, cursor: "nwse-resize" }),
    zIndex: 11,
  });

  return (
    <div className="absolute inset-0" style={{ touchAction: "none", userSelect: "none" }}>
      {/* 遮罩：上 */}
      <div className="absolute bg-black/50" style={{ left: 0, top: 0, width: "100%", height: top }} />
      {/* 遮罩：下 */}
      <div className="absolute bg-black/50" style={{ left: 0, top: top + height, width: "100%", height: containerHeight - top - height }} />
      {/* 遮罩：左 */}
      <div className="absolute bg-black/50" style={{ left: 0, top, width: left, height }} />
      {/* 遮罩：右 */}
      <div className="absolute bg-black/50" style={{ left: left + width, top, width: containerWidth - left - width, height }} />

      {/* 裁剪框 */}
      <div
        className="absolute border-2 border-white/90"
        style={{ left, top, width, height, cursor: "move" }}
        onMouseDown={(e) => handleMouseDown("move", e)}
        onTouchStart={(e) => { e.preventDefault(); const t = e.touches[0]; setDragging("move"); dragStartRef.current = { mx: t.clientX, my: t.clientY, rect: { ...cropRect } }; }}
      >
        {/* 三分线 */}
        <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
        <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
        <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
        <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />

        {/* 边缘拖拽区域 */}
        {(["n", "s", "e", "w"] as const).map((h) => (
          <div key={h} style={handleStyle(h)} onMouseDown={(e) => handleMouseDown(h, e)} onTouchStart={(e) => { e.preventDefault(); const t = e.touches[0]; setDragging(h); dragStartRef.current = { mx: t.clientX, my: t.clientY, rect: { ...cropRect } }; }} />
        ))}

        {/* 四角手柄 */}
        {(["nw", "ne", "sw", "se"] as const).map((c) => (
          <div key={c} style={cornerStyle(c)} onMouseDown={(e) => handleMouseDown(c, e)} onTouchStart={(e) => { e.preventDefault(); const t = e.touches[0]; setDragging(c); dragStartRef.current = { mx: t.clientX, my: t.clientY, rect: { ...cropRect } }; }} />
        ))}
      </div>
    </div>
  );
}

// ==================== 主组件 ====================
export function ImageCropDialog({
  open,
  onClose,
  imageSrc,
  onCropComplete,
  title = "裁剪图片",
  defaultAspect = undefined,
  showAspectOptions = true,
  maxZoom = 5,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(defaultAspect);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [cropping, setCropping] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const cropperContainerRef = useRef<HTMLDivElement>(null);

  // 自由裁剪状态
  const isFreeCrop = aspect === undefined;
  const [freeCropRect, setFreeCropRect] = useState<FreeCropRect>({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
  const [freeImageSize, setFreeImageSize] = useState<{ w: number; h: number } | null>(null);
  const freeImgRef = useRef<HTMLImageElement | null>(null);

  // 图片变更时重置
  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      setCroppedAreaPixels(null);
      setImageLoaded(false);
      setAspect(defaultAspect);
      setFreeCropRect({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
      setFreeImageSize(null);
    }
  }, [open, imageSrc, defaultAspect]);

  // 自由裁剪：计算像素区域
  const getFreeCropPixels = useCallback((): Area | null => {
    if (!freeImageSize) return null;
    // 旋转 90/270 度时宽高互换
    const isRotated90or270 = rotation === 90 || rotation === 270;
    const imgW = isRotated90or270 ? freeImageSize.h : freeImageSize.w;
    const imgH = isRotated90or270 ? freeImageSize.w : freeImageSize.h;
    return {
      x: Math.round(freeCropRect.x * imgW),
      y: Math.round(freeCropRect.y * imgH),
      width: Math.round(freeCropRect.width * imgW),
      height: Math.round(freeCropRect.height * imgH),
    };
  }, [freeCropRect, freeImageSize, rotation]);

  const handleConfirm = useCallback(async () => {
    const pixelArea = isFreeCrop ? getFreeCropPixels() : croppedAreaPixels;
    if (!pixelArea) return;
    setCropping(true);
    try {
      const croppedDataUrl = await getCroppedImg(imageSrc, pixelArea, rotation, flipH, flipV);
      onCropComplete(croppedDataUrl);
    } catch {
      toast.error("裁剪失败，请重试");
    } finally {
      setCropping(false);
    }
  }, [imageSrc, croppedAreaPixels, onCropComplete, rotation, flipH, flipV, isFreeCrop, getFreeCropPixels]);

  const handleClose = useCallback(() => onClose(), [onClose]);

  // 键盘快捷键
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleConfirm(); }
      else if (e.key === "Escape") { e.preventDefault(); handleClose(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, croppedAreaPixels, imageSrc, cropping, freeCropRect, rotation, flipH, flipV, handleClose, handleConfirm]);

  // 滚轮缩放（仅固定比例模式）
  useEffect(() => {
    if (isFreeCrop) return;
    const container = cropperContainerRef.current;
    if (!container || !open) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((prev) => Math.min(maxZoom, Math.max(1, Math.round((prev + delta) * 10) / 10)));
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [open, maxZoom, isFreeCrop]);

  const onCropChange = useCallback((location: Point) => setCrop(location), []);
  const onZoomChange = useCallback((value: number) => setZoom(value), []);
  const onCropAreaComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
    setImageLoaded(true);
  }, []);

  const handleAspectChange = useCallback((value: number | undefined) => {
    setAspect(value);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    if (value === undefined) {
      setFreeCropRect({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
    }
  }, []);

  const handleRotate = useCallback((deg: number) => setRotation((prev) => (prev + deg + 360) % 360), []);
  const handleFlipH = useCallback(() => setFlipH((prev) => !prev), []);
  const handleFlipV = useCallback(() => setFlipV((prev) => !prev), []);
  const handleReset = useCallback(() => {
    setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0); setFlipH(false); setFlipV(false);
    setAspect(defaultAspect);
    setFreeCropRect({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
  }, [defaultAspect]);
  const handleZoomIn = useCallback(() => setZoom((prev) => Math.min(maxZoom, Math.round((prev + 0.2) * 10) / 10)), [maxZoom]);
  const handleZoomOut = useCallback(() => setZoom((prev) => Math.max(1, Math.round((prev - 0.2) * 10) / 10)), []);

  // 自由裁剪的图片加载
  const handleFreeImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    freeImgRef.current = img;
    setFreeImageSize({ w: img.naturalWidth, h: img.naturalHeight });
    setImageLoaded(true);
  }, []);

  // 当前裁剪区域像素信息
  const currentCropPixels = isFreeCrop ? getFreeCropPixels() : croppedAreaPixels;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-3xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isFreeCrop ? "拖拽裁剪框边缘或角落调整大小，拖拽框内移动位置" : "拖动调整裁剪区域，滚轮缩放，选择合适的比例后确认"}
          </DialogDescription>
        </DialogHeader>

        {/* 裁剪区域 */}
        <div
          ref={cropperContainerRef}
          className="relative w-full h-[450px] bg-[#1a1a2e] rounded-lg overflow-hidden"
        >
          {isFreeCrop ? (
            // 自由裁剪模式：自研裁剪框
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt="裁剪"
                className="w-full h-full object-contain"
                style={{ transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})` }}
                onLoad={handleFreeImageLoad}
                crossOrigin={imageSrc.startsWith("data:") ? undefined : "anonymous"}
              />
              {imageLoaded && (
                <FreeCropOverlay
                  containerWidth={cropperContainerRef.current?.offsetWidth || 600}
                  containerHeight={cropperContainerRef.current?.offsetHeight || 450}
                  cropRect={freeCropRect}
                  onCropRectChange={setFreeCropRect}
                />
              )}
            </>
          ) : (
            // 固定比例模式：react-easy-crop
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropAreaComplete}
              style={{
                containerStyle: { background: "#1a1a2e" },
                cropAreaStyle: { border: "2px solid rgba(255,255,255,0.8)" },
              }}
              classes={{ cropAreaClassName: "rounded-sm" }}
              restrictPosition={true}
            />
          )}

          {/* 加载状态 */}
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a2e]">
              <div className="flex flex-col items-center gap-2 text-white/60">
                <div className="w-8 h-8 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                <span className="text-sm">加载中...</span>
              </div>
            </div>
          )}
        </div>

        {/* 工具栏 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => handleRotate(-90)} title="逆时针旋转90°" className="h-8 w-8">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleRotate(90)} title="顺时针旋转90°" className="h-8 w-8">
              <RotateCw className="h-4 w-4" />
            </Button>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <Button variant="ghost" size="icon" onClick={handleFlipH} title="水平翻转" className={`h-8 w-8 ${flipH ? "bg-blue-100 text-blue-600" : ""}`}>
              <FlipHorizontal className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleFlipV} title="垂直翻转" className={`h-8 w-8 ${flipV ? "bg-blue-100 text-blue-600" : ""}`}>
              <FlipVertical className="h-4 w-4" />
            </Button>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <Button variant="ghost" size="icon" onClick={handleReset} title="重置" className="h-8 w-8">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>

          {/* 缩放（仅固定比例模式） */}
          {!isFreeCrop && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={zoom <= 1} className="h-8 w-8">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <input type="range" min={1} max={maxZoom} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-28 h-1.5 accent-blue-600 cursor-pointer" />
              <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={zoom >= maxZoom} className="h-8 w-8">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <span className="text-xs text-gray-500 w-10 text-right tabular-nums">{zoom.toFixed(1)}x</span>
            </div>
          )}
        </div>

        {/* 比例选项 */}
        {showAspectOptions && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 shrink-0">比例</span>
            {ASPECT_OPTIONS.map((opt) => (
              <Button
                key={opt.label}
                variant={aspect === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => handleAspectChange(opt.value)}
                className="min-w-[48px] h-7 text-xs"
              >
                {opt.label}
              </Button>
            ))}
            {rotation !== 0 && <span className="ml-auto text-xs text-gray-400">{rotation}°</span>}
          </div>
        )}

        {/* 裁剪信息 */}
        {currentCropPixels && (
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>裁剪区域: {Math.round(currentCropPixels.width)} x {Math.round(currentCropPixels.height)} px</span>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={cropping}>取消</Button>
          <Button onClick={handleConfirm} disabled={cropping || (!isFreeCrop && !croppedAreaPixels) || (isFreeCrop && !freeImageSize)}>
            {cropping ? "处理中..." : "确认裁剪"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
