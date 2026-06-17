/**
 * 图片压缩工具函数
 * 使用 Canvas API 缩放图片并输出为 JPEG 格式的 File 对象
 */
export function compressImage(
  file: File,
  maxWidth: number = 1200,
  quality: number = 0.8
): Promise<File> {
  // 非图片类型直接返回
  if (!file.type.startsWith("image/")) {
    return Promise.resolve(file);
  }

  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // 宽度不超过 maxWidth 则直接返回原文件
      if (img.width <= maxWidth) {
        resolve(file);
        return;
      }

      // 计算缩放后的宽高（保持原始宽高比）
      const scale = maxWidth / img.width;
      const width = maxWidth;
      const height = Math.round(img.height * scale);

      // 创建 Canvas 并绘制缩放后的图片
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("无法创建 canvas 上下文"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // 使用 canvas.toBlob() 输出，PNG 保留透明通道，其他使用 JPEG
      const isPng = file.type === "image/png";
      const outputType = isPng ? "image/png" : "image/jpeg";
      const outputQuality = isPng ? undefined : quality;
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("图片压缩失败"));
            return;
          }
          // 从原始文件名生成输出文件名
          const ext = isPng ? ".png" : ".jpg";
          const fileName = file.name.replace(/\.[^.]+$/, ext);
          const compressedFile = new File([blob], fileName, {
            type: outputType,
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        outputType,
        outputQuality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片加载失败"));
    };

    img.src = url;
  });
}
