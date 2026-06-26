/**
 * AI 自然语言解析器 — 将白话需求解析为结构化字段
 * 本地规则解析 + 预留 LLM API 接口
 */

const Parser = (() => {
  // 渠道关键词映射
  const CHANNEL_KEYWORDS = {
    '轻松': ['轻松', 'qs', 'qingsong'],
    '学海': ['学海', 'xh', 'xuehai'],
    '好奇': ['好奇', 'hq', 'haoqi'],
    '和谐号': ['和谐号', '和谐', 'hxh', 'hexiehao'],
    '中碳': ['中碳', 'zt', 'zhongtan'],
    '后端转化': ['后端', '转化', 'bdzh', 'backend'],
    '领导': ['领导', '老板', 'boss'],
  };

  // 紧急关键词
  const URGENT_KEYWORDS = ['急', '紧急', '尽快', '马上', '立刻', '立即', '赶紧', '今天', '明天', 'asap', 'urgent'];
  const VERY_URGENT_KEYWORDS = ['非常急', '特别急', '很急', '十万火急', '火烧眉毛'];

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
        if (day === 0) {
          nextMonday.setDate(nextMonday.getDate() + 6);
        } else {
          nextMonday.setDate(nextMonday.getDate() + day - 1);
        }
        return nextMonday;
      }},
      { regex: /下周/, offset: 7 },  // 模糊"下周"
      { regex: /这周[一二三四五六日]/, handler: (match) => {
        const dayMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0 };
        const day = dayMap[match[0].replace('这周', '')];
        const currentDay = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
        if (day === 0) {
          monday.setDate(monday.getDate() + 6);
        } else {
          monday.setDate(monday.getDate() + day - 1);
        }
        return monday;
      }},
      { regex: /这周|本周/, offset: 0 },  // 模糊
      { regex: /周五前/, handler: () => {
        const currentDay = today.getDay();
        const friday = new Date(today);
        if (currentDay <= 5) {
          friday.setDate(today.getDate() + (5 - currentDay));
        } else {
          friday.setDate(today.getDate() + (5 + 7 - currentDay));
        }
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
        if (p.handler) {
          return p.handler(match);
        }
        const d = new Date(today);
        d.setDate(today.getDate() + p.offset);
        return d;
      }
    }

    // 尝试匹配具体日期：6月30日、6.30、2026-06-30
    const dateMatch = text.match(/(\d{1,2})月(\d{1,2})[日号]/);
    if (dateMatch) {
      const month = parseInt(dateMatch[1]);
      const day = parseInt(dateMatch[2]);
      const year = now.getFullYear();
      const d = new Date(year, month - 1, day);
      if (d >= today) return d;
      // 如果已过，推到明年
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

    // 1. 提取标题 — 取第一句或前30字
    const firstSentence = text.split(/[。！？\n]/)[0].trim();
    result.title = firstSentence.length > 40 ? firstSentence.substring(0, 40) + '...' : firstSentence;
    result.confidence.title = firstSentence.length <= 40 ? 'high' : 'medium';

    // 2. 识别渠道/来源
    if (!requesterRole) {
      for (const [channel, keywords] of Object.entries(CHANNEL_KEYWORDS)) {
        if (keywords.some(kw => text.toLowerCase().includes(kw))) {
          result.source = channel;
          result.requesterRole = channel;
          result.confidence.source = 'medium';
          break;
        }
      }
    }
    if (!result.confidence.source) result.confidence.source = 'high'; // 用户选的

    // 3. 紧急度
    const hasVeryUrgent = VERY_URGENT_KEYWORDS.some(kw => text.includes(kw));
    const hasUrgent = URGENT_KEYWORDS.some(kw => text.includes(kw));
    if (hasVeryUrgent) {
      result.urgency = 'high';
      result.confidence.urgency = 'high';
    } else if (hasUrgent) {
      result.urgency = 'high';
      result.confidence.urgency = 'medium';
    } else {
      result.urgency = 'low';
      result.confidence.urgency = 'low';
    }

    // 4. 重要度 — 领导提的默认重要
    if (requesterRole === '领导' || text.includes('领导') || text.includes('老板')) {
      result.importance = 'high';
      result.confidence.importance = 'high';
    } else if (text.includes('重要') || text.includes('关键') || text.includes('必须')) {
      result.importance = 'high';
      result.confidence.importance = 'medium';
    } else {
      result.importance = 'low';
      result.confidence.importance = 'low';
    }

    // 5. 期望交付时间
    const deliveryDate = parseTimeExpression(text);
    if (deliveryDate) {
      result.expectedDelivery = formatDate(deliveryDate);
      result.confidence.expectedDelivery = 'medium';
    }

    // 6. 提取参考链接
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      result.reference = urlMatch[0];
      result.confidence.reference = 'high';
    }

    // 7. 整理描述 — 去掉标题部分，保留剩余
    if (result.title.length < text.length) {
      result.description = text;
    }

    return result;
  }

  // 验证提需字段完整性
  function validate(parsed) {
    const errors = [];
    if (!parsed.title || parsed.title.length < 3) {
      errors.push('需求标题太模糊（少于3个字），请描述清楚要做什么');
    }
    if (!parsed.description || parsed.description.length < 10) {
      errors.push('需求描述不够具体（少于10个字），请说明交付标准和完成定义');
    }
    if (!parsed.requesterRole) {
      errors.push('请选择你的身份（渠道/后端转化/领导）');
    }
    if (!parsed.requesterName || parsed.requesterName.trim().length < 2) {
      errors.push('请填写你的姓名');
    }
    return errors;
  }

  return { parse, validate, formatDate, parseTimeExpression };
})();
