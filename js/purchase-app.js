import { parsePurchaseText } from './purchase-parser.js';
import { snapPurchaseRecords, buildCartQueue } from './purchase-snap.js';
import { PRODUCTS, isSphereProduct } from './lensfit-products.js';

const $ = (id) => document.getElementById(id);

const purchaseInput = $('purchaseInput');
const purchaseHint = $('purchaseHint');
const purchaseBody = $('purchaseBody');
const btnPurchaseParse = $('btnPurchaseParse');
const btnPurchaseClear = $('btnPurchaseClear');
const btnPurchaseExport = $('btnPurchaseExport');

let purchaseRecords = [];
let snappedResults = [];

function productOptions(selectedId) {
  const placeholder = `<option value="" ${!selectedId ? 'selected' : ''}>请选择</option>`;
  const opts = Object.values(PRODUCTS)
    .map(
      (p) =>
        `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.name}</option>`
    )
    .join('');
  return placeholder + opts;
}

function bcOptions(selectedBc, productId) {
  const product = PRODUCTS[productId];
  const opts = product?.bcOptions || [8.4, 8.8];
  const selected = selectedBc ?? opts[0];
  return opts
    .map(
      (bc) =>
        `<option value="${bc}" ${Number(bc) === Number(selected) ? 'selected' : ''}>${bc}</option>`
    )
    .join('');
}

function readPurchaseTable() {
  const rows = purchaseBody.querySelectorAll('tr[data-row]');
  const records = [];
  rows.forEach((tr, i) => {
    const productId = tr.querySelector('[data-field="product"]').value;
    const sphere = parseFloat(tr.querySelector('[data-field="sphere"]').value);
    const bcEl = tr.querySelector('[data-field="bc"]');
    const cylEl = tr.querySelector('[data-field="cylinder"]');
    const axEl = tr.querySelector('[data-field="axis"]');
    const qty = parseInt(tr.querySelector('[data-field="qty"]').value, 10) || 1;

    if (!productId || Number.isNaN(sphere)) return;

    const sphereProd = isSphereProduct(productId);
    const bc = bcEl ? parseFloat(bcEl.value) : null;
    const cylinder = cylEl ? parseFloat(cylEl.value) : 0;
    const axis = axEl ? parseInt(axEl.value, 10) : 0;

    records.push({
      lineNum: i + 1,
      productId,
      productName: PRODUCTS[productId]?.name ?? '',
      kind: sphereProd ? 'sphere' : 'toric',
      bc: sphereProd && !Number.isNaN(bc) ? bc : null,
      sphere,
      cylinder: sphereProd || Number.isNaN(cylinder) ? 0 : cylinder,
      axis: sphereProd || Number.isNaN(axis) ? 0 : axis,
      qty,
      eye: 'right',
      source: 'manual',
    });
  });
  return records;
}

function renderPurchaseTable(records, snapped) {
  purchaseRecords = records;
  snappedResults = snapped || [];

  if (!records.length) {
    purchaseBody.innerHTML =
      '<tr><td colspan="8" class="empty-state">请先粘贴采购清单并点击「解析清单」</td></tr>';
    btnPurchaseExport.disabled = true;
    return;
  }

  purchaseBody.innerHTML = records
    .map((r, i) => {
      const snap = snappedResults[i];
      const rowClass = snap && !snap.valid ? 'row-error' : snap?.changed ? 'row-warn' : '';
      const status = !snap
        ? ''
        : !snap.valid
          ? `<span class="status-err">${snap.error}</span>`
          : snap.changed
            ? `<span class="status-warn">${snap.adjustments.join('；')}</span>`
            : `<span class="status-ok">OK</span>`;
      const cartCount = snap?.valid ? snap.cartItems.length : 0;
      const cartNote =
        cartCount > 1 ? `<br><small class="status-warn">拆为 ${cartCount} 次加购</small>` : '';

      const display = snap?.record || r;
      const sphereProd = isSphereProduct(display.productId);

      const bcCell = sphereProd
        ? `<select data-field="bc">${bcOptions(display.bc, display.productId)}</select>`
        : `<span class="muted">—</span>`;
      const cylCell = sphereProd
        ? `<span class="muted">—</span>`
        : `<input data-field="cylinder" type="number" step="0.25" value="${display.cylinder ?? 0}" />`;
      const axCell = sphereProd
        ? `<span class="muted">—</span>`
        : `<input data-field="axis" type="number" step="1" min="0" max="180" value="${display.axis ?? 0}" />`;

      return `
    <tr data-row="${i}" class="${rowClass}">
      <td>
        <select data-field="product">${productOptions(display.productId)}</select>
      </td>
      <td>${bcCell}</td>
      <td><input data-field="sphere" type="number" step="0.25" value="${display.sphere}" /></td>
      <td>${cylCell}</td>
      <td>${axCell}</td>
      <td><input data-field="qty" type="number" min="1" value="${display.qty ?? 1}" style="width:52px" /></td>
      <td>${status}${cartNote}</td>
      <td><button class="btn btn-secondary btn-del" data-del="${i}" style="padding:4px 10px;font-size:0.8rem">删</button></td>
    </tr>`;
    })
    .join('');

  purchaseBody.querySelectorAll('.btn-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.del, 10);
      purchaseRecords.splice(idx, 1);
      resnapAndRender();
    });
  });

  const allValid = snappedResults.every((s) => s.valid);
  btnPurchaseExport.disabled = !allValid || !records.length;
}

