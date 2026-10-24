// review.js — 「这段时间」面板的纯函数模型：输入后端 Snapshot，输出要渲染的文案。
// 不碰 DOM，不做动画；四态（全新空态 / 有历史 / 集齐图鉴 / 满级）全部收敛在这里。
export function tierName(completed) {
  return completed < 3 ? "初生" : completed < 12 ? "萌芽" : completed < 24 ? "繁盛" : "小小绿洲";
}

function nextTierName(completed) {
  return completed < 3 ? "萌芽" : completed < 12 ? "繁盛" : "小小绿洲";
}

// T16: 不足 1 小时显示「X 分钟」，超过显示「X 小时 Y 分钟」。
export function minutesText(secs) {
  const minutes = Math.floor(secs / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

// Aligns with reef.js: every 3 completed rounds grows one plant, capped at 8.
export function plantCount(completed) {
  if (completed <= 0) return 0;
  return Math.min(8, 1 + Math.floor((completed - 1) / 3));
}

function latestVisitor(visitors) {
  let best = null;
  for (const v of visitors) if (!best || v.date > best.date) best = v;
  return best;
}

export function reviewModel(state) {
  if (!state.records || state.records.length === 0) {
    return { empty: true, emptyText: "完成第一轮，这里开始有故事。", footnote: "这些数字只保存在你的电脑上。" };
  }
  const completed = state.completed || 0;
  const visitors = state.visitors || [];
  const last = latestVisitor(visitors);
  const plants = plantCount(completed);
  const remaining = 15 - visitors.length;
  return {
    empty: false,
    // 本周空态：只显示 T14 一句，不渲染 0 值。
    weekLine: state.weekSecs > 0 ? `本周 ${minutesText(state.weekSecs)} · ${state.weekRounds} 轮` : "",
    weekDaysLine: state.weekSecs > 0 ? `本周 ${state.weekDays} 天有你的专注` : "本周还没有，不打紧，随时开始。",
    monthLine: `本月 ${minutesText(state.monthSecs)} · ${state.monthRounds} 轮`,
    togetherLine: `已经一起度过 ${minutesText(state.totalSecs)}，完成 ${completed} 轮专注。`,
    totalDaysLine: `一共 ${state.totalDays} 天`,
    bookLine: `图鉴 ${visitors.length} / 15`,
    bookNote: remaining <= 0 ? "15 位朋友都来过了" : `还有 ${remaining} 位朋友没来过，慢慢来`,
    lastVisitorLine: last ? `最近到访：${last.name} · 来过 ${last.visits} 次` : "",
    growthLine: `当前：${tierName(completed)}`,
    nextGrowthLine: state.nextTier === 0 ? "继续积累专注，认识更多海底朋友" : `再 ${state.nextTier} 轮就是${nextTierName(completed)}`,
    plantsLine: plants > 0 ? `海底已有 ${plants} 株植物，长满后不再拥挤` : "",
    footnote: "这些数字只保存在你的电脑上。",
  };
}
