// ==UserScript==
// @name         Lensfit 批量加购
// @namespace    maney-tools
// @version      1.0.0
// @description  从 maney 工具复制的 JSON 队列，自动填表加入 lensfit 购物车
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
          box-shadow: 0 4px 20px rgba(0,0,0,.15); padding: 14px; width: 280px;
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
      </style>
      <h4>Lensfit 批量加购</h4>
      <div class="lf-progress" id="lf-progress">队列：0 条</div>
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

  function updateUI(msg) {
    const queue = GM_getValue(QUEUE_KEY, null);
    const idx = GM_getValue(INDEX_KEY, 0);
    const running = GM_getValue(RUNNING_KEY, false);
    const total = queue?.items?.length ?? 0;
    const prog = document.getElementById('lf-progress');
    const status = document.getElementById('lf-status');
    if (prog) {
      prog.textContent = running
        ? `进行中 ${idx + 1} / ${total}`
        : `队列：${total} 条`;
    }
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
      updateUI(`已加载 ${data.items.length} 条`);
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
      (o) => o.text.trim() === t || o.value.trim() === t
    );
  }

  function setSelect(select, target) {
    const opt = findOption(select, target);
    if (!opt) throw new Error(`选项不存在：${target}`);
    select.value = opt.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function addToCartOnPage(item) {
    const form = document.querySelector('form[action*="kago/add"]');
    if (!form) throw new Error('未找到加购表单，请确认在商品页');

    const gc = form.querySelector('input[name="gc"]')?.value;
    if (gc && item.pid && gc !== item.pid) {
      throw new Error(`商品页 PID 不匹配：页面 ${gc}，队列 ${item.pid}`);
    }

    const pwr = form.querySelector('select[name="PWR"]');
    const cy = form.querySelector('select[name="CY"]');
    const ax = form.querySelector('select[name="AX"]');
    const num = form.querySelector('select[name="NUM"]');

    if (!pwr || !cy || !ax || !num) throw new Error('未找到度数下拉框');

    setSelect(pwr, item.pwr);
    setSelect(cy, item.cy);
    setSelect(ax, item.ax);
    setSelect(num, String(item.qty));

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
      updateUI('全部加购完成，请去购物车结算');
      return;
    }

    const item = queue.items[idx];
    const label = `${item.productName} ${item.pwr}/${item.cy}×${item.ax} ×${item.qty}盒`;
    updateUI(`正在加购：${label}`);

    const pidMatch = location.pathname.includes(item.pid);
    if (!pidMatch) {
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
