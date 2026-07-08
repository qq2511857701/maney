/**
 * Tab 切换
 */

export function initTabs() {
  const buttons = document.querySelectorAll('[data-tab]');
  const panels = document.querySelectorAll('[data-tab-panel]');

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      buttons.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
      panels.forEach((p) => {
        p.hidden = p.dataset.tabPanel !== tab;
      });
    });
  });
}
