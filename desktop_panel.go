package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"sync"
	"time"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
)

// Mini native panel anchored to the tray icon.

// --- request tracker ---

type requestState struct {
	mu      sync.Mutex
	current string // requestId of in-flight command, "" if idle
	err     string
	timer   *time.Timer
	onTimeout func() // called when the timer fires (e.g. clear draft + redraw)
}

func (r *requestState) begin(id string, timeout time.Duration) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.current != "" {
		return false
	}
	if r.timer != nil {
		r.timer.Stop()
	}
	r.current = id
	r.err = ""
	r.timer = time.AfterFunc(timeout, func() {
		r.mu.Lock()
		if r.current == id {
			r.current = ""
			r.err = "操作超时"
			cb := r.onTimeout
			r.mu.Unlock()
			if cb != nil {
				cb()
			}
			return
		}
		r.mu.Unlock()
	})
	return true
}

// done marks the request complete, but only if it matches the current id
// (stale ACKs from old requests must not clear new pending state).
func (r *requestState) done(id string, ok bool, errMsg string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.current != id {
		return
	}
	if r.timer != nil {
		r.timer.Stop()
	}
	r.current = ""
	if !ok {
		r.err = errMsg
	} else {
		r.err = ""
	}
}

func (r *requestState) isPending() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.current != ""
}
func (r *requestState) isCurrent(id string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.current == id
}
func (r *requestState) lastErr() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.err
}

// --- volume draft (survives 1s Snapshot pushes while dragging) ---

type volumeDraft struct {
	mu     sync.Mutex
	val    float64
	active bool
}

// --- panel ---

func (d *Desktop) toggleFlyout() {
	mygo.RunOnMain(func() {
		if d.quitting.Load() {
			return
		}
		if d.flyout != nil && !d.flyout.IsDestroyed() {
			d.flyout.Close()
			d.flyout = nil
			return
		}
		f := mygo.NewFlyout(mygo.FlyoutOptions{
			Tray:      d.tray,
			Placement: mygo.PlacementBottom,
			Focusable: true,
			Popover:   true,
			Width:     280,
			Height:    400,
			Content:   ui.View(d.panelView),
		})
		d.flyout = f
		f.OnClose(func(*mygo.CloseEvent) {
			// OnClose fires on outside-press/ESC/programmatic Close; clear
			// the field before anything else so subsequent toggles don't
			// race against a still-visible window.
			if d.flyout == f {
				d.flyout = nil
			}
			d.confirmEnd = false
		})
	})
}

func (d *Desktop) invalidateFlyout() {
	if d.flyout == nil {
		return
	}
	mygo.RunOnMain(func() {
		if d.flyout != nil && !d.flyout.IsDestroyed() {
			d.flyout.Invalidate()
		}
	})
}

// themeCache holds the parsed ui.Theme so we don't re-read theme.json on
// every paint; invalidated when the theme ID changes.
type themeCache struct {
	mu       sync.Mutex
	themeID  string
	uiTheme  *ui.Theme
}

func (c *themeCache) get(themeID string, read func() (*ui.Theme, error)) *ui.Theme {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.themeID == themeID && c.uiTheme != nil {
		return c.uiTheme
	}
	t, err := read()
	if err != nil || t == nil {
		return nil
	}
	c.themeID = themeID
	c.uiTheme = t
	return t
}

