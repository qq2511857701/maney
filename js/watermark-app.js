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
const resultCanvas = $('wmResult');
const btnProcess = $('wmProcess');
const btnDownload = $('wmDownload');
const btnClear = $('wmClear');

let currentFile = null;
let resultBlob = null;

function setHint(text, type = '') {
  hint.textContent = text;
  hint.className = 'hint' + (type ? ` hint-${type}` : '');
}

function resizeCanvasToDisplay(canvas, maxW = 420) {
  const ratio = Math.min(1, maxW / canvas.width);
  canvas.style.width = `${Math.round(canvas.width * ratio)}px`;
  canvas.style.height = `${Math.round(canvas.height * ratio)}px`;
}

async function loadPreview(file) {
  currentFile = file;
  resultBlob = null;
  btnDownload.disabled = true;

  const canvas = await fileToCanvas(file);
  originalCanvas.width = canvas.width;
  originalCanvas.height = canvas.height;
  originalCanvas.getContext('2d').drawImage(canvas, 0, 0);
  resizeCanvasToDisplay(originalCanvas);

  resultCanvas.width = canvas.width;
  resultCanvas.height = canvas.height;
  resultCanvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

  previewWrap.hidden = false;
  btnProcess.disabled = false;
  setHint(`已加载 ${file.name}（${canvas.width}×${canvas.height}）`, 'ok');
}

async function handleProcess() {
  if (!currentFile) return;
  btnProcess.disabled = true;
  btnProcess.textContent = '处理中…';
  setHint('正在去除右下角「豆包AI生成」水印…');

  try {
    const src = await fileToCanvas(currentFile);
    const out = await removeDoubaoWatermark(src);
    resultCanvas.width = out.width;
    resultCanvas.height = out.height;
    resultCanvas.getContext('2d').drawImage(out, 0, 0);
    resizeCanvasToDisplay(resultCanvas);

    const ext = currentFile.name.split('.').pop()?.toLowerCase();
    const type = ext === 'png' ? 'image/png' : 'image/jpeg';
    resultBlob = await canvasToBlob(out, type, 0.92);
    btnDownload.disabled = false;
    setHint('处理完成，可下载或对比左右效果', 'ok');
  } catch (e) {
    setHint(`处理失败：${e.message}`, 'error');
  } finally {
    btnProcess.disabled = false;
    btnProcess.textContent = '去除水印';
  }
}

function handleDownload() {
  if (!resultBlob || !currentFile) return;
  const base = currentFile.name.replace(/\.[^.]+$/, '');
  const ext = resultBlob.type === 'image/png' ? 'png' : 'jpg';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(resultBlob);
  a.download = `${base}_no_watermark.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function handleClear() {
  currentFile = null;
  resultBlob = null;
  fileInput.value = '';
  previewWrap.hidden = true;
  btnProcess.disabled = true;
  btnDownload.disabled = true;
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
  btnProcess.addEventListener('click', handleProcess);
  btnDownload.addEventListener('click', handleDownload);
  btnClear.addEventListener('click', handleClear);
}
