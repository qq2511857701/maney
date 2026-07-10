/**
 * 豆包「豆包AI生成」水印去除 — 精简版
 *
 * 思路（与开源 doubao-watermark-remover 一致）：
 * 1. 定位右下角水印区域
 * 2. 仅处理 alpha 贴图中「文字笔画」位置（高 alpha + 区域在右侧）
 * 3. 用该列上方背景色替换，不整块打码
 */

const ALPHA_MAP_URL = new URL('../assets/doubao_alpha.png', import.meta.url).href;
const ALPHA_MAP_CDN =
  'https://cdn.jsdelivr.net/gh/zhengsuanfa/doubao-watermark-remover@main/assets/doubao_alpha.png';
const ALPHA_THRESHOLD = 0.82;
const TEXT_COL_RATIO = 0.38;
const MARGIN_BOTTOM = 5;
const MAX_DIMENSION = 4096;

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

async function fetchAlphaBlob() {
  for (const url of [ALPHA_MAP_URL, ALPHA_MAP_CDN]) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.blob();
    } catch {
      /* try next */
    }
  }
  throw new Error('无法加载水印贴图');
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
  const map = new Float32Array(logoWidth * logoHeight);
  for (let row = 0; row < logoHeight; row++) {
    const srcRow = Math.min(srcH - 1, Math.floor((row * srcH) / logoHeight));
    for (let col = 0; col < logoWidth; col++) {
      const srcCol = Math.min(srcW - 1, Math.floor((col * srcW) / logoWidth));
      const idx = (srcRow * srcW + srcCol) * 4;
      map[row * logoWidth + col] =
        Math.max(data[idx], data[idx + 1], data[idx + 2]) / 255;
    }
  }

  alphaMapCache = { key, map };
  return map;
}

function scaleCanvasIfNeeded(sourceCanvas) {
  const maxSide = Math.max(sourceCanvas.width, sourceCanvas.height);
  if (maxSide <= MAX_DIMENSION) return sourceCanvas;

  const scale = MAX_DIMENSION / maxSide;
  const w = Math.round(sourceCanvas.width * scale);
  const h = Math.round(sourceCanvas.height * scale);
  const scaled = document.createElement('canvas');
  scaled.width = w;
  scaled.height = h;
  scaled.getContext('2d').drawImage(sourceCanvas, 0, 0, w, h);
  return scaled;
}

function medianColor(samples) {
  if (!samples.length) return [100, 100, 100];
  const sorted = [...samples].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  return sorted[Math.floor(sorted.length / 2)];
}

function seededNoise(x, y) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return Math.floor((n - Math.floor(n)) * 5) - 2;
}

export async function removeDoubaoWatermark(sourceCanvas) {
  const workCanvas = scaleCanvasIfNeeded(sourceCanvas);
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
  const textColStart = Math.floor(logoWidth * TEXT_COL_RATIO);

  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, width, height);
  } catch {
    throw new Error('图片过大或浏览器不支持，请缩小后重试');
  }
  const pixels = imageData.data;

  const getPixel = (x, y) => {
    const i = (y * width + x) * 4;
    return [pixels[i], pixels[i + 1], pixels[i + 2]];
  };

  const setPixel = (x, y, r, g, b) => {
    const i = (y * width + x) * 4;
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
  };

  const bgByCol = new Array(logoWidth);
  for (let col = 0; col < logoWidth; col++) {
    const samples = [];
    for (let sy = Math.max(0, startY - 50); sy < startY; sy++) {
      const sx = startX + col;
      if (sx >= 0 && sx < width) samples.push(getPixel(sx, sy));
    }
    bgByCol[col] = medianColor(samples);
  }

  for (let row = 0; row < logoHeight; row++) {
    const y = startY + row;
    if (y < 0 || y >= height) continue;

    for (let col = textColStart; col < logoWidth; col++) {
      const alpha = alphaMap[row * logoWidth + col];
      if (alpha < ALPHA_THRESHOLD) continue;

      const x = startX + col;
      if (x < 0 || x >= width) continue;

      const [bgR, bgG, bgB] = bgByCol[col];
      const n = seededNoise(x, y);
      setPixel(
        x,
        y,
        Math.max(0, Math.min(255, bgR + n)),
        Math.max(0, Math.min(255, bgG + n)),
        Math.max(0, Math.min(255, bgB + n))
      );
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
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('导出失败'))),
      type,
      quality
    );
  });
}
