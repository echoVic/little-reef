package main

import (
	"context"
	"testing"
	"time"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
)

func TestMenuPrimaryFollowsSessionTransitions(t *testing.T) {
	for _, tc := range []struct {
		status, kind, label string
		command             timerCommand
	}{
		{"idle", "focus", "开始专注", timerStartFocus},
		{"running", "focus", "暂停专注", timerPause},
		{"running", "break", "暂停休息", timerPause},
		{"paused", "focus", "继续专注", timerResume},
		{"paused", "break", "继续休息", timerResume},
		{"complete", "focus", "开始休息", timerStartBreak},
		{"complete", "break", "开始专注", timerStartFocus},
	} {
		a := panelPrimary(Snapshot{Session: Session{Kind: tc.kind, Status: tc.status}})
		if a.Label != tc.label || a.Command != tc.command {
			t.Errorf("%s/%s: %+v", tc.kind, tc.status, a)
		}
	}
}

func TestQuickPanelTimerRemainsUsableWhileAudioIsPending(t *testing.T) {
	a, _ := testAquarium(t)
	d := &Desktop{a: a}
	d.req.begin("audio-pending", time.Hour)
	t.Cleanup(func() { d.req.done("audio-pending", true, "") })
	tt := ui.NewTester(d.panelView, 320, 460)
	if err := tt.Click("开始专注"); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(time.Second)
	for a.Get().Session.Status != "running" && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	if a.Get().Session.Status != "running" {
		t.Fatal("an audio request blocked the timer action")
	}
	if !d.req.isCurrent("audio-pending") {
		t.Fatal("timer action cleared the audio request")
	}
}

func TestQuickPanelCompletedFocusOffersBreak(t *testing.T) {
	a, _ := testAquarium(t)
	a.state.Session.Status = "complete"
	d := &Desktop{a: a}
	tt := ui.NewTester(d.panelView, 320, 460)
	if err := tt.Click("开始休息"); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(time.Second)
	for a.Get().Session.Kind != "break" && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	if got := a.Get().Session; got.Kind != "break" || got.Status != "running" {
		t.Fatalf("next round: %+v", got)
	}
}

func TestQuickPanelShowsSoundStateAndPendingVolume(t *testing.T) {
	a, _ := testAquarium(t)
	d := &Desktop{a: a}
	tt := ui.NewTester(d.panelView, 320, 460)
	if !tt.HasText("开启声音") || !tt.HasText("35%") {
		t.Fatalf("initial audio state: %v", tt.Texts())
	}
	d.audio.set(AudioState{Requested: true, Running: true})
	d.vol.mu.Lock()
	d.vol.active, d.vol.val = true, .23
	d.vol.mu.Unlock()
	tt.Frame()
	if !tt.HasText("关闭声音") || !tt.HasText("23%") {
		t.Fatalf("live audio state: %v", tt.Texts())
	}
	d.audio.set(AudioState{NeedGesture: true})
	tt.Frame()
	if !tt.HasText("前往主窗口开启声音") {
		t.Fatalf("gesture fallback is missing: %v", tt.Texts())
	}
}

func TestQuickPanelNavigationFitsWithTaskAndError(t *testing.T) {
	a, _ := testAquarium(t)
	a.state.Session.Task = "正在读一本需要慢慢读完的技术书"
	d := &Desktop{a: a}
	d.timerReq.begin("failed", time.Second)
	d.timerReq.done("failed", false, "存档暂时无法写入，请检查目录权限。")
	tt := ui.NewTester(d.panelView, 320, 420)
	for _, label := range []string{"打开水族馆", "挂件模式", "设置…"} {
		r, ok := tt.Find(label)
		if !ok || r.Y < 0 || r.Y+r.H > 420 {
			t.Fatalf("navigation %s is clipped: %+v", label, r)
		}
	}
}

func TestCompactRequestsDoNotUseTheAudioRequestLock(t *testing.T) {
	d := &Desktop{bc: &fakeBroadcaster{}}
	d.req.begin("audio-pending", time.Hour)
	t.Cleanup(func() { d.req.done("audio-pending", true, "") })
	d.requestCompact(true)
	fb := d.bc.(*fakeBroadcaster)
	if len(fb.ui) != 1 || fb.ui[0].Compact == nil || !*fb.ui[0].Compact {
		t.Fatalf("compact layout was not broadcast while audio was busy: %+v", fb.ui)
	}
	d.AckUIRequest(context.Background(), fb.ui[0].RequestID, true, "")
	if d.uiReq.isPending() || !d.req.isCurrent("audio-pending") {
		t.Fatal("layout ACK affected the wrong pending request")
	}
}

func TestEndingConfirmedRoundCannotEndANewerSession(t *testing.T) {
	a, _ := testAquarium(t)
	first, err := a.Start("focus", "first")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = a.End(); err != nil {
		t.Fatal(err)
	}
	second, err := a.Start("focus", "second")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = a.endSession(first.Session.ID); err == nil {
		t.Fatal("stale confirmation ended a newer round")
	}
	if got := a.Get().Session; got.ID != second.Session.ID || got.Status != "running" {
		t.Fatalf("new round was changed: %+v", got)
	}
}

func TestRestoreFullBoundsPreservesPositionAndFitsCurrentDisplay(t *testing.T) {
	work := mygo.Rectangle{X: 100, Y: 50, Width: 1440, Height: 900}
	for _, tc := range []struct{ saved, want mygo.Rectangle }{
		{mygo.Rectangle{X: 200, Y: 100, Width: 1000, Height: 740}, mygo.Rectangle{X: 200, Y: 100, Width: 1000, Height: 740}},
		{mygo.Rectangle{X: 2000, Y: 1400, Width: 1000, Height: 740}, mygo.Rectangle{X: 540, Y: 210, Width: 1000, Height: 740}},
	} {
		if got := restoredFullBounds(tc.saved, work); got != tc.want {
			t.Errorf("restoredFullBounds(%+v)=%+v, want %+v", tc.saved, got, tc.want)
		}
	}
}
