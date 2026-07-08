/**
 * 多格式验光数据解析
 * 支持：聊天格式、OD/OS/R/L 处方、订单行、标准 S/C×A 行
 */

const EYE = {
  RIGHT: '右眼',
  LEFT: '左眼',
};

/**
 * 文本清洗：修正全角字符、手写省略小数点等
 */
export function normalizeOcrText(text) {
  if (!text) return '';

  let t = text
    .replace(/\r/g, '\n')
    .replace(/[－−]/g, '-')
    .replace(/[×＊]/g, 'x')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')');

  // 手写省略小数点：仅修正球镜/柱镜（R:/L: 或 OD/OS 格式），不碰订单行的逗号分隔
  t = t.replace(/([：:]\s*|-\s*)(-?\d{3,4})(?=\s*[/／])/g, (_, prefix, num) => {
    const n = parseInt(num, 10);
    if (Math.abs(n) >= 100) return prefix + (n / 100).toFixed(2);
    return prefix + num;
  });
  t = t.replace(/([/／]\s*)(-?\d{3,4})(?=\s*[x×X*])/g, (_, prefix, num) => {
    const n = parseInt(num, 10);
    if (Math.abs(n) >= 100) return prefix + (n / 100).toFixed(2);
    return prefix + num;
  });

  t = t.replace(/\bR\s*[：:]/gi, 'R:');
  t = t.replace(/\bL\s*[：:]/gi, 'L:');

  return t;
}

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
  if (!raw) return null;
  const m = String(raw).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function makeRecord(eye, sphere, cylinder, axis, qty, source) {
  if (sphere == null || Number.isNaN(sphere)) return null;
  return {
    eye,
    sphere,
    cylinder: cylinder || 0,
    axis: axis || 0,
    qty: qty ?? 1,
    source,
  };
}

const RX_LINE =
  /\b(OD|OS|R|L)\s*[：:]?\s*(-?\d+\.?\d*)\s*[/／]\s*(-?\d+\.?\d*)\s*[x×X*]\s*(\d+)/gi;

const RX_EYE_MAP = {
  od: EYE.RIGHT,
  r: EYE.RIGHT,
  os: EYE.LEFT,
  l: EYE.LEFT,
};

/** 聊天格式 */
function parseChatFormat(text) {
  const results = [];
  const eyeBlocks = [
    { eye: EYE.RIGHT, pattern: /右眼\s*[\(（]?R[\)）]?([\s\S]*?)(?=左眼|$)/i },
    { eye: EYE.LEFT, pattern: /左眼\s*[\(（]?L[\)）]?([\s\S]*?)$/i },
  ];

  for (const { eye, pattern } of eyeBlocks) {
    const blockMatch = text.match(pattern);
    if (!blockMatch) continue;
    const block = blockMatch[1];

    const sphereMatch = block.match(
      /(?:近视|球镜)[：:\s]*(?:\d+度\s*)?\(([-\d.]+)\)|(?:近视|球镜)[：:\s]*(\d+)度/
    );
    const cylMatch = block.match(
      /(?:散光|柱镜)[：:\s]*(?:\d+度\s*)?\(([-\d.]+)\)|(?:散光|柱镜)[：:\s]*(\d+)度/
    );
    const axisMatch = block.match(/(?:轴位)[：:\s]*(\d+)/);

    let sphere = null;
    if (sphereMatch) {
      sphere = parseSphere(sphereMatch[1] ?? sphereMatch[2]);
    }
    let cylinder = 0;
    if (cylMatch) {
      cylinder =
        cylMatch[1] != null ? parseSphere(cylMatch[1]) : parseCylinder(cylMatch[2]);
    }
    const axis = axisMatch ? parseAxis(axisMatch[1]) : 0;

    const rec = makeRecord(eye, sphere, cylinder, axis, null, 'chat');
    if (rec) results.push(rec);
  }

  return results;
}

/** OD/OS/R/L 标准处方（含手写验光条） */
function parseRxFormat(text) {
  const results = [];
  const seen = new Set();

  RX_LINE.lastIndex = 0;
  let m;
  while ((m = RX_LINE.exec(text)) !== null) {
    const eye = RX_EYE_MAP[m[1].toLowerCase()];
    const key = `${eye}-${m[2]}-${m[3]}-${m[4]}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const rec = makeRecord(
      eye,
      parseSphere(m[2]),
      parseCylinder(m[3]),
      parseAxis(m[4]),
      null,
      'rx'
    );
    if (rec) results.push(rec);
  }

  return results;
}

/** 单行 S/C×A */
function parseSingleRxLine(line) {
  const m = line.match(/^([-\d.]+)\s*[/／]\s*(-?\d+\.?\d*)\s*[x×X*]\s*(\d+)/);
  if (!m) return null;

  let eye = '—';
  if (/^R\b|右眼|OD/i.test(line)) eye = EYE.RIGHT;
  else if (/^L\b|左眼|OS/i.test(line)) eye = EYE.LEFT;

  return makeRecord(
    eye,
    parseSphere(m[1]),
    parseCylinder(m[2]),
    parseAxis(m[3]),
    null,
    'rx-line'
  );
}

/** 订单行：-3.50，100，179（1盒） 或整行多条 */
function parseOrderFormat(text) {
  const results = [];
  const seen = new Set();
  const pattern =
    /(-?\d+\.?\d*)\s*[，,]\s*(-?\d+\.?\d*)\s*[，,]\s*(\d+)\s*(?:[(（]\s*(\d+)\s*盒\s*[)）]?)?/g;

  let m;
  while ((m = pattern.exec(text)) !== null) {
    const key = `${m[1]}-${m[2]}-${m[3]}-${m[4] || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const rec = makeRecord(
      '—',
      parseSphere(m[1]),
      parseCylinder(m[2]),
      parseAxis(m[3]),
      m[4] ? parseInt(m[4], 10) : null,
      'order'
    );
    if (rec) results.push(rec);
  }

  return results;
}

/** 订单行（单行） */
function parseOrderLine(line) {
  const cleaned = line.trim();
  if (!cleaned || cleaned.startsWith('#') || cleaned.startsWith('//')) return null;
  if (/外配镜|舒适度|PD/i.test(cleaned)) return null;

  const rx = parseSingleRxLine(cleaned);
  if (rx) return rx;

  const qtyMatch = cleaned.match(/[（(](\d+)\s*盒[）)]/);
  const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : null;
  const withoutQty = cleaned.replace(/[（(][^）)]*[）)]/g, '');

  const parts = withoutQty.split(/[,，\s]+/).filter(Boolean);
  if (parts.length < 3) return null;

  return makeRecord(
    '—',
    parseSphere(parts[0]),
    parseCylinder(parts[1]),
    parseAxis(parts[2]),
    qty,
    'order'
  );
}

/**
 * 解析整段文本
 */
export function parseText(text) {
  if (!text || !text.trim()) return [];

  const normalized = normalizeOcrText(text);

  const chat = parseChatFormat(normalized);
  if (chat.length > 0) return chat;

  const rx = parseRxFormat(normalized);
  if (rx.length > 0) return rx;

  const orders = parseOrderFormat(normalized);
  if (orders.length > 0) return orders;

  const lines = normalized.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const fromLines = lines.map(parseOrderLine).filter(Boolean);
  if (fromLines.length > 0) return fromLines;

  return [];
}

export function formatRx(record) {
  const s = record.sphere.toFixed(2);
  const c = record.cylinder === 0 ? '0.00' : record.cylinder.toFixed(2);
  const a = record.axis;
  return `${s}/${c}×${a}`;
}
