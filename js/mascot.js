/**
 * Live2D 看板娘加载与气泡 API
 */

const LIVE2D_CDN = 'https://fastly.jsdelivr.net/npm/live2d-widgets@1.0.1/dist/';
const DESKTOP_MQ = window.matchMedia('(min-width: 769px)');
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

let messageTimer = null;
let ready = false;
const readyCallbacks = [];

function loadResource(url, type) {
  return new Promise((resolve, reject) => {
    let tag;
    if (type === 'css') {
      tag = document.createElement('link');
      tag.rel = 'stylesheet';
      tag.href = url;
    } else if (type === 'js') {
      tag = document.createElement('script');
      tag.type = 'module';
      tag.src = url;
    }
    if (!tag) return reject(new Error('unknown resource type'));
    tag.onload = () => resolve(url);
    tag.onerror = () => reject(new Error(`failed to load ${url}`));
    document.head.appendChild(tag);
  });
}

function pickRandom(text) {
  return Array.isArray(text) ? text[Math.floor(Math.random() * text.length)] : text;
}

function markReady() {
  if (ready) return;
  ready = true;
  readyCallbacks.splice(0).forEach((cb) => cb());
}

function waitForWaifu(timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const waifu = document.getElementById('waifu');
      if (waifu) {
        resolve(waifu);
        return;
      }
      if (Date.now() - start > timeout) {
        reject(new Error('waifu load timeout'));
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function setupCollapseControls(waifu) {
  localStorage.removeItem('waifu-display');

  const collapseBtn = document.createElement('button');
  collapseBtn.type = 'button';
  collapseBtn.className = 'mascot-collapse-btn';
  collapseBtn.title = '收起看板娘';
  collapseBtn.setAttribute('aria-label', '收起看板娘');
  collapseBtn.textContent = '›';

  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'mascot-open-btn';
  openBtn.title = '展开看板娘';
  openBtn.setAttribute('aria-label', '展开看板娘');
  openBtn.textContent = '看板娘';
  openBtn.hidden = true;

  document.body.appendChild(openBtn);
  waifu.appendChild(collapseBtn);

  function setCollapsed(collapsed) {
    localStorage.setItem('mascot-collapsed', collapsed ? '1' : '0');
    waifu.classList.toggle('mascot-collapsed', collapsed);
    openBtn.hidden = !collapsed;
  }

  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setCollapsed(true);
  });
  openBtn.addEventListener('click', () => setCollapsed(false));

  if (localStorage.getItem('mascot-collapsed') === '1') {
    setCollapsed(true);
  }
}

/** 程序化显示气泡（复用 widget 的 DOM 与优先级逻辑） */
export function showMascotTip(text, timeout = 5000, priority = 10) {
  if (!text) return;

  const currentPriority = parseInt(sessionStorage.getItem('waifu-text'), 10);
  if (!Number.isNaN(currentPriority) && currentPriority > priority) return;

  if (messageTimer) {
    clearTimeout(messageTimer);
    messageTimer = null;
  }

  const tips = document.getElementById('waifu-tips');
  if (!tips) return;

  tips.innerHTML = pickRandom(text);
  tips.classList.add('waifu-tips-active');
  sessionStorage.setItem('waifu-text', String(priority));

  messageTimer = setTimeout(() => {
    sessionStorage.removeItem('waifu-text');
    tips.classList.remove('waifu-tips-active');
    messageTimer = null;
  }, timeout);
}

export function onMascotReady(callback) {
  if (ready) {
    callback();
  } else {
    readyCallbacks.push(callback);
  }
}

export function initMascot() {
  if (!DESKTOP_MQ.matches || REDUCED_MOTION.matches) return;

  const OriginalImage = window.Image;
  window.Image = function (...args) {
    const img = new OriginalImage(...args);
    img.crossOrigin = 'anonymous';
    return img;
  };
  window.Image.prototype = OriginalImage.prototype;

  Promise.all([
    loadResource(LIVE2D_CDN + 'waifu.css', 'css'),
    loadResource(LIVE2D_CDN + 'waifu-tips.js', 'js'),
  ])
    .then(() => {
      if (typeof window.initWidget !== 'function') {
        throw new Error('initWidget not found');
      }
      window.initWidget({
        waifuPath: './assets/waifu-tips.json',
        cdnPath: 'https://fastly.jsdelivr.net/gh/fghrsh/live2d_api/',
        cubism2Path: LIVE2D_CDN + 'live2d.min.js',
        cubism5Path: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
        tools: ['hitokoto', 'switch-model', 'photo'],
        logLevel: 'warn',
        drag: true,
      });
      return waitForWaifu();
    })
    .then((waifu) => {
      setupCollapseControls(waifu);
      markReady();
    })
    .catch((err) => {
      console.warn('[mascot] Live2D widget failed to load:', err);
    });
}
