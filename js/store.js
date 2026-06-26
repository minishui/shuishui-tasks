/**
 * 数据存储层 — localStorage + 预留 GitHub API 接口
 */
const Store = (() => {
  const STORAGE_KEY = 'task_manager_data';
  const VERSION_KEY = 'task_manager_version';
  const CURRENT_VERSION = 1;

  // 默认数据结构
  const getDefaultData = () => ({
    version: CURRENT_VERSION,
    tasks: [],
    nextId: 1,
    settings: {
      maxInProgress: 1,
      urgentImportantThreshold: 3,  // 紧急重要超过此数告警
      workHoursPerDay: 8,
    },
    updatedAt: new Date().toISOString(),
  });

  let data = null;

  // 初始化/加载
  function init() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const version = localStorage.getItem(VERSION_KEY);
      if (raw && version == CURRENT_VERSION) {
        data = JSON.parse(raw);
        // 确保结构完整
        if (!data.tasks) data.tasks = [];
        if (!data.nextId) data.nextId = 1;
        if (!data.settings) data.settings = getDefaultData().settings;
      } else {
        data = getDefaultData();
        save();
      }
    } catch (e) {
      console.error('数据加载失败，使用默认数据', e);
      data = getDefaultData();
      save();
    }
    return data;
  }

  function save() {
    data.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION));
  }

  // 生成新ID
  function nextId() {
    return data.nextId++;
  }

  // ===== 任务 CRUD =====

  function addTask(task) {
    task.id = nextId();
    task.taskNumber = `T-${String(task.id).padStart(4, '0')}`;
    task.status = task.status || 'pending'; // pending | queued | in_progress | done
    task.urgency = task.urgency || null;    // high | low
    task.importance = task.importance || null; // high | low
    task.createdAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();
    task.completedAt = null;
    task.expectedDelivery = task.expectedDelivery || null; // 需求方期望交付日
    task.estimatedDelivery = task.estimatedDelivery || null; // 预计交付日
    task.assignedWeek = null; // 分配到哪一周的周几
    data.tasks.push(task);
    save();
    return task;
  }

  function updateTask(id, updates) {
    const idx = data.tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    Object.assign(data.tasks[idx], updates, { updatedAt: new Date().toISOString() });
    save();
    return data.tasks[idx];
  }

  function deleteTask(id) {
    const idx = data.tasks.findIndex(t => t.id === id);
    if (idx === -1) return false;
    data.tasks.splice(idx, 1);
    save();
    return true;
  }

  function getTask(id) {
    return data.tasks.find(t => t.id === id) || null;
  }

  function getTaskByNumber(taskNumber) {
    return data.tasks.find(t => t.taskNumber === taskNumber) || null;
  }

  function getAllTasks() {
    return [...data.tasks];
  }

  function getTasksByStatus(status) {
    return data.tasks.filter(t => t.status === status);
  }

  function getTasksByRequester(name) {
    const q = name.toLowerCase();
    return data.tasks.filter(t => t.requesterName && t.requesterName.toLowerCase().includes(q));
  }

  function searchTasks(query) {
    const q = query.toLowerCase();
    // 先按需求编号精确匹配
    const byNumber = data.tasks.find(t => t.taskNumber && t.taskNumber.toLowerCase() === q);
    if (byNumber) return [byNumber];
    // 模糊匹配
    return data.tasks.filter(t => {
      return (t.taskNumber && t.taskNumber.toLowerCase().includes(q)) ||
             (t.title && t.title.toLowerCase().includes(q)) ||
             (t.requesterName && t.requesterName.toLowerCase().includes(q)) ||
             (t.description && t.description.toLowerCase().includes(q));
    });
  }

  // ===== 四象限分类 =====
  function getQuadrantTasks() {
    const queued = data.tasks.filter(t => t.status === 'queued' || t.status === 'in_progress');
    return {
      urgentImportant: queued.filter(t => t.urgency === 'high' && t.importance === 'high'),
      notUrgentImportant: queued.filter(t => t.urgency !== 'high' && t.importance === 'high'),
      urgentNotImportant: queued.filter(t => t.urgency === 'high' && t.importance !== 'high'),
      notUrgentNotImportant: queued.filter(t => t.urgency !== 'high' && t.importance !== 'high'),
    };
  }

  // ===== 统计 =====
  function getStats() {
    return {
      total: data.tasks.length,
      pending: data.tasks.filter(t => t.status === 'pending').length,
      queued: data.tasks.filter(t => t.status === 'queued').length,
      inProgress: data.tasks.filter(t => t.status === 'in_progress').length,
      done: data.tasks.filter(t => t.status === 'done').length,
    };
  }

  // ===== 单任务锁定检查 =====
  function canStartTask() {
    return data.tasks.filter(t => t.status === 'in_progress').length < data.settings.maxInProgress;
  }

  function getCurrentInProgress() {
    return data.tasks.find(t => t.status === 'in_progress') || null;
  }

  // ===== 告警检查 =====
  function getAlerts() {
    const alerts = [];
    const q = getQuadrantTasks();
    const uiCount = q.urgentImportant.length;
    if (uiCount > data.settings.urgentImportantThreshold) {
      alerts.push({
        type: 'danger',
        message: `紧急且重要任务已达 ${uiCount} 个，超过阈值 ${data.settings.urgentImportantThreshold}，建议向上汇报协调资源`,
      });
    }
    const pendingCount = data.tasks.filter(t => t.status === 'pending').length;
    if (pendingCount > 10) {
      alerts.push({
        type: 'warning',
        message: `待排序任务积压 ${pendingCount} 个，请及时处理`,
      });
    }
    return alerts;
  }

  // ===== 导出/导入（预留） =====
  function exportData() {
    return JSON.stringify(data, null, 2);
  }

  function importData(jsonStr) {
    try {
      const imported = JSON.parse(jsonStr);
      data = imported;
      save();
      return true;
    } catch (e) {
      return false;
    }
  }

  // ===== 周视图数据 =====
  function getWeekData() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=周日
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const weekDays = [];
    const dayNames = ['周一', '周二', '周三', '周四', '周五'];

    for (let i = 0; i < 5; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const dayTasks = data.tasks.filter(t => {
        if (t.status === 'done' && t.completedAt) {
          const completed = new Date(t.completedAt);
          return completed >= day && completed <= dayEnd;
        }
        if (t.estimatedDelivery) {
          const est = new Date(t.estimatedDelivery);
          return est >= day && est <= dayEnd;
        }
        return false;
      });

      const dayStr = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
      const isToday = dayStr === `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

      weekDays.push({
        name: dayNames[i],
        date: dayStr,
        isToday,
        count: dayTasks.length,
      });
    }
    return weekDays;
  }

  // 初始化
  init();

  return {
    addTask, updateTask, deleteTask, getTask, getTaskByNumber,
    getAllTasks, getTasksByStatus, getTasksByRequester, searchTasks,
    getQuadrantTasks, getStats, canStartTask, getCurrentInProgress,
    getAlerts, exportData, importData, getWeekData,
  };
})();
