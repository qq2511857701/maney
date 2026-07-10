/**
 * 豆包 AI 水印去除 — 浏览器 Canvas 版
 * 仅对文字笔画做白色叠加反混合，不涂抹背景
 */

const ALPHA_MAP_URL =
  'https://cdn.jsdelivr.net/gh/zhengsuanfa/doubao-watermark-remover@main/assets/doubao_alpha.png';
const ALPHA_THRESHOLD = 0.92;
const MARGIN_BOTTOM = 5;
const MAX_DIMENSION = 4096;
const WATERMARK_LUM = 255;

let alphaMapCache = null;

function detectWatermarkConfig(width, height) {
  if (width > 1024 || height > 1024) {
    const scale = Math.min(width, height) / 288;
    return {
      logoWidth: Math.floor(120 * scale * 1.2),
      logoHeight: Math.floor(20 * scale * 1.5),
      marginRight: Math.floor(10 * scale),
    };
  }
  return { logoWidth: 90, logoHeight: 18, marginRight: 8 };
}

function calculatePosition(width, height, logoWidth, logoHeight, marginRight) {
  return {
    startX: width - marginRight - logoWidth,
    startY: height - MARGIN_BOTTOM - logoHeight,
  };
}

function readAlphaFromImageData(data, width, height) {
  const map = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    map[i] = Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) / 255;
  }
  return map;
}

function scaleAlphaNearest(srcMap, srcW, srcH, dstW, dstH) {
  const dst = new Float32Array(dstW * dstH);
  for (let row = 0; row < dstH; row++) {
    const srcRow = Math.min(srcH - 1, Math.floor((row * srcH) / dstH));
    for (let col = 0; col < dstW; col++) {
      const srcCol = Math.min(srcW - 1, Math.floor((col * srcW) / dstW));
      dst[row * dstW + col] = srcMap[srcRow * srcW + srcCol];
    }
  }
  return dst;
}

async function loadAlphaMap(logoWidth, logoHeight) {
  const key = `${logoWidth}x${logoHeight}`;
  if (alphaMapCache?.key === key) return alphaMapCache.map;

  try {
    const res = await fetch(ALPHA_MAP_URL, { mode: 'cors' });
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const srcW = bmp.width;
    const srcH = bmp.height;
    const canvas = document.createElement('canvas');
    canvas.width = srcW;
    canvas.height = srcH;
    canvas.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close();
    const { data } = canvas.getContext('2d').getImageData(0, 0, srcW, srcH);
    const srcMap = readAlphaFromImageData(data, srcW, srcH);
    const alphaMap = scaleAlphaNearest(srcMap, srcW, srcH, logoWidth, logoHeight);
    alphaMapCache = { key, map: alphaMap };
    return alphaMap;
  } catch {
    return new Float32Array(logoWidth * logoHeight);
  }
}

function scaleCanvasIfNeeded(sourceCanvas) {
  const { width, height } = sourceCanvas;
  const maxSide = Math.max(width, height);
  if (maxSide <= MAX_DIMENSION) return { canvas: sourceCanvas, scale: 1 };

  const scale = MAX_DIMENSION / maxSide;
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const scaled = document.createElement('canvas');
  scaled.width = w;
  scaled.height = h;
  scaled.getContext('2d').drawImage(sourceCanvas, 0, 0, w, h);
  return { canvas: scaled, scale };
}

function unblendWhite(r, g, b, alpha) {
  const inv = 1 - alpha;
  if (inv < 0.04) return [r, g, b];
  return [
    Math.max(0, Math.min(255, Math.round((r - alpha * WATERMARK_LUM) / inv))),
    Math.max(0, Math.min(255, Math.round((g - alpha * WATERMARK_LUM) / inv))),
    Math.max(0, Math.min(255, Math.round((b - alpha * WATERMARK_LUM) / inv))),
  ];
}

/**
 * 去除豆包水印，返回处理后的 canvas
 */
export async function removeDoubaoWatermark(sourceCanvas) {
  const { canvas: workCanvas } = scaleCanvasIfNeeded(sourceCanvas);
  const width = workCanvas.width;
  const height = workCanvas.height;
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(workCanvas, 0, 0);

  const { logoWidth, logoHeight, marginRight } = detectWatermarkConfig(width, height);
  const { startX, startY } = calculatePosition(width, height, logoWidth, logoHeight, marginRight);
  const alphaMap = await loadAlphaMap(logoWidth, logoHeight);

  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, width, height);
  } catch {
    throw new Error('图片过大或浏览器不支持，请缩小后重试');
  }
  const pixels = imageData.data;

  for (let row = 0; row < logoHeight; row++) {
    const y = startY + row;
    if (y < 0 || y >= height) continue;
    const rowOffset = row * logoWidth;
    for (let col = 0; col < logoWidth; col++) {
      const alpha = alphaMap[rowOffset + col];
      if (alpha < ALPHA_THRESHOLD) continue;

      const x = startX + col;
      if (x < 0 || x >= width) continue;

      const i = (y * width + x) * 4;
      const [nr, ng, nb] = unblendWhite(pixels[i], pixels[i + 1], pixels[i + 2], alpha);
      pixels[i] = nr;
      pixels[i + 1] = ng;
      pixels[i + 2] = nb;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

export function fileToCanvas(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };
    img.src = url;
  });
}

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('导出失败'));
        },
        type,
        quality
      );
    } catch (e) {
      reject(e);
    }
  });
}
