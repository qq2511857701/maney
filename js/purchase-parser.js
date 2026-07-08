/**
 * 采购清单解析：产品名 + 订单行度数
 * 散光日抛	－3.25,75,180（2盒）
 */

import { normalizeOcrText } from './parser.js';
import { resolveProductId, getProduct } from './lensfit-products.js';

function parseSphere(raw) {
  if (raw == null || raw === '') return null;
  let s = String(raw).trim().replace(/[度°DSds]/gi, '');
  if (/^\(([-\d.]+)\)$/.test(s)) s = s.slice(1, -1);
  if (/^-?\d+$/.test(s) && !s.includes('.')) {
    const n = parseInt(s, 10);
    if (Math.abs(n) >= 100) return n / 100;
    if (Math.abs(n) > 20 && Math.abs(n) < 100) return n / 10;
  }
  const v = parseFloat(s);
  return Number.isNaN(v) ? null : v;
}

function parseCylinder(raw) {
  if (raw == null || raw === '' || /^NA$/i.test(String(raw).trim())) return 0;
  const s = String(raw).trim().replace(/\.$/, '');
  if (s.startsWith('-') || s.includes('.')) {
    let v = parseFloat(s);
    if (Number.isNaN(v)) return 0;
    if (!s.includes('.') && Math.abs(v) >= 100) v = v / 100;
    else if (!s.includes('.') && Math.abs(v) > 20 && Math.abs(v) < 100) v = v / 10;
    return v <= 0 ? v : -Math.abs(v);
  }
  const n = parseInt(s, 10);
  if (Number.isNaN(n)) return 0;
  if (n >= 25 && n <= 350) return -(n / 100);
  if (n >= 100) return -(n / 100);
  return -Math.abs(n / 100);
}

function parseAxis(raw) {
  if (raw == null || raw === '') return 0;
  const n = parseInt(String(raw).replace(/[°度.]/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

function parseQty(raw) {
  if (!raw) return 1;
  const m = String(raw).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

function splitProductAndParams(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const tabParts = trimmed.split(/\t+/);
  if (tabParts.length >= 2) {
    return { productName: tabParts[0].trim(), params: tabParts.slice(1).join('\t').trim() };
  }

  const spaceMatch = trimmed.match(/^(.+?)\s+(-?\d[\d.，,\s（(]+)$/);
  if (spaceMatch) {
    return { productName: spaceMatch[1].trim(), params: spaceMatch[2].trim() };
  }

  const orderOnly = trimmed.match(/^(-?\d+\.?\d*)\s*[，,]/);
  if (orderOnly) return { productName: '', params: trimmed };

  return null;
}

function parseParams(paramsStr) {
  const qtyMatch = paramsStr.match(/[（(]\s*(\d+)\s*盒\s*[）)]/);
  const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
  const withoutQty = paramsStr.replace(/[（(][^）)]*[）)]/g, '');

  const commaMatch = withoutQty.match(
    /(-?\d+\.?\d*)\s*[，,]\s*(-?\d+\.?\d*)\s*[，,]\s*(\d+)/
  );
  if (!commaMatch) return null;

  const sphere = parseSphere(commaMatch[1]);
  if (sphere == null) return null;

  return {
    sphere,
    cylinder: parseCylinder(commaMatch[2]),
    axis: parseAxis(commaMatch[3]),
    qty,
  };
}

function parsePurchaseLine(line, lineNum) {
  const parts = splitProductAndParams(line);
  if (!parts) return null;

  const params = parseParams(parts.params);
  if (!params) return null;

  const productId = resolveProductId(parts.productName);
  const product = productId ? getProduct(productId) : null;

  return {
    lineNum,
    productName: parts.productName || (product?.name ?? ''),
    productId,
    sphere: params.sphere,
    cylinder: params.cylinder,
    axis: params.axis,
    qty: params.qty,
    eye: 'right',
    source: 'purchase',
  };
}

/**
 * 解析整段采购文本
 */
export function parsePurchaseText(text) {
  if (!text || !text.trim()) return [];

  const normalized = normalizeOcrText(text);
  const lines = normalized.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const results = [];
  lines.forEach((line, i) => {
    const rec = parsePurchaseLine(line, i + 1);
    if (rec) results.push(rec);
  });
  return results;
}
