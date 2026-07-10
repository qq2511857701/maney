/**
 * 散光软镜度数换算 — 对齐原站选项后调用 API
 */

import { snapRecord } from './snap.js';

const API_URL =
  'https://ax.51i.cc/api/widgets/query_product_by_sku?authcode=CN20230209ASD43ADSCADZ';

function getApiUrl() {
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return '/api/convert';
  }
  return API_URL;
}

async function callOriginalApi(body) {
  const res = await fetch(getApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`原站 API 返回 HTTP ${res.status}`);

  const json = await res.json();
  const item = json.data?.[0];
  if (!item) throw new Error('原站未返回产品数据');

  return item;
}

function parseApiEye(data, side, inputSphere) {
  const prefix = side === 'right' ? 'Right' : 'Left';
  const sphere = parseFloat(data[`sphere${prefix}`]);
  const cylinder = parseFloat(data[`cylinder${prefix}`]);
  const axis = parseInt(data[`axis${prefix}`], 10);

  if (Number.isNaN(sphere)) return null;
  if (sphere === 0 && (cylinder || 0) === 0 && inputSphere !== 0) return null;

  return { sphere, cylinder: cylinder || 0, axis: axis || 0, fromApi: true };
}

function buildApiBody(right, left) {
  return {
    sphereRight: right ? right.sphere : null,
    cylinderRight: right ? right.cylinder || 0 : 0,
    axisRight: right ? right.axis || 0 : 0,
    sphereLeft: left ? left.sphere : null,
    cylinderLeft: left ? left.cylinder || 0 : 0,
    axisLeft: left ? left.axis || 0 : 0,
    productId: [0],
    lensDeflectionLeft: 0,
    lensDeflectionRight: 0,
  };
}

function fail(error, extra = {}) {
  return { ok: false, error, ...extra };
}

function success(out, extra = {}) {
  return { ok: true, ...out, fromApi: true, ...extra };
}

/**
 * 批量换算：先对齐原站下拉框，再请求 API
 */
export async function convertRecords(records) {
  const snappedList = records.map((rec) => {
    const { record, adjustments, changed } = snapRecord(rec);
    return { original: rec, snapped: record, adjustments, changed };
  });

  const outputs = new Map();

  const rightEntry = snappedList.find((s) => s.snapped.eye === '右眼');
  const leftEntry = snappedList.find((s) => s.snapped.eye === '左眼');
  const others = snappedList.filter(
    (s) => s.snapped.eye !== '右眼' && s.snapped.eye !== '左眼'
  );

  const attachMeta = (entry, output) => ({
    input: entry.original,
    snapped: entry.snapped,
    adjustments: entry.adjustments,
    output: {
      ...output,
      adjustments: entry.adjustments,
      snappedInput: entry.changed ? entry.snapped : null,
    },
  });

  if (rightEntry || leftEntry) {
    try {
      const item = await callOriginalApi(
        buildApiBody(rightEntry?.snapped, leftEntry?.snapped)
      );

      if (rightEntry) {
        const out = parseApiEye(item, 'right', rightEntry.snapped.sphere);
        outputs.set(
          rightEntry.original,
          attachMeta(
            rightEntry,
            out ? success(out) : fail('原站无匹配产品，请检查参数')
          )
        );
      }
      if (leftEntry) {
        const out = parseApiEye(item, 'left', leftEntry.snapped.sphere);
        outputs.set(
          leftEntry.original,
          attachMeta(
            leftEntry,
            out ? success(out) : fail('原站无匹配产品，请检查参数')
          )
        );
      }
    } catch (err) {
      const msg = `无法获取原站结果：${err.message}`;
      if (rightEntry) {
        outputs.set(rightEntry.original, attachMeta(rightEntry, fail(msg)));
      }
      if (leftEntry) {
        outputs.set(leftEntry.original, attachMeta(leftEntry, fail(msg)));
      }
    }
  }

  for (const entry of others) {
    const side = entry.snapped.eye === '左眼' ? 'left' : 'right';
    try {
      const item = await callOriginalApi(
        buildApiBody(
          side === 'right' ? entry.snapped : null,
          side === 'left' ? entry.snapped : null
        )
      );
      const out = parseApiEye(item, side, entry.snapped.sphere);
      outputs.set(
        entry.original,
        attachMeta(
          entry,
          out ? success(out) : fail('原站无匹配产品，请检查参数')
        )
      );
    } catch (err) {
      outputs.set(
        entry.original,
        attachMeta(entry, fail(`无法获取原站结果：${err.message}`))
      );
    }
  }

  return records.map((rec) => outputs.get(rec));
}

export async function convertEye(side, sphere, cylinder, axis) {
  const rec = {
    eye: side === 'left' ? '左眼' : '右眼',
    sphere,
    cylinder: cylinder || 0,
    axis: axis || 0,
  };
  const [result] = await convertRecords([rec]);
  return result.output;
}

export function formatResult(out, qty) {
  if (!out.ok) return out.error;
  const s = out.sphere.toFixed(2);
  const c = Math.round(Math.abs(out.cylinder) * 100);
  const qtyPart = qty != null && qty !== '' ? `（${qty}盒）` : '';
  return `${s},${c},${out.axis}${qtyPart}`;
}

export function formatSnappedInput(rec) {
  const s = rec.sphere.toFixed(2);
  const c = rec.cylinder === 0 ? '0.00' : rec.cylinder.toFixed(2);
  return `${s}/${c}×${rec.axis}`;
}