func (d *Desktop) panelView(c *ui.Context) {
	snap := d.a.Get()
	aud := d.audio.get()

	// Theme: cached mapping from current theme.json.
	if t := d.theme.get(snap.Theme, d.parseTheme); t != nil {
		c.SetTheme(t)
	}

	// Task line (truncate by rune, not byte, to avoid splitting UTF-8).
	task := snap.Session.Task
	if task == "" {
		task = map[bool]string{true: "专注", false: "休息"}[snap.Session.Kind == "focus"]
	}
	if rs := []rune(task); len(rs) > 24 {
		task = string(rs[:24]) + "…"
	}
	ui.Text(c, task).Label("当前任务").FontSize(12).Opacity(0.7)

	// Big countdown.
	remaining := time.Duration(snap.Session.DurationMS-snap.Session.ElapsedMS) * time.Millisecond
	if remaining < 0 {
		remaining = 0
	}
	if snap.Session.Status == "idle" {
		// Show configured focus duration as a preview, not 00:00.
		remaining = time.Duration(snap.Preferences.FocusMinutes) * time.Minute
	}
	mm, ss := int(remaining.Minutes()), int(remaining.Seconds())%60
	ui.Text(c, fmt.Sprintf("%02d:%02d", mm, ss)).Label("剩余时间").FontSize(40).Bold()

	// Status line.
	status := d.statusLine(snap)
	ui.Text(c, status).Label("状态").FontSize(12).Opacity(0.7)

	// Primary action row.
	busy := d.req.isPending()
	ui.Row(c).Gap(8).Children(func() {
		switch snap.Session.Status {
		case "running":
			if ui.Button(c, "暂停").Label("暂停").Clicked() {
				if id, ok := d.beginRequest(); ok {
					go func() {
						_, err := d.a.Pause()
						d.endRequest(id, err)
					}()
				}
			}
		case "paused":
			if ui.PrimaryButton(c, "继续").Label("继续").Clicked() {
				if id, ok := d.beginRequest(); ok {
					go func() {
						_, err := d.a.Resume()
						d.endRequest(id, err)
					}()
				}
			}
		default:
			if ui.PrimaryButton(c, "开始专注").Label("开始专注").Clicked() {
				if id, ok := d.beginRequest(); ok {
					go func() {
						_, err := d.a.Start("focus", "")
						d.endRequest(id, err)
					}()
				}
			}
			if ui.Button(c, "休息").Label("开始休息").Clicked() {
				if id, ok := d.beginRequest(); ok {
					go func() {
						_, err := d.a.Start("break", "")
						d.endRequest(id, err)
					}()
				}
			}
		}

		// Sound toggle.
		icon := "🔇"
		if aud.Running && aud.Requested {
			icon = "🔊"
		} else if aud.NeedGesture {
			icon = "🔓"
		}
		if ui.Button(c, icon).Label("切换声音").Clicked() && !busy {
			d.requestAudio("toggle", 0)
		}
	})

	// Volume slider: use draft while dragging.
	d.vol.mu.Lock()
	vol := snap.Preferences.Volume
	if d.vol.active {
		vol = d.vol.val
	}
	d.vol.mu.Unlock()
	if ui.Slider(c, &vol, 0, 1).Label("音量").Changed() {
		d.vol.mu.Lock()
		d.vol.val = vol
		d.vol.active = true
		d.vol.mu.Unlock()
		d.requestAudio("set-volume", vol)
	}

	// Quick links.
	ui.Row(c).Gap(6).Children(func() {
		if ui.Button(c, "主窗").Label("打开主窗").Clicked() {
			d.show()
		}
		if ui.Button(c, "挂件").Label("切换挂件模式").Clicked() && !busy {
			d.requestCompact(true)
		}
		if ui.Button(c, "设置").Label("打开设置").Clicked() && !busy {
			d.requestOpenSettings()
		}
	})

	// Error / need-gesture.
	if e := d.req.lastErr(); e != "" {
		ui.Text(c, e).Label("错误").FontSize(11).Opacity(0.7)
	} else if aud.NeedGesture {
		ui.Text(c, "打开主窗解锁音频").FontSize(11).Opacity(0.6)
	}

	// End session with confirmation (persisted on Desktop, not local).
	if snap.Session.Status == "running" || snap.Session.Status == "paused" {
		if ui.Button(c, "结束").Label("结束本次计时").Clicked() {
			d.confirmEnd = true
		}
	}
	if d.confirmEnd {
		switch ui.AlertDialog(c, &d.confirmEnd, "结束本次计时？", "未完成的专注会被记为中断。", "取消", "结束") {
		case 1:
			if id, ok := d.beginRequest(); ok {
				go func() {
					_, err := d.a.End()
					d.endRequest(id, err)
				}()
			}
		}
	}
}

