import { parseText, formatRx } from './parser.js';
import { convertRecords, formatResult, formatSnappedInput } from './calculator.js';
import { snapRecords } from './snap.js';

const $ = (id) => document.getElementById(id);

const textInput = $('textInput');
const parseHint = $('parseHint');
const reviewBody = $('reviewBody');
const resultBody = $('resultBody');

let reviewRecords = [];
let lastResults = [];

function readReviewTable() {
  const rows = reviewBody.querySelectorAll('tr[data-row]');
  const records = [];
  rows.forEach((tr) => {
    const eye = tr.querySelector('[data-field="eye"]').value;
    const sphere = parseFloat(tr.querySelector('[data-field="sphere"]').value);
    const cylinder = parseFloat(tr.querySelector('[data-field="cylinder"]').value);
    const axis = parseInt(tr.querySelector('[data-field="axis"]').value, 10);
    const qtyRaw = tr.querySelector('[data-field="qty"]').value;
    const qty = qtyRaw ? parseInt(qtyRaw, 10) : 1;

    if (Number.isNaN(sphere)) return;
    records.push({
      eye,
      sphere,
      cylinder: Number.isNaN(cylinder) ? 0 : cylinder,
      axis: Number.isNaN(axis) ? 0 : axis,
      qty,
      source: 'manual',
    });
  });
  return records;
}

function renderReviewTable(records) {
  reviewRecords = records;
  if (!records.length) {
    reviewBody.innerHTML =
      '<tr><td colspan="6" class="empty-state">请先粘贴验光数据并点击「解析文本」</td></tr>';
    return;
  }

  reviewBody.innerHTML = records
    .map(
      (r, i) => `
    <tr data-row="${i}">
      <td>
        <select data-field="eye">
          <option value="右眼" ${r.eye === '右眼' ? 'selected' : ''}>右眼</option>
          <option value="左眼" ${r.eye === '左眼' ? 'selected' : ''}>左眼</option>
          <option value="—" ${r.eye === '—' ? 'selected' : ''}>未指定</option>
        </select>
      </td>
      <td><input data-field="sphere" type="number" step="0.25" value="${r.sphere}" /></td>
      <td><input data-field="cylinder" type="number" step="0.25" value="${r.cylinder}" /></td>
      <td><input data-field="axis" type="number" step="1" min="0" max="180" value="${r.axis}" /></td>
      <td><input data-field="qty" type="number" min="1" value="${r.qty ?? 1}" /></td>
      <td><button class="btn btn-secondary btn-del" data-del="${i}" style="padding:4px 10px;font-size:0.8rem">删</button></td>
    </tr>`
    )
    .join('');

  reviewBody.querySelectorAll('.btn-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.del, 10);
      reviewRecords.splice(idx, 1);
      renderReviewTable(reviewRecords);
    });
  });
}

function renderResults(results) {
  lastResults = results;
  $('btnCopy').disabled = !results.length;

  if (!results.length) {
    resultBody.innerHTML =
      '<tr><td colspan="5" class="empty-state">校对后点击「换算」查看结果</td></tr>';
    return;
  }

  resultBody.innerHTML = results
    .map(({ input, output, adjustments }) => {
      const inStr = formatRx(input);
      const outStr = output.ok ? formatResult(output) : output.error;
      const rowClass = output.ok ? 'row-ok' : 'row-error';
      const alignNote =
        adjustments?.length > 0
          ? `<br><span class="status-warn">对齐：${adjustments.join('，')}</span>`
          : '';
      const status = output.ok
        ? `<span class="status-ok">原站 API</span>${alignNote}`
        : `<span class="status-err">${output.error}</span>${alignNote}`;
      const qty = input.qty ? ` · ${input.qty}盒` : '';
      const alignedLine = output.snappedInput
        ? `<br><small class="status-warn">对齐后 ${formatSnappedInput(output.snappedInput)}</small>`
        : '';
      return `
      <tr class="${rowClass}">
        <td>${input.eye}${qty}</td>
        <td>${inStr}${alignedLine}</td>
        <td class="arrow">→</td>
        <td><strong>${outStr}</strong></td>
        <td>${status}</td>
      </tr>`;
    })
    .join('');
}

