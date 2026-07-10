/**
 * Tab 切换（带翻页动画）
 */

import { showMascotTip } from './mascot.js';

const TAB_ORDER = ['convert', 'purchase', 'watermark', 'tools'];

const TAB_TIPS = {
  convert: ['来换算度数吧～', '粘贴验光单，我来帮你看！'],
  purchase: ['批量采购在这边哦～', '记得核对柱镜和盒数！'],
  watermark: ['上传豆包截图，我去水印～', '处理后记得对比原图哦'],
  tools: ['这些小工具都是免费的～', '点卡片会在新标签打开'],
};

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

export function initTabs() {
  const stage = document.getElementById('tabStage');
  const buttons = document.querySelectorAll('.tab-btn[data-tab]');
  let currentTab = 'convert';
  let animating = false;

  function notifyTabChange(tab) {
    const tips = TAB_TIPS[tab];
    if (tips) showMascotTip(tips);
  }

  function setActiveButton(tab) {
    buttons.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  }

  function switchInstant(tab) {
    if (tab === currentTab) return;
    document.querySelectorAll('[data-tab-panel]').forEach((p) => {
      p.hidden = p.dataset.tabPanel !== tab;
    });
    currentTab = tab;
    setActiveButton(tab);
    notifyTabChange(tab);
  }

  function waitAnimation(el) {
    return new Promise((resolve) => {
      const onEnd = (e) => {
        if (e.target !== el) return;
        el.removeEventListener('animationend', onEnd);
        resolve();
      };
      el.addEventListener('animationend', onEnd);
    });
  }

  async function switchAnimated(tab) {
    if (tab === currentTab || animating) return;
    animating = true;

    const prevPanel = document.querySelector(`[data-tab-panel="${currentTab}"]`);
    const nextPanel = document.querySelector(`[data-tab-panel="${tab}"]`);
    const forward = TAB_ORDER.indexOf(tab) > TAB_ORDER.indexOf(currentTab);
    const inClass = forward ? 'tab-flip-in-forward' : 'tab-flip-in-back';
    const outClass = forward ? 'tab-flip-out-forward' : 'tab-flip-out-back';

    setActiveButton(tab);

    nextPanel.hidden = false;
    stage.classList.add('is-animating');
    stage.style.minHeight = `${Math.max(prevPanel.offsetHeight, nextPanel.offsetHeight)}px`;

    void nextPanel.offsetHeight;

    prevPanel.classList.add(outClass);
    nextPanel.classList.add(inClass);

    await Promise.all([waitAnimation(prevPanel), waitAnimation(nextPanel)]);

    prevPanel.hidden = true;
    prevPanel.classList.remove(outClass);
    nextPanel.classList.remove(inClass);
    stage.classList.remove('is-animating');
    stage.style.minHeight = '';
    currentTab = tab;
    animating = false;
    notifyTabChange(tab);
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (REDUCED_MOTION.matches) {
        switchInstant(tab);
      } else {
        switchAnimated(tab);
      }
    });
  });
}