function resnapAndRender() {
  const records = readPurchaseTable();
  const snapped = snapPurchaseRecords(records);
  renderPurchaseTable(records, snapped);
}

function handlePurchaseParse() {
  const text = purchaseInput.value.trim();
  if (!text) {
    purchaseHint.textContent = '请先粘贴采购清单';
    purchaseHint.className = 'hint hint-error';
    return;
  }

  const records = parsePurchaseText(text);
  if (!records.length) {
    purchaseHint.textContent =
      '未能识别。散光：散光日抛[TAB]-3.25,75,180（2盒）；普通双周：普通双周[TAB]BC8.4 250度(1盒)';
    purchaseHint.className = 'hint hint-error';
    return;
  }

  const snapped = snapPurchaseRecords(records);
  renderPurchaseTable(records, snapped);

  const invalid = snapped.filter((s) => !s.valid);
  const changed = snapped.filter((s) => s.changed);

  if (invalid.length) {
    purchaseHint.textContent = `已解析 ${records.length} 条，${invalid.length} 条产品名未识别，请在表格中手动选择`;
    purchaseHint.className = 'hint hint-error';
  } else if (changed.length) {
    purchaseHint.textContent = `已解析 ${records.length} 条，部分度数已对齐 lensfit 选项，请确认后复制队列`;
    purchaseHint.className = 'hint hint-warn';
  } else {
    purchaseHint.textContent = `已解析 ${records.length} 条，确认后点击「复制采购队列」`;
    purchaseHint.className = 'hint hint-ok';
  }
}

function handlePurchaseClear() {
  purchaseInput.value = '';
  purchaseHint.textContent = '';
  purchaseHint.className = 'hint';
  purchaseRecords = [];
  snappedResults = [];
  renderPurchaseTable([]);
}

async function handlePurchaseExport() {
  resnapAndRender();
  const invalid = snappedResults.filter((s) => !s.valid);
  if (invalid.length) {
    alert('存在无效条目，请修正产品或度数后再导出');
    return;
  }

  const queue = buildCartQueue(snappedResults);
  const json = JSON.stringify(queue, null, 2);

  try {
    await navigator.clipboard.writeText(json);
    btnPurchaseExport.textContent = '已复制 ✓';
    purchaseHint.textContent = `已复制 ${queue.items.length} 条加购任务。请登录 lensfit.jp 后，用油猴脚本「从剪贴板加载」→「开始加购」`;
    purchaseHint.className = 'hint hint-ok';
  } catch {
    prompt('复制以下 JSON 到剪贴板：', json);
  }

  setTimeout(() => {
    btnPurchaseExport.textContent = '复制采购队列';
  }, 2500);
}

export function initPurchaseApp() {
  if (!purchaseInput || !purchaseBody) return;

  btnPurchaseParse.addEventListener('click', handlePurchaseParse);
  btnPurchaseClear.addEventListener('click', handlePurchaseClear);
  btnPurchaseExport.addEventListener('click', handlePurchaseExport);

  purchaseBody.addEventListener('change', () => resnapAndRender());
  purchaseBody.addEventListener('input', (e) => {
    if (e.target.matches('input, select')) resnapAndRender();
  });
}
