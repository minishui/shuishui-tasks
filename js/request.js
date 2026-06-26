/**
 * 提需入口 — 白话输入 → AI 解析 → 确认提交
 */
const RequestModule = (() => {
  let currentParsed = null;
  let selectedPerson = null;

  // DOM 元素
  const rawRequest = document.getElementById('rawRequest');
  const personButtons = document.getElementById('personButtons');
  const btnParse = document.getElementById('btnParse');
  const btnBack = document.getElementById('btnBack');
  const btnSubmit = document.getElementById('btnSubmit');
  const btnNewRequest = document.getElementById('btnNewRequest');
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const step3 = document.getElementById('step3');
  const parsedPreview = document.getElementById('parsedPreview');
  const submittedTaskId = document.getElementById('submittedTaskId');

  // 人名按钮点击
  personButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-person');
    if (!btn) return;

    // 切换选中
    const wasSelected = btn.classList.contains('selected');
    personButtons.querySelectorAll('.btn-person').forEach(b => b.classList.remove('selected'));
    
    if (wasSelected) {
      // 取消选择
      selectedPerson = null;
    } else {
      btn.classList.add('selected');
      selectedPerson = {
        name: btn.dataset.name,
        role: btn.dataset.role,
      };
    }

    checkParseButton();
  });

  // 启用/禁用解析按钮
  function checkParseButton() {
    const hasText = rawRequest.value.trim().length >= 5;
    const hasPerson = selectedPerson !== null;
    btnParse.disabled = !(hasText && hasPerson);
  }

  rawRequest.addEventListener('input', checkParseButton);

  // 解析
  btnParse.addEventListener('click', () => {
    const text = rawRequest.value.trim();
    const name = selectedPerson.name;
    const role = selectedPerson.role;

    if (!text || !name) {
      App.showToast('请填写需求并选择你的名字', 'error');
      return;
    }

    currentParsed = Parser.parse(text, role, name);

    if (!currentParsed) {
      App.showToast('无法解析需求，请描述得更具体一些', 'error');
      return;
    }

    renderPreview(currentParsed);
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
  });

  // 渲染预览
  function renderPreview(parsed) {
    const confLabel = (level) => {
      const map = { high: '高置信度', medium: '中置信度', low: '低置信度（请确认）' };
      const cls = { high: 'conf-high', medium: 'conf-medium', low: 'conf-low' };
      return `<span class="preview-confidence ${cls[level] || ''}">${map[level] || ''}</span>`;
    };

    parsedPreview.innerHTML = `
      <div class="preview-field">
        <div class="preview-label">提需人</div>
        <div class="preview-value" style="padding-top:8px;font-weight:600;">${escapeHtml(parsed.requesterName)}（${escapeHtml(parsed.requesterRole)}）</div>
      </div>
      <div class="preview-field">
        <div class="preview-label">需求标题${confLabel(parsed.confidence?.title)}</div>
        <div class="preview-value">
          <input type="text" id="editTitle" value="${escapeHtml(parsed.title)}">
        </div>
      </div>
      <div class="preview-field">
        <div class="preview-label">需求描述</div>
        <div class="preview-value">
          <textarea id="editDescription">${escapeHtml(parsed.description)}</textarea>
        </div>
      </div>
      <div class="preview-field">
        <div class="preview-label">来源方向</div>
        <div class="preview-value">
          <select id="editSource">
            <option value="轻松" ${parsed.source==='轻松'?'selected':''}>轻松渠道</option>
            <option value="学海" ${parsed.source==='学海'?'selected':''}>学海渠道</option>
            <option value="好奇" ${parsed.source==='好奇'?'selected':''}>好奇渠道</option>
            <option value="和谐号" ${parsed.source==='和谐号'?'selected':''}>和谐号渠道</option>
            <option value="中碳" ${parsed.source==='中碳'?'selected':''}>中碳渠道</option>
            <option value="后端转化" ${parsed.source==='后端转化'?'selected':''}>后端转化</option>
            <option value="老板" ${parsed.source==='老板'?'selected':''}>老板</option>
          </select>
        </div>
      </div>
      <div class="preview-field">
        <div class="preview-label">紧急度${confLabel(parsed.confidence?.urgency)}</div>
        <div class="preview-value">
          <select id="editUrgency">
            <option value="high" ${parsed.urgency==='high'?'selected':''}>紧急</option>
            <option value="low" ${parsed.urgency==='low'?'selected':''}>不紧急</option>
          </select>
        </div>
      </div>
      <div class="preview-field">
        <div class="preview-label">重要度${confLabel(parsed.confidence?.importance)}</div>
        <div class="preview-value">
          <select id="editImportance">
            <option value="high" ${parsed.importance==='high'?'selected':''}>重要</option>
            <option value="low" ${parsed.importance==='low'?'selected':''}>不重要</option>
          </select>
        </div>
      </div>
      <div class="preview-field">
        <div class="preview-label">期望交付日${confLabel(parsed.confidence?.expectedDelivery)}</div>
        <div class="preview-value">
          <input type="date" id="editDelivery" value="${parsed.expectedDelivery || ''}">
        </div>
      </div>
      <div class="preview-field">
        <div class="preview-label">参考链接${confLabel(parsed.confidence?.reference)}</div>
        <div class="preview-value">
          <input type="text" id="editReference" value="${escapeHtml(parsed.reference || '')}" placeholder="文档链接、截图等">
        </div>
      </div>
    `;
  }

  // 返回修改
  btnBack.addEventListener('click', () => {
    step2.classList.add('hidden');
    step1.classList.remove('hidden');
  });

  // 提交
  btnSubmit.addEventListener('click', () => {
    const title = document.getElementById('editTitle').value.trim();
    const description = document.getElementById('editDescription').value.trim();
    const source = document.getElementById('editSource').value;
    const urgency = document.getElementById('editUrgency').value;
    const importance = document.getElementById('editImportance').value;
    const expectedDelivery = document.getElementById('editDelivery').value;
    const reference = document.getElementById('editReference').value.trim();

    // 最终校验
    const finalParsed = {
      title, description, source, urgency, importance, expectedDelivery, reference,
      requesterRole: currentParsed.requesterRole,
      requesterName: currentParsed.requesterName,
    };
    const errors = Parser.validate(finalParsed);
    if (errors.length > 0) {
      App.showToast(errors[0], 'error');
      return;
    }

    // 存入
    const task = Store.addTask({
      title,
      description,
      source,
      requesterRole: finalParsed.requesterRole,
      requesterName: finalParsed.requesterName,
      urgency,
      importance,
      expectedDelivery,
      reference,
      status: 'pending',
    });

    submittedTaskId.textContent = task.taskNumber;
    step2.classList.add('hidden');
    step3.classList.remove('hidden');

    // 刷新看板
    DashboardModule.refresh();
    App.updateBadges();
  });

  // 提交新需求
  btnNewRequest.addEventListener('click', resetForm);

  function resetForm() {
    rawRequest.value = '';
    personButtons.querySelectorAll('.btn-person').forEach(b => b.classList.remove('selected'));
    selectedPerson = null;
    btnParse.disabled = true;
    currentParsed = null;
    step3.classList.add('hidden');
    step1.classList.remove('hidden');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { resetForm };
})();
