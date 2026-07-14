// ==UserScript==
// @name         Lensfit 批量加购
// @namespace    maney-tools
// @version      1.1.1
// @description  从 maney 工具复制的 JSON 队列，自动填表加入 lensfit 购物车（支持散光与普通 BC 商品）
// @match        https://www.lensfit.jp/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const QUEUE_KEY = 'lensfit_cart_queue';
  const RUNNING_KEY = 'lensfit_cart_running';
  const INDEX_KEY = 'lensfit_cart_index';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function createPanel() {
    if (document.getElementById('lf-cart-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'lf-cart-panel';
    panel.innerHTML = `
      <style>
        #lf-cart-panel {
          position: fixed; bottom: 16px; right: 16px; z-index: 99999;
          background: #fff; border: 1px solid #cfd8dc; border-radius: 10px;
          box-shadow: 0 4px 20px rgba(0,0,0,.15); padding: 14px; width: 300px;
          font: 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #1a2b3c;
        }
        #lf-cart-panel h4 { margin: 0 0 8px; font-size: 14px; color: #0d47a1; }
        #lf-cart-panel .lf-btns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        #lf-cart-panel button {
          padding: 6px 10px; border: none; border-radius: 6px; cursor: pointer;
          font-size: 12px; background: #eceff1;
        }
        #lf-cart-panel button.primary { background: #1976d2; color: #fff; }
        #lf-cart-panel button.danger { background: #ffcdd2; }
        #lf-cart-panel .lf-status { margin-top: 8px; font-size: 12px; color: #546e7a; min-height: 36px; }
        #lf-cart-panel .lf-progress { font-weight: 600; color: #1976d2; }
        #lf-cart-panel .lf-summary {
          margin-top: 6px; font-size: 12px; color: #37474f;
          background: #f5f7fa; border-radius: 6px; padding: 8px 10px;
          white-space: pre-line;
        }
      </style>
      <h4>Lensfit 批量加购</h4>
      <div class="lf-progress" id="lf-progress">队列：0 条</div>
      <div class="lf-summary" id="lf-summary">合计：0 盒</div>
      <div class="lf-status" id="lf-status">请先加载采购队列</div>
      <div class="lf-btns">
        <button id="lf-load" class="primary">从剪贴板加载</button>
        <button id="lf-start" class="primary">开始加购</button>
        <button id="lf-pause">暂停</button>
        <button id="lf-clear" class="danger">清除队列</button>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById('lf-load').onclick = loadFromClipboard;
    document.getElementById('lf-start').onclick = startQueue;
    document.getElementById('lf-pause').onclick = pauseQueue;
    document.getElementById('lf-clear').onclick = clearQueue;
  }

  /** 从 URL 精确取出 /pid/XXX/，避免 JJ2WAO 误匹配 JJ2WAOTR */
  function pagePid() {
    const m = location.pathname.match(/\/pid\/([^/]+)\/?/i);
    return m ? m[1] : '';
  }

  function isOnProductPage(pid) {
    return Boolean(pid) && pagePid() === pid;
  }

  function summarizeQueue(queue) {
    const items = queue?.items || [];
    const totalBoxes = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
    const byProduct = {};
    for (const it of items) {
      const name = it.productName || it.pid || '未知';
      if (!byProduct[name]) byProduct[name] = { lines: 0, boxes: 0 };
      byProduct[name].lines += 1;
      byProduct[name].boxes += Number(it.qty) || 0;
    }
    const lines = Object.entries(byProduct).map(
      ([name, v]) => `${name}：${v.lines} 条 / ${v.boxes} 盒`
    );
    return {
      totalLines: items.length,
      totalBoxes,
      text: `合计：${items.length} 条 / ${totalBoxes} 盒` + (lines.length ? `\n${lines.join('\n')}` : ''),
    };
  }

  function updateUI(msg) {
    const queue = GM_getValue(QUEUE_KEY, null);
    const idx = GM_getValue(INDEX_KEY, 0);
    const running = GM_getValue(RUNNING_KEY, false);
    const summary = summarizeQueue(queue);
    const prog = document.getElementById('lf-progress');
    const summaryEl = document.getElementById('lf-summary');
    const status = document.getElementById('lf-status');
    if (prog) {
      prog.textContent = running
        ? `进行中 ${idx + 1} / ${summary.totalLines}`
        : `队列：${summary.totalLines} 条`;
    }
    if (summaryEl) summaryEl.textContent = summary.text;
    if (status && msg) status.textContent = msg;
  }

  async function loadFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text);
      if (!data.items || !Array.isArray(data.items)) throw new Error('格式错误');
      GM_setValue(QUEUE_KEY, data);
      GM_setValue(INDEX_KEY, 0);
      GM_setValue(RUNNING_KEY, false);
      const summary = summarizeQueue(data);
      updateUI(`已加载 ${summary.totalLines} 条，合计 ${summary.totalBoxes} 盒`);
    } catch (e) {
      updateUI('加载失败：' + e.message);
    }
  }

  function clearQueue() {
    GM_deleteValue(QUEUE_KEY);
    GM_deleteValue(INDEX_KEY);
    GM_setValue(RUNNING_KEY, false);
    updateUI('队列已清除');
  }

  function pauseQueue() {
    GM_setValue(RUNNING_KEY, false);
    updateUI('已暂停');
  }

  function startQueue() {
    const queue = GM_getValue(QUEUE_KEY, null);
    if (!queue?.items?.length) {
      updateUI('队列为空，请先加载');
      return;
    }
    GM_setValue(RUNNING_KEY, true);
    processNext();
  }

  function findOption(select, target) {
    const t = String(target).trim();
    return [...select.options].find(
      (o) =>
        o.text.trim() === t ||
        o.value.trim() === t ||
        o.text.trim().startsWith(t) ||
        o.value.trim().startsWith(t)
    );
  }

  function setSelect(select, target) {
    const opt = findOption(select, target);
    if (!opt) throw new Error(`选项不存在：${target}`);
    select.value = opt.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function itemLabel(item) {
    if (item.kind === 'sphere' || item.bc) {
      return `${item.productName} BC${item.bc} ${item.pwr} ×${item.qty}盒`;
    }
    return `${item.productName} ${item.pwr}/${item.cy}×${item.ax} ×${item.qty}盒`;
  }

  function isSphereItem(item) {
    return item.kind === 'sphere' || Boolean(item.bc);
  }

  async function addToCartOnPage(item) {
    const form = document.querySelector('form[action*="kago/add"]');
    if (!form) throw new Error('未找到加购表单，请确认在商品页');

    const gc = form.querySelector('input[name="gc"]')?.value;
    if (gc && item.pid && gc !== item.pid) {
      throw new Error(`商品页 PID 不匹配：页面 ${gc}，队列 ${item.pid}`);
    }

    const pwr = form.querySelector('select[name="PWR"]');
    const num = form.querySelector('select[name="NUM"]');
    if (!pwr || !num) throw new Error('未找到度数/数量下拉框');

    if (isSphereItem(item)) {
      const bc =
        form.querySelector('select[name="BC"]') ||
        form.querySelector('select[name="BC_DIA"]') ||
        form.querySelector('select[name="BCDIA"]');
      if (!bc) throw new Error('未找到 BC 下拉框');
      setSelect(bc, item.bc);
      setSelect(pwr, item.pwr);
      setSelect(num, String(item.qty));
    } else {
      const cy = form.querySelector('select[name="CY"]');
      const ax = form.querySelector('select[name="AX"]');
      if (!cy || !ax) throw new Error('未找到柱镜/轴位下拉框');
      setSelect(pwr, item.pwr);
      setSelect(cy, item.cy);
      setSelect(ax, item.ax);
      setSelect(num, String(item.qty));
    }

    await sleep(300);

    const fd = new FormData(form);
    const res = await fetch(form.action, {
      method: 'POST',
      body: fd,
      credentials: 'include',
      redirect: 'follow',
    });

    if (!res.ok) throw new Error(`加购 HTTP ${res.status}`);
    return true;
  }

  async function processNext() {
    if (!GM_getValue(RUNNING_KEY, false)) return;

    const queue = GM_getValue(QUEUE_KEY, null);
    let idx = GM_getValue(INDEX_KEY, 0);
    if (!queue?.items?.length || idx >= queue.items.length) {
      GM_setValue(RUNNING_KEY, false);
      const summary = summarizeQueue(queue);
      updateUI(`全部加购完成（合计 ${summary.totalBoxes} 盒），请去购物车结算`);
      return;
    }

    const item = queue.items[idx];
    const label = itemLabel(item);
    updateUI(`正在加购：${label}`);

    if (!isOnProductPage(item.pid)) {
      location.href = item.url;
      return;
    }

    try {
      await waitForForm();
      await addToCartOnPage(item);
      idx += 1;
      GM_setValue(INDEX_KEY, idx);
      updateUI(`已加购：${label}`);
      await sleep(1500);
      processNext();
    } catch (e) {
      GM_setValue(RUNNING_KEY, false);
      updateUI(`失败（第 ${idx + 1} 条）：${e.message}`);
    }
  }

  function waitForForm(maxMs = 15000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        if (document.querySelector('form[action*="kago/add"]')) {
          resolve();
          return;
        }
        if (Date.now() - start > maxMs) {
          reject(new Error('等待商品表单超时'));
          return;
        }
        setTimeout(tick, 200);
      };
      tick();
    });
  }

  function init() {
    createPanel();
    updateUI('就绪');

    if (GM_getValue(RUNNING_KEY, false)) {
      setTimeout(processNext, 800);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
