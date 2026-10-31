import { test, expect } from "vitest";
import { reviewModel, minutesText, tierName, plantCount } from "../src/review/review";
import type { Snapshot } from "../src/state/types";

const base = (): Snapshot => ({
  completed: 5,
  totalSecs: 3900,
  weekSecs: 900, weekRounds: 2, weekDays: 1,
  monthSecs: 3900, monthRounds: 3,
  totalDays: 4,
  nextTierRounds: 7,
  records: [{ id: 1, task: "a", seconds: 600, completed: true, date: "2026-10-26T09:00:00+08:00" }],
  visitors: [
    { species: "clownfish", name: "小丑鱼", visits: 2, date: "2026-10-26T09:00:00+08:00" },
    { species: "turtle", name: "海龟", visits: 1, date: "2026-10-20T09:00:00+08:00" },
  ],
} as unknown as Snapshot);

test("minutes text formats under and over an hour", () => {
  expect(minutesText(59 * 60)).toBe("59 分钟");
  expect(minutesText(90 * 60)).toBe("1 小时 30 分钟");
  expect(minutesText(3900)).toBe("1 小时 5 分钟");
});

test("tier names follow the existing growth ladder", () => {
  expect(tierName(0)).toBe("初生");
  expect(tierName(2)).toBe("初生");
  expect(tierName(3)).toBe("萌芽");
  expect(tierName(11)).toBe("萌芽");
  expect(tierName(12)).toBe("繁盛");
  expect(tierName(24)).toBe("小小绿洲");
});

test("brand-new user sees only the gentle opening line", () => {
  const model = reviewModel({ records: [], visitors: [] } as unknown as Snapshot);
  expect(model.empty).toBe(true);
  expect(model.emptyText).toBe("完成第一轮，这里开始有故事。");
  expect(model.footnote).toBe("这些数字只保存在你的电脑上。");
});

test("populated state renders every reviewed line", () => {
  const model = reviewModel(base());
  expect(model.empty).toBe(false);
  expect(model.weekLine).toBe("本周 15 分钟 · 2 轮");
  expect(model.weekDaysLine).toBe("本周 1 天有你的专注");
  expect(model.monthLine).toBe("本月 1 小时 5 分钟 · 3 轮");
  expect(model.togetherLine).toBe("已经一起度过 1 小时 5 分钟，完成 5 轮专注。");
  expect(model.totalDaysLine).toBe("一共 4 天");
  expect(model.bookLine).toBe("图鉴 2 / 15");
  expect(model.bookNote).toBe("还有 13 位朋友没来过，慢慢来");
  expect(model.lastVisitorLine).toBe("最近到访：小丑鱼 · 来过 2 次");
  expect(model.growthLine).toBe("当前：萌芽");
  expect(model.nextGrowthLine).toBe("再 7 轮就是繁盛");
  expect(model.plantsLine).toBe("海底已有 2 株植物，长满后不再拥挤");
  expect(model.footnote).toBe("这些数字只保存在你的电脑上。");
});

test("history exists but this week is empty shows the no-pressure line", () => {
  const state = base() as unknown as Record<string, unknown>;
  state.weekSecs = 0; state.weekRounds = 0; state.weekDays = 0;
  const model = reviewModel(state as unknown as Snapshot);
  expect(model.weekLine).toBe("");
  expect(model.weekDaysLine).toBe("本周还没有，不打紧，随时开始。");
});

test("omitted zero derived fields render as zero, never NaN/undefined", () => {
  const state = base() as unknown as Record<string, unknown>;
  delete state.weekSecs; delete state.weekRounds; delete state.weekDays;
  delete state.monthSecs; delete state.monthRounds; delete state.totalDays;
  delete state.nextTierRounds;
  const model = reviewModel(state as unknown as Snapshot);
  expect(model.weekLine).toBe("");
  expect(model.weekDaysLine).toBe("本周还没有，不打紧，随时开始。");
  expect(model.monthLine).toBe("本月 0 分钟 · 0 轮");
  expect(model.totalDaysLine).toBe("一共 0 天");
  expect(model.nextGrowthLine).toBe("继续积累专注，认识更多海底朋友");
  expect(model.togetherLine).toBe("已经一起度过 1 小时 5 分钟，完成 5 轮专注。");
});

test("collecting all fifteen visitors shows the collected line", () => {
  const state = base();
  state.visitors = Array.from({ length: 15 }, (_, i) => ({ species: `s${i}`, name: `鱼${i}`, visits: 1, date: `2026-10-${i + 1}T09:00:00+08:00` })) as Snapshot["visitors"];
  const model = reviewModel(state);
  expect(model.bookLine).toBe("图鉴 15 / 15");
  expect(model.bookNote).toBe("15 位朋友都来过了");
});

test("maxed growth uses the existing maxed-out copy", () => {
  const state = base() as unknown as Record<string, unknown>;
  state.completed = 24; state.nextTierRounds = 0;
  const model = reviewModel(state as unknown as Snapshot);
  expect(model.growthLine).toBe("当前：小小绿洲");
  expect(model.nextGrowthLine).toBe("继续积累专注，认识更多海底朋友");
});

test("plantCount aligns with the reef growth", () => {
  expect(plantCount(0)).toBe(0);
  expect(plantCount(1)).toBe(1);
  expect(plantCount(25)).toBe(8);
});
