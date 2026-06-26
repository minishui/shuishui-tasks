/**
 * 应用入口 — 导航切换、Toast、Badge 更新
 */
const App = (() => {
  // 导航
  const navLinks = document.querySelectorAll('.nav-link');
  const views = {
    dashboard: document.getElementById('view-dashboard'),
    request: document.getElementById('view-request'),
    track: document.getElementById('view-track'),
  };

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.dataset.view;
      switchView(view);
    });
  });

  function switchView(view) {
    // 更新导航
    navLinks.forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-view="${view}"]`)?.classList.add('active');
    // 切换视图
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[view]?.classList.remove('hidden');

    if (view === 'dashboard') {
      DashboardModule.refresh();
    }
  }

  // Toast
  const toast = document.getElementById('toast');
  let toastTimer = null;

  function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2500);
  }

  // Badge 更新
  function updateBadges() {
    const stats = Store.getStats();
    document.getElementById('queueBadge').textContent = `排队 ${stats.queued}`;
    document.getElementById('inProgressBadge').textContent = `进行中 ${stats.inProgress}`;
  }

  // 初始化
  function init() {
    DashboardModule.refresh();
    updateBadges();
  }

  init();

  return { switchView, showToast, updateBadges };
})();
