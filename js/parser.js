/**
 * AI 自然语言解析器 — 将白话需求解析为结构化字段
 */
const Parser = (() => {
  // 紧急关键词 — 出现在标题/描述中都算
  const URGENT_KEYWORDS = ['急', '紧急', '尽快', '马上', '立刻', '立即', '赶紧', '十万火急', '火烧眉毛', '很急', '非常急', '特别急', '今天就要', '明天就要', '今天完成', '明天完成', 'asap', 'urgent'];

  // 重要关键词
  const IMPORTANT_KEYWORDS = ['重要', '关键', '必须', '老板', '领导', '业绩', '指标', '汇报', '开会', '考核'];

  // 时间关键词 → 日期偏移
  function parseTimeExpression(text) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const patterns = [
      { regex: /今天/, offset: 0 },
      { regex: /明天/, offset: 1 },
      { regex: /后天/, offset: 2 },
      { regex: /大后天/, offset: 3 },
      { regex: /下周[一二三四五六日]/, handler: (match) => {
        const dayMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0 };
        const day = dayMap[match[0].replace('下周', '')];
        const nextMonday = new Date(today);
        const currentDay = today.getDay();
        const daysUntilMonday = currentDay === 0 ? 1 : 8 - currentDay;
        nextMonday.setDate(today.getDate() + daysUntilMonday);
        nextMonday.setDate(nextMonday.getDate() + (day === 0 ? 6 : day - 1));
        return nextMonday;
      }},
      { regex: /下周/, offset: 7 },
      { regex: /这周[一二三四五六日]/, handler: (match) => {
        const dayMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0 };
        const day = dayMap[match[0].replace('这周', '')];
        const currentDay = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
        monday.setDate(monday.getDate() + (day === 0 ? 6 : day - 1));
        return monday;
      }},
      { regex: /这周|本周/, offset: 0 },
      { regex: /周五前/, handler: () => {
        const currentDay = today.getDay();
        const friday = new Date(today);
        friday.setDate(today.getDate() + (currentDay <= 5 ? 5 - currentDay : 12 - currentDay));
        return friday;
      }},
      { regex: /周末前/, handler: () => {
        const currentDay = today.getDay();
        const sunday = new Date(today);
        sunday.setDate(today.getDate() + (currentDay === 0 ? 0 : 7 - currentDay));
        return sunday;
      }},
    ];

    for (const p of patterns) {
      const match = text.match(p.regex);
      if (match) {
        if (p.handler) return p.handler(match);
        const d = new Date(today);
        d.setDate(today.getDate() + p.offset);
        return d;
      }
    }

    const dateMatch = text.match(/(\d{1,2})月(\d{1,2})[日号]/);
    if (dateMatch) {
      const month = parseInt(dateMatch[1]);
      const day = parseInt(dateMatch[2]);
      const year = now.getFullYear();
      const d = new Date(year, month - 1, day);
      if (d >= today) return d;
      return new Date(year + 1, month - 1, day);
    }

    const isoMatch = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    }

    return null;
  }

  function formatDate(date) {
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }

  // 智能提取标题：从原文中找「做什么」的核心短语
  function extractTitle(text) {
    // 策略1: 尝试匹配 "帮我看/做/查/处理/分析/整理..." 的短语
    const actionPatterns = [
      /(帮[我]?[^\n。！？]*)/,
      /(需要[^\n。！？]*)/,
      /(请[^\n。！？]*)/,
      /([^，\n。！？]*看[一]?下[^\n。！？]*)/,
      /([^，\n。！？]*做[一]?下[^\n。！？]*)/,
      /([^，\n。！？]*查[一]?下[^\n。！？]*)/,
      /([^，\n。！？]*分析[^\n。！？]*)/,
      /([^，\n。！？]*整理[^\n。！？]*)/,
      /([^，\n。！？]*处理[^\n。！？]*)/,
      /([^，\n。！？]*对比[^\n。！？]*)/,
      /([^，\n。！？]*统计[^\n。！？]*)/,
    ];

    for (const pat of actionPatterns) {
      const m = text.match(pat);
      if (m && m[1].length >= 5 && m[1].length <= 50) {
        // 去掉开头的虚词
        let title = m[1].trim();
        title = title.replace(/^(那个|这个|就是|其实|就是[说]?|那么|然后|额+|嗯+)/, '');
        if (title.length >= 5) return title;
      }
    }

    // 策略2: 取第一个有实际内容的句子，去掉语气词
    const sentences = text.split(/[。！？\n]/);
    for (const s of sentences) {
      const cleaned = s.trim();
      if (cleaned.length >= 6 && cleaned.length <= 50) return cleaned;
    }

    // 兜底: 截断
    return text.length > 40 ? text.substring(0, 40) + '...' : text;
  }

  // 核心解析函数
  function parse(rawText, requesterRole, requesterName) {
    const text = rawText.trim();
    if (!text) return null;

    const result = {
      title: '',
      description: text,
      requesterRole: requesterRole || '',
      requesterName: requesterName || '',
      source: requesterRole || '',
      expectedDelivery: '',
      urgency: '',
      importance: '',
      reference: '',
      confidence: {},
    };

    // 1. 智能提取标题
    result.title = extractTitle(text);
    result.confidence.title = result.title.length <= 35 ? 'high' : 'medium';

    // 2. 紧急度 — 扫描全文
    const urgentHits = URGENT_KEYWORDS.filter(kw => text.includes(kw));
    if (urgentHits.length >= 2 || text.includes('十万火急') || text.includes('火烧眉毛') || text.includes('今天就要')) {
      result.urgency = 'high';
      result.confidence.urgency = 'high';
    } else if (urgentHits.length >= 1) {
      result.urgency = 'high';
      result.confidence.urgency = 'medium';
    } else {
      result.urgency = 'low';
      result.confidence.urgency = 'low';
    }

    // 3. 重要度 — 扫描全文
    const importantHits = IMPORTANT_KEYWORDS.filter(kw => text.includes(kw));
    if (requesterRole === '老板' || text.includes('老板') || text.includes('领导')) {
      result.importance = 'high';
      result.confidence.importance = 'high';
    } else if (importantHits.length >= 2) {
      result.importance = 'high';
      result.confidence.importance = 'high';
    } else if (importantHits.length >= 1) {
      result.importance = 'high';
      result.confidence.importance = 'medium';
    } else {
      result.importance = 'low';
      result.confidence.importance = 'low';
    }

    // 4. 期望交付时间
    const deliveryDate = parseTimeExpression(text);
    if (deliveryDate) {
      result.expectedDelivery = formatDate(deliveryDate);
      result.confidence.expectedDelivery = 'medium';
    }

    // 5. 提取参考链接
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      result.reference = urlMatch[0];
      result.confidence.reference = 'high';
    }

    return result;
  }

  function validate(parsed) {
    const errors = [];
    if (!parsed.title || parsed.title.length < 3) {
      errors.push('需求标题太模糊（少于3个字），请描述清楚要做什么');
    }
    if (!parsed.description || parsed.description.length < 10) {
      errors.push('需求描述不够具体（少于10个字），请说明交付标准和完成定义');
    }
    if (!parsed.requesterName || parsed.requesterName.trim().length < 2) {
      errors.push('请填写你的姓名');
    }
    return errors;
  }

  return { parse, validate, formatDate, parseTimeExpression };
})();
