import { useEffect, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Slider from "@radix-ui/react-slider";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useAquarium } from "./state/useAquarium";
import { desktop } from "./state/bridge";
import { ReefCanvas } from "./reef/ReefCanvas";
import { VisitorPortrait } from "./reef/VisitorPortrait";
import { reviewModel } from "./review/review";
import { Icon } from "./icons";
import { SettingsDialog } from "./components/SettingsDialog";
import { EndDialog } from "./components/EndDialog";
import { ToastHost } from "./components/ToastHost";

const SOUND_OPTIONS: { id: string; label: string; icon: string }[] = [
  { id: "waves", label: "海浪", icon: "waves" },
  { id: "rain", label: "雨声", icon: "rain" },
  { id: "thunder", label: "雷雨", icon: "thunder" },
  { id: "stream", label: "溪流", icon: "stream" },
  { id: "bubbles", label: "气泡", icon: "bubbles" },
  { id: "boil", label: "煮沸", icon: "boil" },
  { id: "deepsea", label: "深海", icon: "deepsea" },
  { id: "wind", label: "风声", icon: "wind" },
  { id: "fire", label: "篝火", icon: "fire" },
  { id: "forest", label: "森林", icon: "forest" },
  { id: "summer", label: "夏日", icon: "summer" },
  { id: "night", label: "夏夜", icon: "night" },
  { id: "desert", label: "沙漠", icon: "desert" },
  { id: "morning", label: "晨间", icon: "morning" },
  { id: "clock", label: "时钟", icon: "clock" },
  { id: "knock", label: "木鱼", icon: "knock" },
  { id: "cafe", label: "咖啡馆", icon: "cafe" },
  { id: "musicbox", label: "卡农", icon: "musicbox" },
  { id: "traffic", label: "车流", icon: "traffic" },
  { id: "pink", label: "粉噪", icon: "pink" },
];

function formatRecord(seconds: number): string {
  return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
}

function localDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export function App() {
  const aq = useAquarium();
  const { snapshot: s, timer: t } = aq;
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => { aq.onOpenSettings(() => setSettingsOpen(true)); }, [aq]);
  const [endOpen, setEndOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  // Live slider preview: follows the drag without firing RPC; committed on release.
  const [volumePreview, setVolumePreview] = useState<number | null>(null);

  if (!s || !t) {
    return (
      <div className="app-shell">
        <main>
          <span className="online-state"><i /><span>正在连接</span></span>
        </main>
      </div>
    );
  }

  const prefs = s.preferences;
  const review = reviewModel(s);
  const noticeVisible = !!s.notice;
  const volumePct = volumePreview ?? Math.round(prefs.volume * 100);
  const timerActive = s.session.status === "running" || s.session.status === "paused";

  return (
    <div className="app-shell">
      <header className="titlebar">
        <div className="brand"><img className="brand-icon" src="./mark.png" alt="" aria-hidden="true" /><span>小海底 <small>专注，让一片海慢慢长大</small></span></div>
        <div className="window-actions">
          <button id="compact" className="icon-button" title="切换桌面挂件" aria-label="切换桌面挂件" onClick={() => aq.setCompact(!document.body.classList.contains("compact"))}><Icon name="compact" /></button>
          {desktop
            ? <button id="hide" className="icon-button" title="关闭窗口（应用仍在后台运行）" aria-label="关闭窗口" onClick={aq.hide}><Icon name="close" /></button>
            : <button id="hide" className="icon-button" title="桌面端可用" aria-label="关闭窗口" disabled><Icon name="close" /></button>}
        </div>
      </header>

      <main>
        <div className="intro">
          <div><p className="eyebrow">属于你的安静角落</p><h1>你在专注，<span>海底在生长。</span></h1></div>
          <span className="online-state"><i /><span id="connection">{aq.healthy ? "安静陪伴中" : "连接中断 · 已静音"}</span></span>
        </div>

        <div className="main-grid">
          <section className="reef-panel" aria-label="你的水族馆">
            <div className="reef-top"><span className="reef-name">第一片小海底</span><span className="reef-level">{t.growthLabel}</span></div>
            <div id="reef" className="reef-stage">
              <ReefCanvas reefRef={aq.reefRef} />
              <div className="light-ray ray-one" /><div className="light-ray ray-two" />
              <div id="reef-caption" className="reef-caption"><span className="small-dot" /><span>{t.caption}</span></div>
            </div>
            <div className="reef-bottom">
              <div><span className="tiny-label">下一次成长</span><p>{t.nextGrowth}</p></div>
              <button id="feed" className="subtle-button" disabled={t.feedDisabled || aq.busy || !aq.healthy} onClick={aq.feed}>{t.feedLabel}</button>
            </div>
          </section>

          <section className="timer-panel" aria-label="专注计时">
            <Tabs.Root value={aq.selectedKind} onValueChange={(v) => aq.setSelectedKind(v as "focus" | "break")}>
              <Tabs.List className="mode-tabs" aria-label="计时模式">
                <Tabs.Trigger id="focus-tab" value="focus" className="mode-tab" disabled={timerActive || aq.busy}>专注</Tabs.Trigger>
                <Tabs.Trigger id="break-tab" value="break" className="mode-tab" disabled={timerActive || aq.busy}>休息</Tabs.Trigger>
              </Tabs.List>
            </Tabs.Root>
            <div className="timer-ring">
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle className="ring-track" cx="100" cy="100" r="89" />
                <circle id="ring-progress" cx="100" cy="100" r="89" style={{ strokeDashoffset: t.ringOffset, stroke: t.ringPaused ? "var(--timer-pause)" : "var(--timer-active)" }} />
              </svg>
              <div className="timer-face"><span id="timer" role="timer" aria-label="剩余时间">{t.time}</span><span id="timer-status">{t.statusText}</span></div>
            </div>
            <label className="task-label" htmlFor="task">这一轮，想做什么？<span>可选</span></label>
            <input id="task" type="text" maxLength={80} placeholder={t.taskPlaceholder} autoComplete="off" disabled={t.taskDisabled || aq.busy} />
            <div className="timer-actions">
              <button id="primary" className="primary-button" disabled={aq.busy || !aq.healthy} onClick={aq.primary}>
                <span id="primary-icon" aria-hidden="true"><Icon name={t.primaryIcon} /></span><span id="primary-label">{t.primaryLabel}</span>
              </button>
              <button id="end" className="subtle-button" hidden={t.endHidden} disabled={aq.busy} onClick={() => setEndOpen(true)}>结束本轮</button>
            </div>
            <p id="timer-footnote" className="timer-footnote">{t.footnote}</p>
          </section>
        </div>

        <section className="sound-panel" aria-label="背景音">
          <div className="sound-heading"><span className="sound-icon" aria-hidden="true"><Icon name="waves" size={26} /></span><div><h2>海底的声音</h2><p id="sound-status">{aq.soundStatus}</p></div></div>
          <div className="sound-options" role="group" aria-label="选择背景音">
            {SOUND_OPTIONS.map((opt) => (
              <button key={opt.id} data-sound={opt.id} className={prefs.sound === opt.id ? "sound-choice selected" : "sound-choice"} aria-pressed={prefs.sound === opt.id} disabled={aq.busy} onClick={() => aq.pickSound(opt.id)}>
                <span aria-hidden="true"><Icon name={opt.icon} size={15} /></span>{opt.label}
              </button>
            ))}
          </div>
          <div className="volume-control">
            <label htmlFor="volume" id="volume-label">音量</label>
            <Slider.Root className="volume-slider" value={[volumePct]} min={0} max={100} step={1}
              onValueChange={(v) => setVolumePreview(v[0])}
              onValueCommit={(v) => { setVolumePreview(null); aq.setVolume(v[0]); }} aria-label="音量">
              <Slider.Track className="volume-track"><Slider.Range className="volume-range" /></Slider.Track>
              <Slider.Thumb id="volume" className="volume-thumb" />
            </Slider.Root>
            <span>{volumePct}%</span>
          </div>
          <button id="sound-toggle" className="sound-toggle" aria-pressed={aq.soundPlaying} disabled={aq.busy || !aq.healthy} onClick={aq.toggleSound}>{aq.soundPlaying ? "关闭声音" : "开启声音"}</button>
        </section>

        {noticeVisible && <div id="notice" className="notice" role="status" aria-live="polite">{s.notice}</div>}

        <div className="bottom-grid">
          <section className="stats-panel" aria-label="专注积累">
            <h2>今天的小积累</h2>
            <div className="stats">
              <div><strong id="today-minutes">{Math.floor(s.todaySecs / 60)}<span> 分钟</span></strong><p>认真投入的时间</p></div>
              <div><strong id="today-rounds">{s.todayRounds}<span> 轮</span></strong><p>海底的成长</p></div>
              <div><strong id="visitor-count">{s.visitors.length}<span> 位</span></strong><p>认识的新朋友</p></div>
            </div>
            <p id="total-time" className="stats-foot">{s.totalSecs ? `已经一起度过 ${Math.floor(s.totalSecs / 60)} 分钟，完成 ${s.completed} 轮专注。` : "你的海底，正在等待第一个故事。"}</p>
          </section>

          <section className="visitors-panel" aria-label="访客图鉴">
            <div className="section-heading"><h2>来过的朋友</h2><span>偶遇，也值得记住</span></div>
            <div id="visitors" className="visitors">
              {s.visitors.length === 0
                ? <div className="visitor-empty"><span aria-hidden="true">🐠</span><p>第一轮专注后，会有一位朋友来拜访。</p></div>
                : s.visitors.map((v, i) => (
                    <div className="visitor" key={`${v.species}-${i}`}>
                      <VisitorPortrait species={v.species} />
                      <div><p>{v.name}</p><small>{localDate(v.date)} · 来过 {v.visits} 次</small></div>
                    </div>
                  ))}
            </div>
          </section>
        </div>

        <Collapsible.Root className="review" open={reviewOpen} onOpenChange={setReviewOpen}>
          <Collapsible.Trigger className="review-trigger">这段时间</Collapsible.Trigger>
          <Collapsible.Content id="review-body" className="collapsible-panel">
            {review.empty
              ? <p id="review-empty" className="empty-text">完成第一轮，这里开始有故事。</p>
              : (
                <div id="review-rows">
                  {([
                    ["review-week-line", review.weekLine, false], ["review-week-days", review.weekDaysLine, true],
                    ["review-month-line", review.monthLine, false], ["review-together", review.togetherLine, false],
                    ["review-total-days", review.totalDaysLine, true], ["review-book-line", review.bookLine, false],
                    ["review-book-note", review.bookNote, true], ["review-last-visitor", review.lastVisitorLine, true],
                    ["review-growth-line", review.growthLine, false], ["review-next", review.nextGrowthLine, true],
                    ["review-plants", review.plantsLine, true],
                  ] as [string, string | undefined, boolean][]).map(([id, text, secondary]) => text ? <p key={id} id={id} className={secondary ? "review-line secondary" : "review-line"}>{text}</p> : null)}
                </div>
              )}
            <p id="review-footnote" className="review-footnote">{review.footnote}</p>
          </Collapsible.Content>
        </Collapsible.Root>

        <Collapsible.Root className="journal" open={journalOpen} onOpenChange={setJournalOpen}>
          <Collapsible.Trigger className="review-trigger">专注日记 <span id="record-count">{s.records.length} 条记录</span></Collapsible.Trigger>
          <Collapsible.Content id="records" className="records collapsible-panel">
            {s.records.length === 0
              ? <p className="empty-text">开始一轮专注，给今天留下一点痕迹。</p>
              : s.records.slice(0, 30).map((r, i) => (
                  <div className="record" key={i}>
                    <p>{r.task || "一段安静的专注"}</p>
                    <span>{r.completed ? "完成" : "已记录"} · {formatRecord(r.seconds)} · {localDate(r.date)}</span>
                  </div>
                ))}
          </Collapsible.Content>
        </Collapsible.Root>

        <footer>
          <span>让专注留下一片海，也记得抬头看看窗外。</span>
          <button id="settings-open" className="text-button" onClick={() => setSettingsOpen(true)}>计时设置</button>
        </footer>
      </main>

      <div className="compact-controls">
        <span id="compact-time">{t.time}</span>
        <button id="compact-primary" aria-label={t.primaryLabel} disabled={aq.busy || !aq.healthy} onClick={aq.primary}><Icon name={t.primaryIcon} /></button>
        <button id="compact-sound" aria-label={aq.soundPlaying ? "关闭声音" : "开启声音"} style={{ opacity: aq.soundPlaying ? 1 : 0.5 }} aria-pressed={aq.soundPlaying} onClick={aq.toggleSound}><Icon name={aq.soundPlaying ? "volume" : "muted"} /></button>
        <button id="expand" aria-label="展开水族馆" onClick={() => aq.setCompact(false)}><Icon name="expand" /></button>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} aq={aq} />
      <EndDialog open={endOpen} onClose={() => setEndOpen(false)} onConfirm={() => { setEndOpen(false); aq.endSession(); }} />

      <ToastHost message={aq.toastMessage} />
    </div>
  );
}
