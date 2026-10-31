// Desktop owns the native host. The timer and archive remain in Aquarium;
// the web page reaches only the exported methods bound by main.
package main

import (
	"context"
	"errors"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"sync/atomic"
	"time"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/plugins/updater"
)
const feedbackURL = "https://github.com/echoVic/little-reef/issues/new"

type Desktop struct {
	a        *Aquarium
	win      *mygo.Window
	tray     *mygo.Tray
	quitting atomic.Bool
	stopSwim func()
	menu     *mygo.Menu
	themeIDs []string

	// Mini native panel anchored to the tray icon.
	flyout *mygo.Window
	// Ephemeral audio state reported by the frontend's WebAudio bridge.
	audio atomicAudioState
	// In-flight command tracking + volume drag draft + theme cache.
	req       requestState
	vol       volumeDraft
	theme     themeCache
	confirmEnd bool
	bc        broadcaster
}

// AudioState is what the frontend reports after handling a desktop:audio-request.
type AudioState struct {
	Running     bool    `json:"running"`
	Requested   bool    `json:"requested"`
	Sound       string  `json:"sound"`
	Volume      float64 `json:"volume"`
	NeedGesture bool    `json:"needGesture"`
	Error       string  `json:"error"`
}

type atomicAudioState struct{ v atomic.Value }

func (s *atomicAudioState) get() AudioState {
	v := s.v.Load()
	if v == nil {
		return AudioState{}
	}
	return v.(AudioState)
}
func (s *atomicAudioState) set(st AudioState) { s.v.Store(st) }

// AudioRequestEvent is broadcast to the page when the native panel asks it to
// toggle actual WebAudio playback (Go cannot call JS directly).
type AudioRequestEvent struct {
	RequestID string   `json:"requestId"`
	Command   string   `json:"command"` // "toggle" | "enable" | "disable" | "set-volume"
	Volume    *float64 `json:"volume,omitempty"`
}

var AudioRequested = mygo.NewEvent[AudioRequestEvent]("desktop:audio-request")

// UIRequestEvent is broadcast to the page when the native panel asks it to
// perform a UI action it owns (open settings, apply compact CSS).
type UIRequestEvent struct {
	RequestID string  `json:"requestId"`
	Command   string  `json:"command"` // "set-compact" | "open-settings"
	Compact   *bool   `json:"compact,omitempty"`
}

var UIRequested = mygo.NewEvent[UIRequestEvent]("desktop:ui-request")

// ExportArchive asks the calling window where to save the backup, then writes it.
// An empty path means the user canceled; callers must stay silent then.
func (d *Desktop) ExportArchive(ctx context.Context) (string, error) {
	text, err := d.a.ExportArchive()
	if err != nil {
		return "", err
	}
	home, _ := os.UserHomeDir()
	path, err := mygo.Dialog.Save(mygo.SaveDialogOptions{
		Parent:      mygo.CallerWindow(ctx),
		Title:       "导出存档",
		ButtonLabel: "导出",
		DefaultPath: filepath.Join(home, "little-reef-archive.json"),
		Filters:     []mygo.FileFilter{{Name: "小海底存档", Extensions: []string{"json"}}},
	})
	if err != nil || path == "" {
		return "", err
	}
	if err := ctx.Err(); err != nil {
		return "", err
	}
	if err := os.WriteFile(path, []byte(text), 0o600); err != nil {
		return "", err
	}
	return path, nil
}

// ImportArchive asks the calling window which backup to restore, then validates it.
// A canceled pick means "已取消" and stays quiet; failed validation preserves the archive.
func (d *Desktop) ImportArchive(ctx context.Context) (Snapshot, error) {
	paths, err := mygo.Dialog.Open(mygo.OpenDialogOptions{
		Parent:      mygo.CallerWindow(ctx),
		Title:       "导入存档",
		ButtonLabel: "导入",
		Filters:     []mygo.FileFilter{{Name: "小海底存档", Extensions: []string{"json"}}},
	})
	if err != nil {
		return Snapshot{}, err
	}
	if len(paths) == 0 {
		return Snapshot{}, errors.New("已取消")
	}
	if err := ctx.Err(); err != nil {
		return Snapshot{}, err
	}
	data, err := os.ReadFile(paths[0])
	if err != nil {
		return Snapshot{}, err
	}
	if err := ctx.Err(); err != nil {
		return Snapshot{}, err
	}
	return d.a.ImportArchive(string(data))
}

// Hide keeps the page and sound alive. Restored via tray click, Dock icon
// click (OnActivate), or Cmd+Shift+A. No Minimize fallback: Hide is always
// reversible because the app keeps a Dock icon (regular activation policy).
func (d *Desktop) Hide(ctx context.Context) {
	mygo.RunOnMain(func() {
		if win := mygo.CallerWindow(ctx); win != nil && !d.quitting.Load() {
			win.Hide()
		}
	})
}

// Full window minimums; a restored bounds below either dimension means the
// previous run quit in compact mode (compact writes a 400x350 rect via
// StateKey, which mygo restores verbatim without clamping to MinWidth).
const (
	fullMinWidth  = 760
	fullMinHeight = 680
	fullWidth     = 1100
	fullHeight    = 800
)

// needsStartupFullReset reports whether a restored window rect (after
// mygo's StateKey restore) is too small to be a genuine full-size window,
// meaning the previous run quit while compact. Pure function, unit-tested.
func needsStartupFullReset(w, h int) bool {
	return w < fullMinWidth || h < fullMinHeight
}

// SetCompact turns the window into a small always-on-top desktop aquarium.
func (d *Desktop) SetCompact(ctx context.Context, compact bool) {
	mygo.RunOnMain(func() {
		if win := mygo.CallerWindow(ctx); win != nil && !d.quitting.Load() {
			d.applyCompactOn(win, compact)
		}
	})
}

