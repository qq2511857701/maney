/**
 * 对齐 lensfit 各商品下拉选项，并拆分超量盒数
 */

import {
  getProduct,
  PWR_OPTIONS,
  CY_OPTIONS,
  formatPwr,
  formatCy,
  formatAx,
} from './lensfit-products.js';

function nearest(value, options) {
  if (value == null || Number.isNaN(value)) {
    return { value: options[0], changed: true };
  }
  let best = options[0];
  let minDist = Math.abs(value - best);
  for (const opt of options) {
    const d = Math.abs(value - opt);
    if (d < minDist) {
      minDist = d;
      best = opt;
    }
  }
  return { value: best, changed: Math.abs(best - value) > 1e-6 };
}

function fmtAdj(name, from, to, fmt) {
  if (Math.abs(from - to) < 1e-6) return null;
  return `${name} ${fmt(from)} → ${fmt(to)}`;
}

/**
 * 对齐单条记录到 lensfit 选项
 */
export function snapPurchaseRecord(rec) {
  if (!rec.productId) {
    return {
      record: rec,
      valid: false,
      error: '未识别产品名称',
      adjustments: [],
      cartItems: [],
    };
  }

  const product = getProduct(rec.productId);
  if (!product) {
    return {
      record: rec,
      valid: false,
      error: '未知产品',
      adjustments: [],
      cartItems: [],
    };
  }

  const pwrOptions = product.pwrOptions ?? PWR_OPTIONS;
  const pwr = nearest(rec.sphere, pwrOptions);
  const cy = nearest(rec.cylinder || 0, CY_OPTIONS);
  const ax = nearest(rec.axis || 0, product.axOptions);

  const adjustments = [
    fmtAdj('球镜', rec.sphere, pwr.value, (v) => v.toFixed(2)),
    fmtAdj('柱镜', rec.cylinder || 0, cy.value, (v) => v.toFixed(2)),
    fmtAdj('轴位', rec.axis || 0, ax.value, (v) => String(v)),
  ].filter(Boolean);

  const snapped = {
    ...rec,
    productName: product.name,
    sphere: pwr.value,
    cylinder: cy.value,
    axis: ax.value,
    pwr: formatPwr(pwr.value),
    cy: formatCy(cy.value),
    ax: formatAx(ax.value),
  };

  const cartItems = splitQty(snapped, product.maxQty);

  return {
    record: snapped,
    valid: true,
    error: null,
    adjustments,
    changed: adjustments.length > 0,
    cartItems,
  };
}

/** 盒数超过单次上限时拆成多条加购操作 */
function splitQty(rec, maxQty) {
  let remaining = rec.qty || 1;
  const items = [];
  while (remaining > 0) {
    const qty = Math.min(remaining, maxQty);
    items.push({ ...rec, qty });
    remaining -= qty;
  }
  return items;
}

export function snapPurchaseRecords(records) {
  return records.map(snapPurchaseRecord);
}

/**
 * 生成油猴脚本使用的 JSON 队列
 */
export function buildCartQueue(snappedResults) {
  const items = [];
  for (const r of snappedResults) {
    if (!r.valid) continue;
    for (const cartRec of r.cartItems) {
      const product = getProduct(cartRec.productId);
      items.push({
        pid: cartRec.productId,
        productName: product.name,
        url: product.url,
        eye: 'right',
        pwr: cartRec.pwr,
        cy: cartRec.cy,
        ax: cartRec.ax,
        qty: cartRec.qty,
      });
    }
  }
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    items,
  };
}
