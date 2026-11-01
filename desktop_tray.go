package main

import (
	"log"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/egoist/mygo"
)

// Build the native menu once. Left-click on the tray opens the mini popover;
// right-click (or control-click) opens this slim menu. The 10-theme picker
// lives in the main window's Settings, not here.
func (d *Desktop) createTray() {
	items := append(d.timerMenuItems(), mygo.Separator())
	items = append(items, []*mygo.MenuItem{
		{Label: "显示水族馆", Click: func(*mygo.MenuItem, *mygo.Window) { d.openAquarium() }},
		{Label: "设置…", Click: func(*mygo.MenuItem, *mygo.Window) { d.OpenSettings() }},
		d.compactMenuItem(""),
		mygo.Separator(),
		{Label: "检查更新…", Click: func(*mygo.MenuItem, *mygo.Window) { d.CheckForUpdates() }},
		{Label: "问题反馈…", Click: func(*mygo.MenuItem, *mygo.Window) {
			go func() {
				if err := mygo.Shell.OpenExternal(feedbackURL); err != nil {
					log.Print("反馈页面未打开：", err)
				}
			}()
		}},
		mygo.Separator(),
		{Label: "退出并保存", Role: mygo.RoleQuit},
	}...)
	d.menu = mygo.NewMenu(items)
	tray, err := mygo.NewTray(mygo.TrayOptions{
		Icon: trayIcon(), IconIsTemplate: runtime.GOOS == "darwin",
		ToolTip: "小海底 · 专注养出一片海",
		// No Menu here: left-click goes to OnClick (mini popover).
		// Right-click opens the menu via OnRightClick → PopUpMenu.
	})
	if err != nil {
		log.Print("托盘不可用，将保留普通窗口：", err)
		return
	}
	d.tray = tray
	tray.OnClick(d.toggleFlyout)
	tray.OnRightClick(func() {
		d.refreshNativeMenus()
		if d.flyout != nil && !d.flyout.IsDestroyed() {
			d.flyout.Close()
		}
		// Official pattern: temporarily attach the menu, pop it, then detach
		// so left-click stays on OnClick (popover).
		tray.SetMenu(d.menu)
		tray.PopUpMenu()
		tray.SetMenu(nil)
	})
	d.stopSwim = d.startTraySwim()
}

// toggleCompactFromTray flips compact mode without a caller window context.
func (d *Desktop) toggleCompactFromTray() {
	d.requestCompact(!d.compact.Load())
}

// Frames use Window.Update, MyGo's asynchronous UI dispatcher. Stop never
// waits for queued UI work, and every queued frame checks quit before touching
// the native tray, so shutdown can safely wait for the aquarium's clock.
func (d *Desktop) startTraySwim() func() {
	template := runtime.GOOS == "darwin"
	var reduceMotion atomic.Bool
	updateMotion := func() { reduceMotion.Store(mygo.Theme.Preferences().ReduceMotion) }
	updateMotion()
	offMotion := mygo.Theme.OnUpdated(updateMotion)
	stop := make(chan struct{})
	go func() {
		frames := trayFrames()
		ticker := time.NewTicker(90 * time.Millisecond)
		defer ticker.Stop()
		frame, swimming := 0, false
		for {
			select {
			case <-stop:
				return
			case <-ticker.C:
				if d.quitting.Load() {
					return
				}
				session := d.a.Get().Session
				running := !reduceMotion.Load() && session.Status == "running" && session.Kind == "focus"
				if !running && !swimming {
					continue
				}
				if running {
					frame = (frame + 1) % len(frames)
				} else {
					frame = 0
				}
				png := frames[frame]
				d.win.Update(func() {
					if d.quitting.Load() || d.win.IsDestroyed() {
						return
					}
					if mygo.Theme.Preferences().ReduceMotion {
						png = frames[0]
					}
					_ = d.tray.SetIcon(png, template)
				})
				swimming = running
			}
		}
	}()
	var once sync.Once
	return func() { once.Do(func() { offMotion(); close(stop) }) }
}
