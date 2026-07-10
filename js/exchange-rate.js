/**
 * 实时汇率面板：USD / JPY / KRW / 黄金 ↔ CNY
 */

const CACHE_KEY = 'maney_exchange_rates';
const CACHE_TTL = 30 * 60 * 1000;
const EXPAND_KEY = 'maney_rate_expand';
const TROY_OZ_GRAMS = 31.1034768;

const API_PRIMARY =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/cny.json';
const API_FALLBACK =
  'https://api.frankfurter.dev/v1/latest?from=CNY&to=USD,JPY,KRW';

const CURRENCIES = [
  {
    id: 'usd',
    flag: '🇺🇸',
    name: '美元',
    code: 'USD',
    theme: 'usd',
    xeUrl:
      'https://www.xe.com/currencyconverter/convert/?Amount=1&From=USD&To=CNY',
    amounts: [
      { label: '1 USD', foreign: 1, type: 'toCny' },
      { label: '10 USD', foreign: 10, type: 'toCny' },
      { label: '100 USD', foreign: 100, type: 'toCny' },
    ],
  },
  {
    id: 'jpy',
    flag: '🇯🇵',
    name: '日元',
    code: 'JPY',
    theme: 'jpy',
    xeUrl:
      'https://www.xe.com/currencyconverter/convert/?Amount=100&From=JPY&To=CNY',
    amounts: [
      { label: '100 JPY', foreign: 100, type: 'toCny' },
      { label: '1,000 JPY', foreign: 1000, type: 'toCny' },
      { label: '10,000 JPY', foreign: 10000, type: 'toCny' },
    ],
  },
  {
    id: 'krw',
    flag: '🇰🇷',
    name: '韩元',
    code: 'KRW',
    theme: 'krw',
    xeUrl:
      'https://www.xe.com/currencyconverter/convert/?Amount=1000&From=KRW&To=CNY',
    amounts: [
      { label: '1,000 KRW', foreign: 1000, type: 'toCny' },
      { label: '10,000 KRW', foreign: 10000, type: 'toCny' },
      { label: '100,000 KRW', foreign: 100000, type: 'toCny' },
    ],
  },
  {
    id: 'xau',
    flag: '🥇',
    name: '黄金',
    code: 'XAU',
    theme: 'xau',
    expandLabel: '常用重量',
    xeUrl: 'https://www.xe.com/currencyconverter/convert/?Amount=1&From=XAU&To=CNY',
    amounts: [
      { label: '10 克', grams: 10 },
      { label: '50 克', grams: 50 },
      { label: '100 克', grams: 100 },
    ],
  },
];

function fmtNum(n, decimals = 2) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtForeign(n, code) {
  if (code === 'USD') return fmtNum(n, 4);
  if (code === 'JPY') return fmtNum(n, 1);
  if (code === 'KRW') return fmtNum(n, 0);
  return fmtNum(n, 2);
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isCacheFresh(data) {
  return data && Date.now() - data.fetchedAt <= CACHE_TTL;
}

function writeCache(payload) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...payload, fetchedAt: Date.now() })
    );
  } catch {
    /* ignore quota */
  }
}

async function fetchPrimary() {
  const res = await fetch(API_PRIMARY);
  if (!res.ok) throw new Error(`primary ${res.status}`);
  const json = await res.json();
  const rates = json.cny;
  if (!rates?.usd || !rates?.jpy || !rates?.krw) throw new Error('primary incomplete');
  return {
    date: json.date || new Date().toISOString().slice(0, 10),
    source: 'currency-api',
    rates: {
      usd: rates.usd,
      jpy: rates.jpy,
      krw: rates.krw,
      xau: rates.xau ?? null,
    },
  };
}

async function fetchXauOnly() {
  try {
    const res = await fetch(API_PRIMARY);
    if (!res.ok) return null;
    const json = await res.json();
    return json.cny?.xau ?? null;
  } catch {
    return null;
  }
}

async function fetchFallback() {
  const res = await fetch(API_FALLBACK);
  if (!res.ok) throw new Error(`fallback ${res.status}`);
  const json = await res.json();
  const r = json.rates;
  if (!r?.USD || !r?.JPY || !r?.KRW) throw new Error('fallback incomplete');
  const xau = await fetchXauOnly();
  return {
    date: json.date || new Date().toISOString().slice(0, 10),
    source: 'frankfurter',
    rates: { usd: r.USD, jpy: r.JPY, krw: r.KRW, xau },
  };
}

async function fetchRates() {
  try {
    return await fetchPrimary();
  } catch {
    return await fetchFallback();
  }
}

