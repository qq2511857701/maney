/**
 * 豆包 AI 水印去除 — 反混合算法，仅去除水印叠加，不涂抹背景
 */

const ALPHA_MAP_URL = new URL('../assets/doubao_alpha.png', import.meta.url).href;
const ALPHA_MAP_CDN =
  'https://cdn.jsdelivr.net/gh/zhengsuanfa/doubao-watermark-remover@main/assets/doubao_alpha.png';
const HALO_ALPHA = 0.78;
const MARGIN_BOTTOM = 5;
const MAX_DIMENSION = 4096;
const WATERMARK_LUM = 255;

let alphaMapCache = null;

function detectWatermarkConfig(width, height) {
  const scale = Math.min(width, height) / 288;
  if (scale <= 1.05) {
    return { logoWidth: 90, logoHeight: 18, marginRight: 8 };
  }
  return {
    logoWidth: Math.floor(120 * scale * 1.2),
    logoHeight: Math.floor(20 * scale * 1.5),
    marginRight: Math.floor(10 * scale),
  };
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

async function fetchAlphaBlob() {
  for (const url of [ALPHA_MAP_URL, ALPHA_MAP_CDN]) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.blob();
    } catch {
      /* try next */
    }
  }
  throw new Error('alpha map unavailable');
}

async function loadAlphaMap(logoWidth, logoHeight) {
  const key = `${logoWidth}x${logoHeight}`;
  if (alphaMapCache?.key === key) return alphaMapCache.map;

  const blob = await fetchAlphaBlob();
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

function seededNoise(x, y) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return Math.floor((n - Math.floor(n)) * 7) - 3;
}

function unblendWhite(r, g, b, alpha) {
  const a = Math.min(0.96, Math.max(0.04, alpha));
  const inv = 1 - a;
  return [
    Math.max(0, Math.min(255, Math.round((r - a * WATERMARK_LUM) / inv))),
    Math.max(0, Math.min(255, Math.round((g - a * WATERMARK_LUM) / inv))),
    Math.max(0, Math.min(255, Math.round((b - a * WATERMARK_LUM) / inv))),
  ];
}

function restorePixel(r, g, b, mapAlpha, refR, refG, refB, x, y) {
  if (mapAlpha >= 0.92) {
    const n = seededNoise(x, y);
    return [
      Math.max(0, Math.min(255, refR + n)),
      Math.max(0, Math.min(255, refG + n)),
      Math.max(0, Math.min(255, refB + n)),
    ];
  }
  return unblendWhite(r, g, b, mapAlpha);
}

function observedOverlayAlpha(r, g, b, refR, refG, refB) {
  const channels = [0, 1, 2].map((c) => {
    const ch = [r, g, b][c];
    const ref = [refR, refG, refB][c];
    const denom = WATERMARK_LUM - ref;
    if (denom < 12) return 0;
    return (ch - ref) / denom;
  });
  return Math.max(0, Math.min(1, Math.max(...channels)));
}

function sampleRefAbove(pixels, width, x, y, startY) {
  const sy = Math.max(0, Math.min(startY - 4, y - 12));
  const i = (sy * width + x) * 4;
  return [pixels[i], pixels[i + 1], pixels[i + 2]];
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
  const edgeColStart = Math.floor(logoWidth * 0.55);

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
      const mapAlpha = alphaMap[rowOffset + col];
      if (mapAlpha < 0.12) continue;

      const x = startX + col;
      if (x < 0 || x >= width) continue;

      const i = (y * width + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const [refR, refG, refB] = sampleRefAbove(pixels, width, x, y, startY);

      let useAlpha = 0;
      if (mapAlpha >= HALO_ALPHA) {
        useAlpha = mapAlpha;
      } else if (col >= edgeColStart) {
        const observed = observedOverlayAlpha(r, g, b, refR, refG, refB);
        if (observed >= 0.18) useAlpha = observed;
      }
      if (useAlpha < 0.12) continue;

      const [nr, ng, nb] = restorePixel(r, g, b, useAlpha, refR, refG, refB, x, y);
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