// applyCompactOn applies the compact/full geometry to win. Extracted so the
// startup clamp can reuse the exact same placement sequence.
func (d *Desktop) applyCompactOn(win *mygo.Window, compact bool) {
	area := mygo.Screen.DisplayMatching(win.Bounds()).WorkArea
	win.SetAlwaysOnTop(compact)
	if compact {
		win.SetMinimumSize(360, 260)
		win.SetSize(400, 350)
		win.SetPosition(area.X+max(0, area.Width-420), area.Y+max(0, area.Height-370))
	} else {
		win.SetMinimumSize(fullMinWidth, fullMinHeight)
		win.SetSize(fullWidth, fullHeight)
		width, height := win.Size()
		win.SetPosition(area.X+max(0, (area.Width-width)/2), area.Y+max(0, (area.Height-height)/2))
	}
}

// CheckForUpdates opens the update window, which says when the app is up to
// date or offers the new version.
func (*Desktop) CheckForUpdates() { updater.CheckForUpdates() }

// Quit closes the desktop app and saves the current session.
func (*Desktop) Quit() { mygo.App.Quit() }

func (d *Desktop) show() {
	if d.win != nil && !d.win.IsDestroyed() && !d.quitting.Load() {
		d.win.Show()
		d.win.Focus()
	}
}

// changed may run on a bound-call or timer goroutine. Use the SDK's async
// window dispatcher: quit waits for the clock, never for synchronous UI work.
func (d *Desktop) changed(s Snapshot) {
	if d.quitting.Load() {
		return
	}
	if err := Changed.Broadcast(s); err != nil {
		log.Print("界面状态发送失败：", err)
	}
	d.win.Update(func() {
		if d.quitting.Load() || d.win.IsDestroyed() {
			return
		}
		// Read the newest snapshot here, not a stale queued theme selection.
		current := d.a.Get().Theme
		for _, id := range d.themeIDs {
			item := d.menu.ItemByID("theme:" + id)
			if item != nil && item.IsChecked() != (id == current) {
				item.SetChecked(id == current)
			}
		}
	})
	d.invalidateFlyout()
}

func (d *Desktop) completed(s Snapshot) {
	if d.quitting.Load() {
		return
	}
	go func() {
		n := mygo.NewNotification(mygo.NotificationOptions{
			Title:  "小海底 · " + map[bool]string{true: "专注完成", false: "休息结束"}[s.Session.Kind == "focus"],
			Body:   s.Notice,
			Sender: &mygo.NotificationSender{ID: "reef", Name: "小海底", Avatar: markPNG(128, markInk)},
		})
		n.OnClick(d.show)
		if err := n.Show(); err != nil && !errors.Is(err, mygo.ErrNotificationsDenied) {
			log.Print("系统通知未显示：", err)
		}
	}()
}

// handleWindowClose is the pure decision logic for the window close event.
// Returns (allow, interceptHide). When quitting is true the close proceeds
// (real quit); otherwise it is intercepted as a hide, recoverable via tray,
// Dock, or global shortcut regardless of tray presence.
func handleWindowClose(quitting bool) (allow bool, interceptHide bool) {
	if quitting {
		return true, false
	}
	return false, true
}

func (d *Desktop) run(web fs.FS) error {
	if !mygo.WebViewAvailable() {
		return errors.New("系统 WebView 不可用，无法打开小海底；请安装对应平台的 WebView 运行时")
	}
	mygo.Use(updater.New(updater.Options{Interval: 4 * time.Hour}))
	mygo.SetFrontend(web)
	mygo.App.WhenReady(func() {
		d.win = mygo.NewWindow(mygo.WindowOptions{
			Title: "小海底 · 桌面水族馆", URL: "/", Width: 1100, Height: 800, MinWidth: 760, MinHeight: 680,
			Frameless: true, Transparent: true, BackgroundColor: "#0c1820", StateKey: "aquarium-main",
		})
		// mygo restores the StateKey rect verbatim without clamping to
		// MinWidth/MinHeight; if the previous run quit in compact (400x350),
		// snap back to the full geometry so the (full-default) frontend
		// doesn't render inside a too-small window. Genuine full-size rects
		// (>=760x680) are left untouched, preserving the user's placement.
		if w, h := d.win.Size(); needsStartupFullReset(w, h) {
			d.applyCompactOn(d.win, false)
		}
		d.win.SetMenu(mygo.NewMenu(nil))
		d.win.OnClose(func(e *mygo.CloseEvent) {
			allow, intercept := handleWindowClose(d.quitting.Load())
			if allow {
				return
			}
			if intercept {
				e.PreventDefault()
				d.win.Hide()
			}
		})
		mygo.App.OnActivate(func(bool) { d.show() })
		d.createTray()
		d.a.onChange = d.changed
		d.a.onDone = d.completed
		if err := mygo.GlobalShortcut.Register("CmdOrCtrl+Shift+A", d.show); err != nil {
			log.Print("全局快捷键不可用：", err)
		}
		go func() { _ = mygo.App.Dock.SetIcon(markBadgePNG(512)) }()
		mygo.Power.OnSuspend(func() { go func() { _, _ = d.a.Pause() }() })
		go d.a.run()
	})
	mygo.App.OnBeforeQuit(func(*mygo.QuitEvent) { d.quitting.Store(true) })
	mygo.App.OnWillQuit(func(*mygo.QuitEvent) {
		if d.stopSwim != nil {
			d.stopSwim()
		}
		if err := d.a.shutdown(); err != nil {
			log.Print("存档失败：", err)
		}
		if d.tray != nil {
			d.tray.Destroy()
		}
	})
	return mygo.App.Run()
}