// statusLine derives a human-readable status from the snapshot.
func (d *Desktop) statusLine(snap Snapshot) string {
	switch snap.Session.Status {
	case "running":
		if snap.Session.Kind == "focus" {
			return "专注进行中"
		}
		return "休息进行中"
	case "paused":
		return "已暂停"
	case "complete":
		if snap.Session.Kind == "focus" {
			return "专注完成，建议休息"
		}
		return "休息结束，开始下一轮"
	default: // idle
		if snap.Notice != "" {
			return snap.Notice
		}
		if snap.TodayRounds > 0 {
			return "已完成今日 " + fmt.Sprintf("%d", snap.TodayRounds) + " 轮"
		}
		return "空闲"
	}
}

// parseTheme reads theme.json and builds a *ui.Theme. We start from
// LightTheme/DarkTheme based on meta.supportsDarkAppearance, then override
// the 8 tokens the panel uses.
func (d *Desktop) parseTheme() (*ui.Theme, error) {
	snap := d.a.Get()
	return parseThemeJSON(snap.Theme)
}

// parseThemeJSON is the pure function extracted for testing.
func parseThemeJSON(themeID string) (*ui.Theme, error) {
	if themeID == "" {
		return nil, nil
	}
	data, err := fs.ReadFile(frontend, "web/public/themes/"+themeID+"/theme.json")
	if err != nil {
		return nil, err
	}
	var t struct {
		Meta struct {
			SupportsDarkAppearance bool `json:"supportsDarkAppearance"`
		} `json:"meta"`
		Tokens struct {
			Background string `json:"bgBase"`
			Surface    string `json:"panelRaised"`
			Border     string `json:"controlBorder"`
			Text       string `json:"textPrimary"`
			TextMuted  string `json:"textFaint"`
			Accent     string `json:"accent"`
			AccentText string `json:"accentInk"`
			Focus      string `json:"activeBorder"`
		} `json:"tokens"`
	}
	if err := json.Unmarshal(data, &t); err != nil {
		return nil, err
	}
	var th ui.Theme
	if t.Meta.SupportsDarkAppearance {
		th = *ui.DarkTheme()
	} else {
		th = *ui.LightTheme()
	}
	th.Background = ui.Hex(t.Tokens.Background)
	th.Surface = ui.Hex(t.Tokens.Surface)
	th.Border = ui.Hex(t.Tokens.Border)
	th.Text = ui.Hex(t.Tokens.Text)
	th.TextMuted = ui.Hex(t.Tokens.TextMuted)
	th.Accent = ui.Hex(t.Tokens.Accent)
	th.AccentText = ui.Hex(t.Tokens.AccentText)
	th.Focus = ui.Hex(t.Tokens.Focus)
	return &th, nil
}

// beginRequest allocates a fresh request id and marks it in-flight.
// Returns ("", false) if another request is already pending.
// Go-internal actions (Pause/Resume/Start/End) are fast, 3s is enough.
func (d *Desktop) beginRequest() (string, bool) {
	id := fmt.Sprintf("go-%d", time.Now().UnixNano())
	if !d.req.begin(id, 3*time.Second) {
		return "", false
	}
	return id, true
}

func (d *Desktop) endRequest(id string, err error) {
	ok := err == nil
	msg := ""
	if err != nil {
		msg = err.Error()
	}
	d.req.done(id, ok, msg)
	if d.flyout != nil {
		d.invalidateFlyout()
	}
}

// --- command senders ---

func (d *Desktop) broadcaster() broadcaster {
	if d.bc != nil {
		return d.bc
	}
	return mygoBroadcaster{}
}