function handleParse() {
  const text = textInput.value.trim();
  if (!text) {
    parseHint.textContent = '请先粘贴验光数据';
    parseHint.className = 'hint hint-error';
    return;
  }
  const records = parseText(text);
  if (!records.length) {
    parseHint.textContent =
      '未能识别格式。支持：订单行 -3.50，100，179（1盒）/ 验光单 R: -10.00 / -2.00 x 175 / 聊天格式';
    parseHint.className = 'hint hint-error';
    return;
  }
  const normalized = records.map((r, i) => ({
    ...r,
    eye: r.eye === '—' ? (i === 0 ? '右眼' : i === 1 ? '左眼' : '—') : r.eye,
  }));

  const snapped = snapRecords(normalized);
  const anyChanged = snapped.some((s) => s.changed);
  renderReviewTable(normalized);

  if (anyChanged) {
    const hints = snapped
      .filter((s) => s.changed)
      .map((s) => `${s.record.eye}：${s.adjustments.join('，')}`)
      .join('；');
    parseHint.textContent = `已解析 ${normalized.length} 条。以下将自动对齐原站选项后再换算：${hints}`;
  } else {
    parseHint.textContent = `已解析 ${normalized.length} 条记录，请校对后点击「换算」`;
  }
  parseHint.className = 'hint hint-ok';
}

function initApp() {
  if (!textInput || !reviewBody) {
    const el = document.getElementById('deployHint');
    if (el) {
      el.hidden = false;
      el.textContent = '页面脚本加载失败，请通过 node server.mjs 启动后访问 http://localhost:3456';
    }
    return;
  }

  $('btnParse').addEventListener('click', handleParse);
  $('btnConvert').addEventListener('click', handleConvert);
  $('btnCopy').addEventListener('click', handleCopy);
  $('btnClear').addEventListener('click', handleClear);
  $('btnAddRow').addEventListener('click', handleAddRow);

  if (location.protocol === 'file:') {
    const hint = $('deployHint');
    hint.hidden = false;
    hint.textContent =
      '当前为直接打开本地文件，功能不可用。请运行 node server.mjs 后访问 http://localhost:3456';
  }
}

initApp();

async function handleConvert() {
  const records = readReviewTable();
  if (!records.length) {
    alert('没有可换算的数据');
    return;
  }

  $('btnConvert').disabled = true;
  $('btnConvert').textContent = '换算中…';

  try {
    const results = await convertRecords(records);
    renderResults(results);
  } finally {
    $('btnConvert').disabled = false;
    $('btnConvert').textContent = '换算';
  }
}

function handleCopy() {
  if (!lastResults.length) return;
  const lines = lastResults
    .filter((r) => r.output.ok)
    .map(({ input, output }) => {
      const qty = input.qty ? ` ${input.qty}盒` : '';
      return `${input.eye} ${formatResult(output)}${qty}`;
    });
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    $('btnCopy').textContent = '已复制 ✓';
    setTimeout(() => {
      $('btnCopy').textContent = '复制结果';
    }, 2000);
  });
}

function handleClear() {
  textInput.value = '';
  parseHint.textContent = '';
  parseHint.className = 'hint';
  reviewRecords = [];
  lastResults = [];
  renderReviewTable([]);
  renderResults([]);
}

function handleAddRow() {
  const records = readReviewTable();
  records.push({
    eye: records.length % 2 === 0 ? '右眼' : '左眼',
    sphere: 0,
    cylinder: 0,
    axis: 180,
    qty: 1,
    source: 'manual',
  });
  renderReviewTable(records);
}
