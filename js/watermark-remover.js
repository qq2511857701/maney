/**
 * 豆包 AI 水印去除 — 浏览器 Canvas 版
 * 算法移植自 https://github.com/zhengsuanfa/doubao-watermark-remover
 */

const ALPHA_MAP_URL =
  'https://cdn.jsdelivr.net/gh/zhengsuanfa/doubao-watermark-remover@main/assets/doubao_alpha.png';
const ALPHA_THRESHOLD = 0.15;
const MARGIN_BOTTOM = 5;

let alphaImageCache = null;

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

async function loadAlphaImage() {
  if (alphaImageCache) return alphaImageCache;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      alphaImageCache = img;
      resolve(img);
    };
    img.onerror = () => reject(new Error('无法加载 Alpha 贴图'));
    img.src = ALPHA_MAP_URL;
  });
}

function buildAlphaMap(alphaImg, logoWidth, logoHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = logoWidth;
  canvas.height = logoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(alphaImg, 0, 0, logoWidth, logoHeight);
  const { data } = ctx.getImageData(0, 0, logoWidth, logoHeight);

  const alphaMap = new Float32Array(logoWidth * logoHeight);
  for (let i = 0; i < logoWidth * logoHeight; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    alphaMap[i] = Math.max(r, g, b) / 255;
  }
  return alphaMap;
}

function defaultAlphaMap(logoWidth, logoHeight) {
  const map = new Float32Array(logoWidth * logoHeight);
  map.fill(0.25);
  return map;
}

function medianColor(samples) {
  if (!samples.length) return [100, 100, 100];
  const sorted = [...samples].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  return sorted[Math.floor(sorted.length / 2)];
}

function seededNoise(x, y) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return Math.floor((n - Math.floor(n)) * 7) - 3;
}

/**
 * 去除豆包水印，返回处理后的 canvas
 */
export async function removeDoubaoWatermark(sourceCanvas) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0);

  const { logoWidth, logoHeight, marginRight } = detectWatermarkConfig(width, height);
  const { startX, startY } = calculatePosition(width, height, logoWidth, logoHeight, marginRight);

  let alphaMap;
  try {
    const alphaImg = await loadAlphaImage();
    alphaMap = buildAlphaMap(alphaImg, logoWidth, logoHeight);
  } catch {
    alphaMap = defaultAlphaMap(logoWidth, logoHeight);
  }

  const imageData = ctx.getImageData(0, 0, width, height);
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

  const bgColorMap = {};
  for (let col = 0; col < logoWidth; col++) {
    const samples = [];
    for (let sy = Math.max(0, startY - 60); sy < startY; sy++) {
      const sx = startX + col;
      if (sx >= 0 && sx < width) samples.push(getPixel(sx, sy));
    }
    bgColorMap[col] = medianColor(samples);
  }

  const leftSamples = [];
  for (let sx = Math.max(0, startX - 30); sx < startX; sx++) {
    for (let sy = startY; sy < Math.min(height, startY + logoHeight); sy++) {
      leftSamples.push(getPixel(sx, sy));
    }
  }
  const leftBg = medianColor(leftSamples);

  for (let row = 0; row < logoHeight; row++) {
    const y = startY + row;
    if (y < 0 || y >= height) continue;
    const alphaRowOffset = row * logoWidth;
    for (let col = 0; col < logoWidth; col++) {
      const x = startX + col;
      if (x < 0 || x >= width) continue;

      const alpha = alphaMap[alphaRowOffset + col];
      if (alpha > ALPHA_THRESHOLD) {
        const [bgR, bgG, bgB] = bgColorMap[col] || leftBg;
        const noise = seededNoise(x, y);
        setPixel(
          x,
          y,
          Math.max(0, Math.min(255, bgR + noise)),
          Math.max(0, Math.min(255, bgG + noise)),
          Math.max(0, Math.min(255, bgB + noise))
        );
      }
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
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}
