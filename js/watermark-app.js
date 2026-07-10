import {
  removeDoubaoWatermark,
  fileToCanvas,
  canvasToBlob,
} from './watermark-remover.js';

const $ = (id) => document.getElementById(id);

const dropZone = $('wmDropZone');
const fileInput = $('wmFileInput');
const hint = $('wmHint');
const previewWrap = $('wmPreviewWrap');
const originalCanvas = $('wmOriginal');
const resultImg = $('wmResult');
const resultPlaceholder = $('wmResultPlaceholder');
const btnDownload = $('wmDownload');
const btnClear = $('wmClear');

let currentFile = null;
let resultBlob = null;
let resultObjectUrl = null;

function setHint(text, type = '') {
  hint.textContent = text;
  hint.className = 'hint' + (type ? ` hint-${type}` : '');
}

function resizeCanvasToDisplay(canvas, maxW = 420) {
  if (!canvas.width || !canvas.height) return;
  const ratio = Math.min(1, maxW / canvas.width);
  canvas.style.width = `${Math.round(canvas.width * ratio)}px`;
  canvas.style.height = `${Math.round(canvas.height * ratio)}px`;
}

function clearResultPreview() {
  if (resultObjectUrl) {
    URL.revokeObjectURL(resultObjectUrl);
    resultObjectUrl = null;
  }
  resultBlob = null;
  resultImg.removeAttribute('src');
  resultImg.hidden = true;
  resultPlaceholder.hidden = false;
  btnDownload.disabled = true;
}

async function loadPreview(file) {
  currentFile = file;
  clearResultPreview();

  const canvas = await fileToCanvas(file);
  originalCanvas.width = canvas.width;
  originalCanvas.height = canvas.height;
  originalCanvas.getContext('2d').drawImage(canvas, 0, 0);
  resizeCanvasToDisplay(originalCanvas);

  previewWrap.hidden = false;
  setHint(`已加载 ${file.name}（${canvas.width}×${canvas.height}），正在去水印…`);
  await handleProcess(canvas);
}

async function handleProcess(srcCanvas) {
  if (!currentFile) return;
  setHint('正在去除右下角「豆包AI生成」水印…');

  try {
    const src = srcCanvas || (await fileToCanvas(currentFile));
    const out = await removeDoubaoWatermark(src);

    const blob = await canvasToBlob(out, 'image/png');

    if (!blob) {
      throw new Error('图片导出失败，请尝试换一张较小的图片');
    }

    resultBlob = blob;
    if (resultObjectUrl) URL.revokeObjectURL(resultObjectUrl);
    resultObjectUrl = URL.createObjectURL(blob);

    await new Promise((resolve, reject) => {
      resultImg.onload = () => resolve();
      resultImg.onerror = () => reject(new Error('预览加载失败'));
      resultImg.src = resultObjectUrl;
      if (resultImg.complete) resolve();
    });

    resultImg.hidden = false;
    resultPlaceholder.hidden = true;
    btnDownload.disabled = false;
    setHint('处理完成，可下载或对比左右效果', 'ok');
  } catch (e) {
    clearResultPreview();
    setHint(`处理失败：${e.message}`, 'error');
  }
}

function handleDownload() {
  if (!resultBlob || !currentFile) return;
  const base = currentFile.name.replace(/\.[^.]+$/, '');
  const ext = 'png';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(resultBlob);
  a.download = `${base}_no_watermark.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function handleClear() {
  currentFile = null;
  fileInput.value = '';
  previewWrap.hidden = true;
  clearResultPreview();
  setHint('');
}

function bindDropZone() {
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('is-dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('is-dragover');
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) loadPreview(file);
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) loadPreview(file);
  });
}

export function initWatermarkApp() {
  if (!dropZone) return;
  bindDropZone();
  btnDownload.addEventListener('click', handleDownload);
  btnClear.addEventListener('click', handleClear);
}
