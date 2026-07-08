/**
 * 原站 astig.51i.cc 下拉框合法值（与 chunk-41fe2a0a 一致）
 */

/** 球镜 -12.00 ~ +5.75，步进 0.25 */
export const SPHERE_OPTIONS = [
  -12, -11.75, -11.5, -11.25, -11, -10.75, -10.5, -10.25, -10, -9.75, -9.5,
  -9.25, -9, -8.75, -8.5, -8.25, -8, -7.75, -7.5, -7.25, -7, -6.75, -6.5,
  -6.25, -6, -5.75, -5.5, -5.25, -5, -4.75, -4.5, -4.25, -4, -3.75, -3.5,
  -3.25, -3, -2.75, -2.5, -2.25, -2, -1.75, -1.5, -1.25, -1, -0.75, -0.5,
  -0.25, 0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3,
  3.25, 3.5, 3.75, 4, 4.25, 4.5, 4.75, 5, 5.25, 5.5, 5.75,
];

/** 柱镜 -3.50 ~ -0.25 或 NA(0) */
export const CYLINDER_OPTIONS = [
  -3.5, -3.25, -3, -2.75, -2.5, -2.25, -2, -1.75, -1.5, -1.25, -1, -0.75,
  -0.5, -0.25, 0,
];

/** 轴位 5°~180° 步进 5° 或 NA(0) */
export const AXIS_OPTIONS = [
  0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90,
  95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165,
  170, 175, 180,
];

function nearest(value, options) {
  if (value == null || Number.isNaN(value)) return { value: options[0], changed: true };
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

function fmtField(name, from, to) {
  if (Math.abs(from - to) < 1e-6) return null;
  const f = (v) => (name === '轴位' ? `${v}` : v.toFixed(2));
  return `${name} ${f(from)} → ${f(to)}`;
}

/**
 * 将单条记录对齐到原站下拉框选项
 * @returns {{ record, adjustments: string[], changed: boolean }}
 */
export function snapRecord(rec) {
  const s = nearest(rec.sphere, SPHERE_OPTIONS);
  const c = nearest(rec.cylinder || 0, CYLINDER_OPTIONS);
  const a = nearest(rec.axis || 0, AXIS_OPTIONS);

  const adjustments = [
    fmtField('球镜', rec.sphere, s.value),
    fmtField('柱镜', rec.cylinder || 0, c.value),
    fmtField('轴位', rec.axis || 0, a.value),
  ].filter(Boolean);

  const snapped = {
    ...rec,
    sphere: s.value,
    cylinder: c.value,
    axis: a.value,
    _original: {
      sphere: rec.sphere,
      cylinder: rec.cylinder || 0,
      axis: rec.axis || 0,
    },
  };

  return {
    record: snapped,
    adjustments,
    changed: adjustments.length > 0,
  };
}

export function snapRecords(records) {
  return records.map(snapRecord);
}