func (d *Desktop) requestAudio(command string, volume float64) {
	id := fmt.Sprintf("audio-%d", time.Now().UnixNano())
	// Wire timeout callback once: clear draft + redraw on timeout.
	d.req.onTimeout = func() {
		d.vol.mu.Lock()
		d.vol.active = false
		d.vol.mu.Unlock()
		d.invalidateFlyout()
	}
	if !d.req.begin(id, 12*time.Second) { // frontend uses 10s settle; buffer 2s
		if command == "set-volume" {
			d.vol.mu.Lock()
			d.vol.val = volume
			d.vol.active = true
			d.vol.mu.Unlock()
		}
		return
	}
	ev := AudioRequestEvent{RequestID: id, Command: command}
	if command == "set-volume" {
		v := volume
		ev.Volume = &v
	}
	d.broadcaster().broadcastAudio(ev)
}

func (d *Desktop) requestCompact(compact bool) {
	id := fmt.Sprintf("ui-%d", time.Now().UnixNano())
	if !d.req.begin(id, 3*time.Second) {
		return
	}
	ev := UIRequestEvent{RequestID: id, Command: "set-compact", Compact: &compact}
	d.broadcaster().broadcastUI(ev)
	mygo.RunOnMain(func() {
		if d.win != nil && !d.win.IsDestroyed() {
			d.applyCompactOn(d.win, compact)
		}
	})
}

func (d *Desktop) requestOpenSettings() {
	id := fmt.Sprintf("ui-%d", time.Now().UnixNano())
	if !d.req.begin(id, 3*time.Second) {
		return
	}
	ev := UIRequestEvent{RequestID: id, Command: "open-settings"}
	_ = UIRequested.Broadcast(ev)
	d.show()
}

// broadcaster abstracts event broadcast so tests can capture events.
type broadcaster interface {
	broadcastAudio(AudioRequestEvent)
	broadcastUI(UIRequestEvent)
}

// mygoBroadcaster is the default production broadcaster.
type mygoBroadcaster struct{}

func (mygoBroadcaster) broadcastAudio(ev AudioRequestEvent) { _ = AudioRequested.Broadcast(ev) }
func (mygoBroadcaster) broadcastUI(ev UIRequestEvent)       { _ = UIRequested.Broadcast(ev) }

// ReportAudioState: frontend reports actual WebAudio playback state.
// running means context.running && requested && started (not context.state alone).
// Rules:
//   - empty requestID: push observed state only, do NOT touch pending.
//   - non-empty: only the current matching pending ACK mutates req/flush.
//   - on success: coalesce latest draft if it differs from reported volume.
//   - on error/needGesture: surface error, clear draft, NO flush/retry.
//   - stale ACK (requestID mismatch): ignored, no state overwrite.
func (d *Desktop) ReportAudioState(ctx context.Context, requestID string, st AudioState) {
	if requestID == "" {
		// Observed push: update actual ephemeral state only.
		d.audio.set(st)
		d.invalidateFlyout()
		return
	}
	// Only accept if this ACK matches the current pending request.
	if !d.req.isCurrent(requestID) {
		return
	}
	d.audio.set(st)
	d.req.done(requestID, st.Error == "" && !st.NeedGesture, st.Error)

	// On failure: clear draft, show error, do NOT flush.
	if st.Error != "" || st.NeedGesture {
		d.vol.mu.Lock()
		d.vol.active = false
		d.vol.mu.Unlock()
		d.invalidateFlyout()
		return
	}
	// On success: flush coalesced draft if user kept dragging.
	d.vol.mu.Lock()
	needFlush := d.vol.active
	latest := d.vol.val
	d.vol.mu.Unlock()
	if needFlush && st.Volume != latest {
		d.requestAudio("set-volume", latest)
	} else if needFlush {
		d.vol.mu.Lock()
		d.vol.active = false
		d.vol.mu.Unlock()
	}
	d.invalidateFlyout()
}

// AckUIRequest: frontend ACKs a desktop:ui-request.
func (d *Desktop) AckUIRequest(ctx context.Context, requestID string, ok bool, errMsg string) {
	d.req.done(requestID, ok, errMsg)
	d.invalidateFlyout()
}