function calcCurrency(code, perCny) {
  const cnyPerUnit = 1 / perCny;
  const unitPerCny = perCny;

  const core = [
    {
      primary: true,
      text: `1 ${code} = ${fmtNum(cnyPerUnit, 2)} CNY`,
    },
    {
      primary: true,
      text: `1 CNY = ${fmtForeign(unitPerCny, code)} ${code}`,
    },
  ];

  const cfg = CURRENCIES.find((c) => c.code === code);
  const extras = (cfg?.amounts || []).map(({ label, foreign }) => ({
    primary: false,
    text: `${label} = ${fmtNum(foreign * cnyPerUnit, 2)} CNY`,
  }));

  if (code === 'JPY') {
    extras.push({
      primary: false,
      text: `1 JPY = ${fmtNum(cnyPerUnit, 4)} CNY`,
    });
  }
  if (code === 'KRW') {
    extras.push({
      primary: false,
      text: `1 KRW = ${fmtNum(cnyPerUnit, 4)} CNY`,
    });
  }

  return { core, extras, cnyPerUnit, unitPerCny };
}

/** 黄金：xau = 1 CNY 可换金衡盎司数 */
function calcGold(xauPerCny, usdPerCny) {
  if (!xauPerCny) return null;

  const cnyPerOz = 1 / xauPerCny;
  const cnyPerGram = cnyPerOz / TROY_OZ_GRAMS;
  const usdPerOz = usdPerCny ? usdPerCny / xauPerCny : null;

  const core = [
    { primary: true, text: `1 金衡盎司 ≈ ${fmtNum(cnyPerOz, 2)} CNY` },
    { primary: true, text: `1 克 ≈ ${fmtNum(cnyPerGram, 2)} CNY` },
  ];

  const cfg = CURRENCIES.find((c) => c.id === 'xau');
  const extras = (cfg?.amounts || []).map(({ label, grams }) => ({
    primary: false,
    text: `${label} ≈ ${fmtNum(grams * cnyPerGram, 2)} CNY`,
  }));

  if (usdPerOz) {
    extras.unshift({
      primary: false,
      text: `国际金价 ≈ ${fmtNum(usdPerOz, 2)} USD/盎司`,
    });
  }

  return { core, extras };
}

function calcAll(data) {
  const { usd, jpy, krw, xau } = data.rates;
  const result = {
    usd: calcCurrency('USD', usd),
    jpy: calcCurrency('JPY', jpy),
    krw: calcCurrency('KRW', krw),
  };
  const gold = calcGold(xau, usd);
  if (gold) result.xau = gold;
  return result;
}

function getExpandState() {
  try {
    return JSON.parse(localStorage.getItem(EXPAND_KEY) || '{}');
  } catch {
    return {};
  }
}

function setExpandState(id, open) {
  const state = getExpandState();
  state[id] = open;
  localStorage.setItem(EXPAND_KEY, JSON.stringify(state));
}

function isMobile() {
  return window.matchMedia('(max-width: 767px)').matches;
}

function renderSkeleton(panel) {
  panel.innerHTML = `
    <div class="rate-panel-inner rate-panel--loading">
      <div class="rate-header">
        <div class="rate-title"><span class="rate-live-dot"></span>实时汇率 · 金价</div>
      </div>
      <div class="rate-grid">
        ${[1, 2, 3, 4].map(() => '<div class="rate-skeleton-card"></div>').join('')}
      </div>
    </div>`;
}

function renderError(panel, message) {
  const cached = readCache();
  panel.innerHTML = cached
    ? renderFull(calcAll(cached), {
        date: cached.date,
        updatedAt: cached.fetchedAt,
        cached: true,
        source: cached.source,
      })
    : `
    <div class="rate-panel-inner rate-panel--error">
      <div class="rate-header">
        <div class="rate-title">实时汇率</div>
        <button type="button" class="rate-refresh" id="rateRefresh" aria-label="刷新">↻</button>
      </div>
      <p class="rate-error-msg">${message}</p>
      ${renderFooter({ date: '—', cached: false })}
    </div>`;
  bindToggle(panel);
  bindRefresh(panel, () => loadRates(panel, { force: true }));
}

function renderCurrencyCard(cfg, calc, expandOpen) {
  if (!calc) return '';
  const expanded = expandOpen || isMobile();
  const expandLabel = cfg.expandLabel || '常用面额';
  return `
    <article class="rate-currency-card rate-currency-card--${cfg.theme}${expanded ? ' is-expanded' : ''}" data-currency="${cfg.id}">
      <div class="rate-currency-bar"></div>
      <header class="rate-currency-head">
        <span class="rate-flag">${cfg.flag}</span>
        <span class="rate-currency-name">${cfg.name} <small>${cfg.code}</small></span>
        <button type="button" class="rate-toggle" aria-expanded="${expanded}" aria-label="展开${expandLabel}">
          <span class="rate-toggle-icon">▸</span>
        </button>
      </header>
      <div class="rate-core">
        ${calc.core
          .map(
            (line) =>
              `<p class="rate-line rate-line--primary"><span class="rate-value" data-flash>${line.text}</span></p>`
          )
          .join('')}
      </div>
      <div class="rate-expand">
        <p class="rate-expand-label">${expandLabel}</p>
        ${calc.extras
          .map((line) => `<p class="rate-line"><span class="rate-value">${line.text}</span></p>`)
          .join('')}
      </div>
    </article>`;
}

