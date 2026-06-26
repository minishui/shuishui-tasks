/**
 * 管理端看板 — 四象限 + 周视图 + 任务操作 + 当前进行中
 */
const DashboardModule = (() => {
  // ===== 渲染统计 =====
  function renderStats() {
    const stats = Store.getStats();
    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statPending').textContent = stats.pending;
    document.getElementById('statQueued').textContent = stats.queued;
    document.getElementById('statInProgress').textContent = stats.inProgress;
    document.getElementById('statDone').textContent = stats.done;
  }

  // ===== 告警 =====
  function renderAlerts() {
    const alerts = Store.getAlerts();
    const area = document.getElementById('alertArea');
    if (alerts.length === 0) {
      area.innerHTML = '';
      return;
    }
    area.innerHTML = alerts.map(a => `
      <div class="alert alert-${a.type}">
        <span>${a.type === 'danger' ? '&#9888;' : '&#8505;'}</span>
        <span>${a.message}</span>
      </div>
    `).join('');
  }

  // ===== 当前进行中 =====
  function renderCurrentTask() {
    const task = Store.getCurrentInProgress();
    const card = document.getElementById('currentTaskCard');
    if (!task) {
      card.innerHTML = '<div class="empty-state">暂无进行中的任务，从下方队列中选择一个开始吧</div>';
      return;
    }
    card.innerHTML = `
      <div class="current-task-item">
        <div class="task-id">${task.taskNumber}</div>
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">
          <span>来源：<span class="task-card-source source-${task.source}">${task.source}</span></span>
          <span>需求方：${escapeHtml(task.requesterName)}</span>
          ${task.urgency === 'high' ? '<span class="badge-urgent">紧急</span>' : ''}
          ${task.expectedDelivery ? `<span>期望交付：${task.expectedDelivery}</span>` : ''}
          ${task.estimatedDelivery ? `<span>预计交付：${task.estimatedDelivery}</span>` : ''}
        </div>
        <div class="task-actions">
          <button class="btn btn-success btn-sm" onclick="DashboardModule.completeTask(${task.id})">完成</button>
          <button class="btn btn-secondary btn-sm" onclick="DashboardModule.pauseTask(${task.id})">暂停（放回队列）</button>
          <button class="btn btn-secondary btn-sm" onclick="DashboardModule.showTaskDetail(${task.id})">详情</button>
        </div>
      </div>
    `;
  }

  // ===== 待排序区 =====
  function renderPendingTasks() {
    const tasks = Store.getTasksByStatus('pending');
    const container = document.getElementById('pendingTasks');
    const count = document.getElementById('pendingCount');
    count.textContent = tasks.length;

    if (tasks.length === 0) {
      container.innerHTML = '<div class="empty-state">没有待排序的任务</div>';
      return;
    }

    container.innerHTML = tasks.map(t => `
      <div class="task-card" onclick="DashboardModule.showTaskDetail(${t.id})">
        <div class="task-card-title">${escapeHtml(t.title)}</div>
        <div class="task-card-meta">
          <span class="task-card-source source-${t.source}">${t.source}</span>
          <span>${escapeHtml(t.requesterName)}</span>
          ${t.expectedDelivery ? `<span>期望：${t.expectedDelivery}</span>` : ''}
          <span style="color:var(--color-text-secondary)">${timeAgo(t.createdAt)}</span>
        </div>
        <div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap;">
          <button class="btn btn-xs ${t.urgency==='high'?'btn-danger':'btn-secondary'}" onclick="event.stopPropagation();DashboardModule.setUrgency(${t.id},'${t.urgency==='high'?'low':'high'}')">
            ${t.urgency==='high'?'紧急':'标紧急'}
          </button>
          <button class="btn btn-xs ${t.importance==='high'?'btn-primary':'btn-secondary'}" onclick="event.stopPropagation();DashboardModule.setImportance(${t.id},'${t.importance==='high'?'low':'high'}')">
            ${t.importance==='high'?'重要':'标重要'}
          </button>
          <button class="btn btn-xs btn-primary" onclick="event.stopPropagation();DashboardModule.startTask(${t.id})">开始</button>
          <button class="btn btn-xs btn-secondary" onclick="event.stopPropagation();DashboardModule.setDelivery(${t.id})">设交付日</button>
          <button class="btn btn-xs btn-danger" onclick="event.stopPropagation();DashboardModule.deleteTask(${t.id})">删除</button>
        </div>
      </div>
    `).join('');
  }

  // ===== 四象限 =====
  function renderQuadrants() {
    const q = Store.getQuadrantTasks();

    const renderQuad = (id, countId, tasks) => {
      const container = document.getElementById(id);
      const countEl = document.getElementById(countId);
      countEl.textContent = tasks.length;

      if (tasks.length === 0) {
        container.innerHTML = `
          <div class="quadrant-header">
            <span class="quadrant-label">${container.querySelector('.quadrant-label')?.textContent || ''}</span>
            <span class="quadrant-count">0</span>
          </div>
          <div style="color:var(--color-text-secondary);font-size:12px;text-align:center;padding:20px;">暂无任务</div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="quadrant-header">
          <span class="quadrant-label">${container.querySelector('.quadrant-label')?.textContent || ''}</span>
          <span class="quadrant-count">${tasks.length}</span>
        </div>
        <div class="quadrant-tasks">
          ${tasks.map(t => `
            <div class="task-card" onclick="DashboardModule.showTaskDetail(${t.id})">
              <div class="task-card-title">${escapeHtml(t.title)}</div>
              <div class="task-card-meta">
                <span class="task-card-source source-${t.source}">${t.source}</span>
                <span>${escapeHtml(t.requesterName)}</span>
                ${t.expectedDelivery ? `<span>${t.expectedDelivery}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    };

    renderQuad('tasksUI', 'countUI', q.urgentImportant);
    renderQuad('tasksNI', 'countNI', q.notUrgentImportant);
    renderQuad('tasksUN', 'countUN', q.urgentNotImportant);
    renderQuad('tasksNN', 'countNN', q.notUrgentNotImportant);
  }

  // ===== 周视图 =====
  function renderWeekView() {
    const weekData = Store.getWeekData();
    const grid = document.getElementById('weekGrid');
    const maxCount = Math.max(...weekData.map(d => d.count), 1);

    grid.innerHTML = weekData.map(d => {
      const pct = Math.round((d.count / maxCount) * 100);
      let barClass = 'bar-low';
      if (pct > 75) barClass = 'bar-over';
      else if (pct > 50) barClass = 'bar-high';
      else if (pct > 25) barClass = 'bar-medium';

      return `
        <div class="week-day ${d.isToday ? 'today' : ''}">
          <div class="week-day-name">${d.name}</div>
          <div class="week-day-date">${d.date.substring(5)}</div>
          <div class="week-day-bar">
            <div class="week-day-bar-fill ${barClass}" style="width:${Math.max(pct, 5)}%"></div>
          </div>
          <div class="week-day-count">${d.count} 个任务</div>
        </div>
      `;
    }).join('');
  }

  // ===== 已完成 =====
  function renderDoneList() {
    const tasks = Store.getTasksByStatus('done').slice(-20).reverse();
    const container = document.getElementById('doneList');
    if (tasks.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无已完成任务</div>';
      return;
    }
    container.innerHTML = tasks.map(t => `
      <div class="done-item">
        <span class="done-title">${escapeHtml(t.title)} <span class="task-card-source source-${t.source}">${t.source}</span></span>
        <span class="done-date">${t.completedAt ? new Date(t.completedAt).toLocaleDateString('zh-CN') : ''}</span>
      </div>
    `).join('');
  }

  // ===== 任务操作 =====

  function startTask(id) {
    if (!Store.canStartTask()) {
      App.showToast('当前已有进行中的任务，请先完成或暂停', 'error');
      return;
    }
    const task = Store.getTask(id);
    if (!task) return;

    // 如果还没标紧急/重要，提示
    if (!task.urgency || !task.importance) {
      if (!confirm('该任务尚未标记紧急度和重要度，确定直接开始？')) return;
    }

    Store.updateTask(id, { status: 'in_progress' });
    App.showToast(`已开始：${task.title}`, 'success');
    refresh();
    App.updateBadges();
  }

  function completeTask(id) {
    const task = Store.getTask(id);
    if (!task) return;
    if (!confirm(`确认完成「${task.title}」？`)) return;
    Store.updateTask(id, { status: 'done', completedAt: new Date().toISOString() });
    App.showToast(`已完成：${task.title}`, 'success');
    refresh();
    App.updateBadges();
  }

  function pauseTask(id) {
    const task = Store.getTask(id);
    if (!task) return;
    Store.updateTask(id, { status: 'queued' });
    App.showToast(`已暂停：${task.title}`, 'info');
    refresh();
    App.updateBadges();
  }

  function setUrgency(id, value) {
    Store.updateTask(id, { urgency: value });
    refresh();
  }

  function setImportance(id, value) {
    Store.updateTask(id, { importance: value });
    refresh();
  }

  function setDelivery(id) {
    const task = Store.getTask(id);
    if (!task) return;
    const date = prompt('设置预计交付日期（YYYY-MM-DD）：', task.estimatedDelivery || task.expectedDelivery || '');
    if (date) {
      Store.updateTask(id, { estimatedDelivery: date });
      refresh();
    }
  }

  function deleteTask(id) {
    const task = Store.getTask(id);
    if (!task) return;
    if (!confirm(`确认删除「${task.title}」？此操作不可恢复。`)) return;
    Store.deleteTask(id);
    App.showToast('已删除', 'info');
    refresh();
    App.updateBadges();
  }

  // ===== 任务详情弹窗 =====
  function showTaskDetail(id) {
    const task = Store.getTask(id);
    if (!task) return;

    document.getElementById('modalTitle').textContent = `${task.taskNumber} - ${task.title}`;
    document.getElementById('modalBody').innerHTML = `
      <div style="display:grid;gap:12px;font-size:14px;">
        <div><strong>描述：</strong>${escapeHtml(task.description || '无')}</div>
        <div><strong>来源：</strong><span class="task-card-source source-${task.source}">${task.source}</span></div>
        <div><strong>需求方：</strong>${escapeHtml(task.requesterName)}（${task.requesterRole || '-'}）</div>
        <div><strong>状态：</strong>${statusLabel(task.status)}</div>
        <div><strong>紧急度：</strong>${task.urgency === 'high' ? '紧急' : '不紧急'}</div>
        <div><strong>重要度：</strong>${task.importance === 'high' ? '重要' : '不重要'}</div>
        <div><strong>需求方期望交付：</strong>${task.expectedDelivery || '未指定'}</div>
        <div><strong>预计交付：</strong>${task.estimatedDelivery || '未设定'}</div>
        <div><strong>参考链接：</strong>${task.reference ? `<a href="${task.reference}" target="_blank">${task.reference}</a>` : '无'}</div>
        <div><strong>创建时间：</strong>${new Date(task.createdAt).toLocaleString('zh-CN')}</div>
        ${task.completedAt ? `<div><strong>完成时间：</strong>${new Date(task.completedAt).toLocaleString('zh-CN')}</div>` : ''}
      </div>
    `;

    // Footer 按钮
    let footerHtml = '';
    if (task.status === 'pending') {
      footerHtml = `
        <button class="btn btn-primary" onclick="DashboardModule.startTask(${task.id});document.getElementById('taskModal').classList.add('hidden')">开始</button>
        <button class="btn btn-danger" onclick="DashboardModule.deleteTask(${task.id});document.getElementById('taskModal').classList.add('hidden')">删除</button>
      `;
    } else if (task.status === 'queued') {
      footerHtml = `
        <button class="btn btn-primary" onclick="DashboardModule.startTask(${task.id});document.getElementById('taskModal').classList.add('hidden')">开始</button>
        <button class="btn btn-secondary" onclick="DashboardModule.deleteTask(${task.id});document.getElementById('taskModal').classList.add('hidden')">删除</button>
      `;
    } else if (task.status === 'in_progress') {
      footerHtml = `
        <button class="btn btn-success" onclick="DashboardModule.completeTask(${task.id});document.getElementById('taskModal').classList.add('hidden')">完成</button>
        <button class="btn btn-secondary" onclick="DashboardModule.pauseTask(${task.id});document.getElementById('taskModal').classList.add('hidden')">暂停</button>
      `;
    }
    document.getElementById('modalFooter').innerHTML = footerHtml;

    document.getElementById('taskModal').classList.remove('hidden');
  }

  document.getElementById('modalClose').addEventListener('click', () => {
    document.getElementById('taskModal').classList.add('hidden');
  });
  document.getElementById('taskModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('taskModal')) {
      document.getElementById('taskModal').classList.add('hidden');
    }
  });

  // ===== 全部刷新 =====
  function refresh() {
    renderStats();
    renderAlerts();
    renderCurrentTask();
    renderPendingTasks();
    renderQuadrants();
    renderWeekView();
    renderDoneList();
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

  function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  }

  return {
    refresh, startTask, completeTask, pauseTask,
    setUrgency, setImportance, setDelivery, deleteTask,
    showTaskDetail,
  };
})();

// ===== 快速添加任务（水水自己用） =====
(() => {
  const btnAddTask = document.getElementById('btnAddTask');
  btnAddTask.addEventListener('click', () => {
    const modal = document.getElementById('taskModal');
    document.getElementById('modalTitle').textContent = '添加任务';
    document.getElementById('modalBody').innerHTML = `
      <div style="display:grid;gap:14px;font-size:14px;">
        <div>
          <label style="display:block;font-weight:600;margin-bottom:4px;">任务标题</label>
          <input type="text" id="addTitle" placeholder="输入任务标题" style="width:100%;padding:10px;border:1px solid var(--color-border);border-radius:6px;font-size:14px;font-family:inherit;">
        </div>
        <div>
          <label style="display:block;font-weight:600;margin-bottom:4px;">任务描述</label>
          <textarea id="addDesc" placeholder="补充描述（选填）" style="width:100%;height:80px;padding:10px;border:1px solid var(--color-border);border-radius:6px;font-size:14px;font-family:inherit;resize:vertical;"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="display:block;font-weight:600;margin-bottom:4px;">紧急度</label>
            <select id="addUrgency" style="width:100%;padding:10px;border:1px solid var(--color-border);border-radius:6px;font-size:14px;">
              <option value="low">不紧急</option>
              <option value="high">紧急</option>
            </select>
          </div>
          <div>
            <label style="display:block;font-weight:600;margin-bottom:4px;">重要度</label>
            <select id="addImportance" style="width:100%;padding:10px;border:1px solid var(--color-border);border-radius:6px;font-size:14px;">
              <option value="low">不重要</option>
              <option value="high">重要</option>
            </select>
          </div>
        </div>
        <div>
          <label style="display:block;font-weight:600;margin-bottom:4px;">截止日期（选填）</label>
          <input type="date" id="addDeadline" style="width:100%;padding:10px;border:1px solid var(--color-border);border-radius:6px;font-size:14px;">
        </div>
      </div>`;
    document.getElementById('modalFooter').innerHTML = `
      <button class="btn btn-secondary" onclick="document.getElementById('taskModal').classList.add('hidden')">取消</button>
      <button class="btn btn-primary" id="btnConfirmAdd">添加</button>`;
    document.getElementById('btnConfirmAdd').addEventListener('click', () => {
      const title = document.getElementById('addTitle').value.trim();
      if (!title) { App.showToast('请输入任务标题', 'error'); return; }
      Store.addTask({
        title,
        description: document.getElementById('addDesc').value.trim(),
        source: '水水',
        requesterRole: '水水',
        requesterName: '水水',
        urgency: document.getElementById('addUrgency').value,
        importance: document.getElementById('addImportance').value,
        expectedDelivery: document.getElementById('addDeadline').value,
        reference: '',
        status: 'pending',
      });
      App.showToast('任务已添加', 'success');
      document.getElementById('taskModal').classList.add('hidden');
      DashboardModule.refresh();
      App.updateBadges();
    });
    modal.classList.remove('hidden');
  });
})();

// ===== 例行任务区 =====
(() => {
  const routineList = document.getElementById('routineList');
  const btnAddRoutine = document.getElementById('btnAddRoutine');
  const ROUTINE_KEY = 'task_manager_routines';

  function loadRoutines() {
    try {
      return JSON.parse(localStorage.getItem(ROUTINE_KEY) || '[]');
    } catch (e) { return []; }
  }

  function saveRoutines(routines) {
    localStorage.setItem(ROUTINE_KEY, JSON.stringify(routines));
  }

  function renderRoutines() {
    const routines = loadRoutines();
    if (routines.length === 0) {
      routineList.innerHTML = `<div class="routine-item" id="routineTemplate">
        <input type="text" class="routine-title" placeholder="任务名称，如：渠道数据日报" maxlength="30">
        <select class="routine-repeat">
          <option value="daily">每天</option>
          <option value="weekly">每周</option>
          <option value="biweekly">每两周</option>
          <option value="monthly">每月</option>
        </select>
        <select class="routine-urgency">
          <option value="low">不紧急</option>
          <option value="high">紧急</option>
        </select>
        <select class="routine-importance">
          <option value="low">不重要</option>
          <option value="high">重要</option>
        </select>
        <button class="btn btn-sm btn-primary routine-generate" disabled>生成</button>
        <button class="btn btn-sm btn-secondary routine-delete" style="display:none;">×</button>
      </div>`;
      bindTemplate();
      return;
    }

    routineList.innerHTML = routines.map((r, i) => `
      <div class="routine-item" data-index="${i}">
        <input type="text" class="routine-title" value="${escapeHtml(r.title)}" maxlength="30">
        <select class="routine-repeat">
          <option value="daily" ${r.repeat==='daily'?'selected':''}>每天</option>
          <option value="weekly" ${r.repeat==='weekly'?'selected':''}>每周</option>
          <option value="biweekly" ${r.repeat==='biweekly'?'selected':''}>每两周</option>
          <option value="monthly" ${r.repeat==='monthly'?'selected':''}>每月</option>
        </select>
        <select class="routine-urgency">
          <option value="low" ${r.urgency==='low'?'selected':''}>不紧急</option>
          <option value="high" ${r.urgency==='high'?'selected':''}>紧急</option>
        </select>
        <select class="routine-importance">
          <option value="low" ${r.importance==='low'?'selected':''}>不重要</option>
          <option value="high" ${r.importance==='high'?'selected':''}>重要</option>
        </select>
        <button class="btn btn-sm btn-primary routine-generate">生成</button>
        <button class="btn btn-sm btn-secondary routine-delete">×</button>
      </div>
    `).join('');

    // 绑定事件
    routineList.querySelectorAll('.routine-item').forEach(item => {
      const idx = item.dataset.index !== undefined ? parseInt(item.dataset.index) : null;
      const titleInput = item.querySelector('.routine-title');
      const repeatSelect = item.querySelector('.routine-repeat');
      const urgencySelect = item.querySelector('.routine-urgency');
      const importanceSelect = item.querySelector('.routine-importance');
      const genBtn = item.querySelector('.routine-generate');
      const delBtn = item.querySelector('.routine-delete');

      function updateRoutine() {
        const routines = loadRoutines();
        routines[idx] = {
          title: titleInput.value.trim(),
          repeat: repeatSelect.value,
          urgency: urgencySelect.value,
          importance: importanceSelect.value,
        };
        saveRoutines(routines);
      }

      titleInput.addEventListener('input', () => {
        genBtn.disabled = !titleInput.value.trim();
        if (idx !== null) updateRoutine();
      });

      repeatSelect.addEventListener('change', () => { if (idx !== null) updateRoutine(); });
      urgencySelect.addEventListener('change', () => { if (idx !== null) updateRoutine(); });
      importanceSelect.addEventListener('change', () => { if (idx !== null) updateRoutine(); });

      genBtn.addEventListener('click', () => {
        const title = titleInput.value.trim();
        if (!title) return;
        Store.addTask({
          title,
          description: `[例行任务] 频率：${repeatSelect.options[repeatSelect.selectedIndex].text}`,
          source: '水水',
          requesterRole: '水水',
          requesterName: '水水',
          urgency: urgencySelect.value,
          importance: importanceSelect.value,
          expectedDelivery: '',
          reference: '',
          status: 'pending',
        });
        App.showToast(`已生成：${title}`, 'success');
        DashboardModule.refresh();
        App.updateBadges();
      });

      delBtn.addEventListener('click', () => {
        if (!confirm('删除这个例行任务模板？')) return;
        const routines = loadRoutines();
        routines.splice(idx, 1);
        saveRoutines(routines);
        renderRoutines();
      });
    });
  }

  function bindTemplate() {
    const item = document.getElementById('routineTemplate');
    const titleInput = item.querySelector('.routine-title');
    const repeatSelect = item.querySelector('.routine-repeat');
    const urgencySelect = item.querySelector('.routine-urgency');
    const importanceSelect = item.querySelector('.routine-importance');
    const genBtn = item.querySelector('.routine-generate');

    titleInput.addEventListener('input', () => {
      genBtn.disabled = !titleInput.value.trim();
    });

    genBtn.addEventListener('click', () => {
      const title = titleInput.value.trim();
      if (!title) return;
      const routines = loadRoutines();
      routines.push({
        title,
        repeat: repeatSelect.value,
        urgency: urgencySelect.value,
        importance: importanceSelect.value,
      });
      saveRoutines(routines);
      Store.addTask({
        title,
        description: `[例行任务] 频率：${repeatSelect.options[repeatSelect.selectedIndex].text}`,
        source: '水水',
        requesterRole: '水水',
        requesterName: '水水',
        urgency: urgencySelect.value,
        importance: importanceSelect.value,
        expectedDelivery: '',
        reference: '',
        status: 'pending',
      });
      App.showToast(`已添加例行任务：${title}`, 'success');
      renderRoutines();
      DashboardModule.refresh();
      App.updateBadges();
    });
  }

  btnAddRoutine.addEventListener('click', () => {
    const routines = loadRoutines();
    routines.push({ title: '', repeat: 'weekly', urgency: 'low', importance: 'low' });
    saveRoutines(routines);
    renderRoutines();
  });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  renderRoutines();
})();
