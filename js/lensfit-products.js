/**
 * Lensfit 商品目录与下拉框合法值
 * https://www.lensfit.jp/products/os/pid/{PID}/
 */

const BASE = 'https://www.lensfit.jp/products/os/pid';

/** 球镜 PWR（三款商品相同） */
export const PWR_OPTIONS = [
  0, -0.25, -0.5, -0.75, -1, -1.25, -1.5, -1.75, -2, -2.25, -2.5, -2.75, -3,
  -3.25, -3.5, -3.75, -4, -4.25, -4.5, -4.75, -5, -5.25, -5.5, -5.75, -6,
  -6.5, -7, -7.5, -8, -8.5, -9,
];

/** 柱镜 CY（三款相同） */
export const CY_OPTIONS = [-0.75, -1.25, -1.75, -2.25];

export const PRODUCTS = {
  JJ1DAOTR: {
    id: 'JJ1DAOTR',
    name: '散光日抛',
    aliases: ['散光日抛', 'オアシス乱視', 'ワンデー アキュビュー オアシス 乱視'],
    url: `${BASE}/JJ1DAOTR/`,
    axOptions: [20, 90, 160, 180],
    maxQty: 2,
  },
  JJ1DAMTR: {
    id: 'JJ1DAMTR',
    name: '舒日散光日抛',
    aliases: ['舒日散光日抛', '舒日', 'モイスト乱視', 'ワンデーアキュビューモイスト 乱視'],
    url: `${BASE}/JJ1DAMTR/`,
    axOptions: [10, 20, 60, 80, 90, 100, 120, 160, 170, 180],
    maxQty: 12,
  },
  JJ2WAOTR: {
    id: 'JJ2WAOTR',
    name: '散光双周',
    aliases: ['散光双周', '双周', 'オアシス乱視2週', 'アキュビューオアシス 乱視'],
    url: `${BASE}/JJ2WAOTR/`,
    axOptions: [10, 20, 60, 90, 120, 160, 170, 180],
    maxQty: 2,
  },
};

/** 别名 → 产品 ID（长别名优先匹配） */
const ALIAS_ENTRIES = Object.values(PRODUCTS).flatMap((p) =>
  [p.name, ...p.aliases].map((alias) => ({ alias, id: p.id }))
);
ALIAS_ENTRIES.sort((a, b) => b.alias.length - a.alias.length);

export function resolveProductId(nameRaw) {
  const name = String(nameRaw || '').trim();
  if (!name) return null;
  for (const { alias, id } of ALIAS_ENTRIES) {
    if (name === alias || name.includes(alias)) return id;
  }
  return null;
}

export function getProduct(id) {
  return PRODUCTS[id] || null;
}

export function formatPwr(v) {
  return v.toFixed(2);
}

export function formatCy(v) {
  return v.toFixed(2);
}

export function formatAx(v) {
  return String(v);
}