function renderFooter(meta) {
  const timeStr = meta.updatedAt
    ? new Date(meta.updatedAt).toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : meta.date;

  return `
    <footer class="rate-footer">
      <div class="rate-meta">
        <span>${timeStr} 更新</span>
        <span class="rate-meta-sep">·</span>
        <span>中间价 · 仅供参考</span>
        ${meta.cached ? '<span class="rate-badge">缓存</span>' : ''}
      </div>
      <div class="rate-links">
        <a class="rate-pill-link" href="http://www.boc.cn/sourcedb/whpj/" target="_blank" rel="noopener">中行牌价</a>
        <a class="rate-pill-link" href="https://www.xe.com/currencyconverter/convert/?Amount=1&From=USD&To=CNY" target="_blank" rel="noopener">XE 美元</a>
        <a class="rate-pill-link" href="https://www.xe.com/currencyconverter/convert/?Amount=100&From=JPY&To=CNY" target="_blank" rel="noopener">XE 日元</a>
        <a class="rate-pill-link" href="https://www.xe.com/currencyconverter/convert/?Amount=1000&From=KRW&To=CNY" target="_blank" rel="noopener">XE 韩元</a>
        <a class="rate-pill-link" href="https://www.xe.com/currencyconverter/convert/?Amount=1&From=XAU&To=CNY" target="_blank" rel="noopener">XE 黄金</a>
        <a class="rate-pill-link" href="https://www.sge.com.cn/" target="_blank" rel="noopener">上海金交所</a>
      </div>
    </footer>`;
}

function renderFull(calculated, meta, skipWrapper = false) {
  const expand = getExpandState();
  const cards = CURRENCIES.map((cfg) =>
    renderCurrencyCard(cfg, calculated[cfg.id], expand[cfg.id])
  )
    .filter(Boolean)
    .join('');

  const inner = `
    <div class="rate-header">
      <div class="rate-title"><span class="rate-live-dot"></span>实时汇率 · 金价</div>
      <button type="button" class="rate-refresh" id="rateRefresh" aria-label="刷新">↻</button>
    </div>
    <div class="rate-grid">${cards}</div>
    ${renderFooter(meta)}`;

  return skipWrapper ? inner : `<div class="rate-panel-inner">${inner}</div>`;
}

function bindToggle(panel) {
  panel.querySelectorAll('.rate-currency-card').forEach((card) => {
    const btn = card.querySelector('.rate-toggle');
    const head = card.querySelector('.rate-currency-head');
    const toggle = () => {
      const open = card.classList.toggle('is-expanded');
      btn?.setAttribute('aria-expanded', String(open));
      setExpandState(card.dataset.currency, open);
    };
    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });
    head?.addEventListener('click', (e) => {
      if (e.target.closest('.rate-toggle')) return;
      toggle();
    });
  });
}

function bindRefresh(panel, onRefresh) {
  panel.querySelector('#rateRefresh')?.addEventListener('click', onRefresh);
}

function flashValues(panel) {
  panel.querySelectorAll('.rate-value[data-flash]').forEach((el) => {
    el.classList.remove('rate-flash');
    void el.offsetWidth;
    el.classList.add('rate-flash');
  });
}

let loading = false;

async function loadRates(panel, { force = false, silent = false } = {}) {
  if (loading) return;
  loading = true;

  const refreshBtn = panel.querySelector('#rateRefresh');
  refreshBtn?.classList.add('is-spinning');

  if (!silent) {
    const cached = readCache();
    if (cached) {
      panel.innerHTML = renderFull(calcAll(cached), {
        date: cached.date,
        updatedAt: cached.fetchedAt,
        cached: !isCacheFresh(cached),
        source: cached.source,
      });
      bindToggle(panel);
      bindRefresh(panel, () => loadRates(panel, { force: true }));
      if (isCacheFresh(cached) && !force) {
        loading = false;
        return;
      }
    } else if (!force) {
      renderSkeleton(panel);
    }
  }

  try {
    const data = await fetchRates();
    writeCache(data);
    const calculated = calcAll(data);
    panel.innerHTML = renderFull(calculated, {
      date: data.date,
      updatedAt: Date.now(),
      cached: false,
      source: data.source,
    });
    bindToggle(panel);
    bindRefresh(panel, () => loadRates(panel, { force: true }));
    flashValues(panel);
  } catch {
    const cached = readCache();
    if (cached) {
      panel.innerHTML = renderFull(calcAll(cached), {
        date: cached.date,
        updatedAt: cached.fetchedAt,
        cached: true,
        source: cached.source,
      });
      bindToggle(panel);
      bindRefresh(panel, () => loadRates(panel, { force: true }));
    } else {
      renderError(panel, '无法获取汇率，请检查网络后点击刷新重试');
    }
  } finally {
    loading = false;
    panel.querySelector('#rateRefresh')?.classList.remove('is-spinning');
  }
}

export function initExchangeRate() {
  const panel = document.getElementById('ratePanel');
  if (!panel) return;

  panel.classList.add('rate-panel');
  loadRates(panel);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const cached = readCache();
      if (!cached || !isCacheFresh(cached)) {
        loadRates(panel, { silent: true });
      }
    }
  });
}
