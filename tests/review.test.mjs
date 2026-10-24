import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewModel, minutesText, tierName } from '../web/review.js';

const base = () => ({
  completed: 5,
  totalSecs: 3900,
  weekSecs: 900, weekRounds: 2, weekDays: 1,
  monthSecs: 3900, monthRounds: 3,
  totalDays: 4,
  nextTierRounds: 7,
  records: [{ task: 'a', seconds: 600, completed: true, date: '2026-10-26T09:00:00+08:00' }],
  visitors: [
    { species: 'clownfish', name: '小丑鱼', visits: 2, date: '2026-10-26T09:00:00+08:00' },
    { species: 'turtle', name: '海龟', visits: 1, date: '2026-10-20T09:00:00+08:00' },
  ],
});

test('minutes text formats under and over an hour', () => {
  assert.equal(minutesText(59 * 60), '59 分钟');
  assert.equal(minutesText(90 * 60), '1 小时 30 分钟');
  assert.equal(minutesText(3900), '1 小时 5 分钟');
});

test('tier names follow the existing growth ladder', () => {
  assert.equal(tierName(0), '初生');
  assert.equal(tierName(2), '初生');
  assert.equal(tierName(3), '萌芽');
  assert.equal(tierName(11), '萌芽');
  assert.equal(tierName(12), '繁盛');
  assert.equal(tierName(24), '小小绿洲');
});

test('brand-new user sees only the gentle opening line', () => {
  const model = reviewModel({ records: [], visitors: [] });
  assert.equal(model.empty, true);
  assert.equal(model.emptyText, '完成第一轮，这里开始有故事。');
  assert.equal(model.footnote, '这些数字只保存在你的电脑上。');
});

test('populated state renders every reviewed line', () => {
  const model = reviewModel(base());
  assert.equal(model.empty, false);
  assert.equal(model.weekLine, '本周 15 分钟 · 2 轮');
  assert.equal(model.weekDaysLine, '本周 1 天有你的专注');
  assert.equal(model.monthLine, '本月 1 小时 5 分钟 · 3 轮');
  assert.equal(model.togetherLine, '已经一起度过 1 小时 5 分钟，完成 5 轮专注。');
  assert.equal(model.totalDaysLine, '一共 4 天');
  assert.equal(model.bookLine, '图鉴 2 / 15');
  assert.equal(model.bookNote, '还有 13 位朋友没来过，慢慢来');
  assert.equal(model.lastVisitorLine, '最近到访：小丑鱼 · 来过 2 次');
  assert.equal(model.growthLine, '当前：萌芽');
  assert.equal(model.nextGrowthLine, '再 7 轮就是繁盛');
  assert.equal(model.plantsLine, '海底已有 2 株植物，长满后不再拥挤');
  assert.equal(model.footnote, '这些数字只保存在你的电脑上。');
});

test('history exists but this week is empty shows the no-pressure line', () => {
  const state = base();
  state.weekSecs = 0; state.weekRounds = 0; state.weekDays = 0;
  const model = reviewModel(state);
  assert.equal(model.weekLine, '');
  assert.equal(model.weekDaysLine, '本周还没有，不打紧，随时开始。');
});

test('collecting all fifteen visitors shows the collected line', () => {
  const state = base();
  state.visitors = Array.from({ length: 15 }, (_, i) => ({ species: `s${i}`, name: `鱼${i}`, visits: 1, date: `2026-10-${i + 1}T09:00:00+08:00` }));
  const model = reviewModel(state);
  assert.equal(model.bookLine, '图鉴 15 / 15');
  assert.equal(model.bookNote, '15 位朋友都来过了');
});

test('maxed growth uses the existing maxed-out copy', () => {
  const state = base();
  state.completed = 24;
  state.nextTierRounds = 0;
  const model = reviewModel(state);
  assert.equal(model.growthLine, '当前：小小绿洲');
  assert.equal(model.nextGrowthLine, '继续积累专注，认识更多海底朋友');
});
