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
	mu        sync.Mutex
	current   string // requestId of in-flight command, "" if idle
	err       string
	timer     *time.Timer
	onTimeout func() // called when the timer fires (e.g. clear draft + redraw)
}

func (r *requestState) setOnTimeout(fn func()) {
	r.mu.Lock()
	r.onTimeout = fn
	r.mu.Unlock()
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
		d.openFlyout()
	})
}

// openFlyout is called on the UI thread and never toggles an existing panel closed.
func (d *Desktop) openFlyout() {
	if d.quitting.Load() || d.tray == nil {
		return
	}
	if d.flyout != nil && !d.flyout.IsDestroyed() {
		d.flyout.Show()
		d.flyout.Focus()
		d.flyout.Invalidate()
		return
	}
	f := mygo.NewFlyout(mygo.FlyoutOptions{
		Tray:      d.tray,
		Placement: mygo.PlacementBottom,
		Focusable: true,
		Popover:   true,
		Width:     320,
		Height:    420,
		Content:   ui.View(d.panelView),
	})
	d.flyout = f
	f.SetTitle("小海底快捷面板")
	f.OnClose(func(*mygo.CloseEvent) {
		// OnClose fires on outside-press/ESC/programmatic Close; clear
		// the field before anything else so subsequent toggles don't
		// race against a still-visible window.
		if d.flyout == f {
			d.flyout = nil
			d.confirmEnd = false
			d.invalidateNativeMenus()
		}
	})
}

func (d *Desktop) invalidateFlyout() {
	if d.win == nil {
		return
	}
	d.win.Update(func() {
		if !d.quitting.Load() && d.flyout != nil && !d.flyout.IsDestroyed() {
			d.flyout.Invalidate()
		}
	})
}

// themeCache holds the parsed ui.Theme so we don't re-read theme.json on
// every paint; invalidated when the theme ID changes.
type themeCache struct {
	mu      sync.Mutex
	themeID string
	uiTheme *ui.Theme
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

// --- command senders ---

func (d *Desktop) broadcaster() broadcaster {
	if d.bc != nil {
		return d.bc
	}
	return mygoBroadcaster{}
}

func (d *Desktop) requestAudio(command string, volume float64) {
	id := fmt.Sprintf("audio-%d", time.Now().UnixNano())
	// Clear the slider preview if the frontend never acknowledges the request.
	d.req.setOnTimeout(func() {
		d.vol.mu.Lock()
		d.vol.active = false
		d.vol.mu.Unlock()
		d.invalidateFlyout()
	})
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
	d.uiReq.setOnTimeout(d.invalidateNativeMenus)
	if !d.uiReq.begin(id, 3*time.Second) {
		return
	}
	d.invalidateNativeMenus()
	apply := func() {
		if d.win != nil && !d.win.IsDestroyed() && !d.quitting.Load() {
			d.applyCompactOn(d.win, compact)
			d.show()
		}
		ev := UIRequestEvent{RequestID: id, Command: "set-compact", Compact: &compact}
		d.broadcaster().broadcastUI(ev)
	}
	if d.win != nil {
		d.win.Update(apply)
	} else {
		apply()
	}
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
	d.uiReq.done(requestID, ok, errMsg)
	d.invalidateNativeMenus()
}
