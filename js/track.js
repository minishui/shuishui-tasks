/**
 * 需求追踪 — 提需方查看自己需求的状态
 */
const TrackModule = (() => {
  const searchInput = document.getElementById('trackSearchInput');
  const btnSearch = document.getElementById('btnTrackSearch');
  const results = document.getElementById('trackResults');

  btnSearch.addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  function doSearch() {
    const query = searchInput.value.trim();
    if (!query) {
      results.innerHTML = '<div class="empty-state">请输入需求编号或姓名搜索</div>';
      return;
    }

    const tasks = Store.searchTasks(query);

    if (tasks.length === 0) {
      results.innerHTML = '<div class="empty-state">未找到匹配的需求，请检查需求编号或姓名</div>';
      return;
    }

    results.innerHTML = tasks.map(t => `
      <div class="track-item status-${t.status}">
        <div class="track-title">${escapeHtml(t.title)}</div>
        <span class="track-status status-label-${t.status}">${statusLabel(t.status)}</span>
        <div class="track-meta">
          <span>需求编号：${t.taskNumber}</span>
          <span> | 来源：${t.source}</span>
          <span> | 提交时间：${new Date(t.createdAt).toLocaleDateString('zh-CN')}</span>
          ${t.expectedDelivery ? `<span> | 期望交付：${t.expectedDelivery}</span>` : ''}
          ${t.estimatedDelivery ? `<span> | 预计交付：${t.estimatedDelivery}</span>` : ''}
          ${t.completedAt ? `<span> | 完成时间：${new Date(t.completedAt).toLocaleDateString('zh-CN')}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  function statusLabel(s) {
    const map = { pending: '待排序', queued: '排队中', in_progress: '进行中', done: '已完成' };
    return map[s] || s;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  return {};
})();
