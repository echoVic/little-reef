package main

import "github.com/egoist/mygo"

func (d *Desktop) applicationMenu() []*mygo.MenuItem {
	return []*mygo.MenuItem{
		{Role: mygo.RoleAppMenu, Submenu: []*mygo.MenuItem{
			{Role: mygo.RoleAbout},
			mygo.Separator(),
			{ID: "settings", Label: "设置…", Accelerator: d.shortcut(shortcutSettings), Click: func(*mygo.MenuItem, *mygo.Window) { d.OpenSettings() }},
			{ID: "check-update", Label: "检查更新…", Click: func(*mygo.MenuItem, *mygo.Window) { d.CheckForUpdates() }},
			mygo.Separator(),
			{Role: mygo.RoleServices},
			mygo.Separator(),
			{Role: mygo.RoleHide},
			{Role: mygo.RoleHideOthers},
			{Role: mygo.RoleUnhide},
			mygo.Separator(),
			{Role: mygo.RoleQuit},
		}},
		{Role: mygo.RoleFileMenu},
		{Role: mygo.RoleEditMenu},
		{Label: "计时", Submenu: d.timerMenuItems()},
		{Role: mygo.RoleViewMenu},
		{Role: mygo.RoleWindowMenu, Submenu: []*mygo.MenuItem{
			{ID: shortcutShow, Label: "显示水族馆", Accelerator: d.shortcut(shortcutShow), Click: func(*mygo.MenuItem, *mygo.Window) { d.openAquarium() }},
			d.compactMenuItem(d.shortcut(shortcutCompact)),
			mygo.Separator(),
			{Role: mygo.RoleMinimize}, {Role: mygo.RoleZoom}, {Role: mygo.RoleClose},
			mygo.Separator(), {Role: mygo.RoleFront},
		}},
	}
}

func (d *Desktop) timerMenuItems() []*mygo.MenuItem {
	s := d.a.Get()
	primary, secondary := panelPrimary(s), panelSecondary(s)
	return []*mygo.MenuItem{
		{ID: "timer-primary", Label: primary.Label, Accelerator: d.shortcut(shortcutPrimary), Click: func(*mygo.MenuItem, *mygo.Window) { d.startTimerAction(panelPrimary(d.a.Get()).Command, 0) }},
		{ID: "timer-secondary", Label: secondary.Label, Hidden: secondary.Command == "", Click: func(*mygo.MenuItem, *mygo.Window) {
			if next := panelSecondary(d.a.Get()); next.Command != "" {
				d.startTimerAction(next.Command, 0)
			}
		}},
		{ID: "timer-end", Label: "结束本轮…", Accelerator: d.shortcut(shortcutEnd), Disabled: !sessionActive(s), Click: func(*mygo.MenuItem, *mygo.Window) { d.askEndRound() }},
	}
}

func (d *Desktop) compactMenuItem(accelerator string) *mygo.MenuItem {
	return &mygo.MenuItem{ID: "compact-mode", Label: "桌面挂件", Type: mygo.MenuItemCheckbox, Checked: d.compact.Load(), Accelerator: accelerator, Click: func(*mygo.MenuItem, *mygo.Window) { d.toggleCompactFromTray() }}
}

func (d *Desktop) refreshNativeMenus() {
	if d.a == nil {
		return
	}
	s := d.a.Get()
	primary, secondary := panelPrimary(s), panelSecondary(s)
	busy := d.timerReq.isPending()
	for _, menu := range []*mygo.Menu{d.appMenu, d.menu} {
		if menu == nil {
			continue
		}
		for _, state := range []struct {
			id, label        string
			enabled, visible bool
		}{
			{"timer-primary", primary.Label, !busy, true},
			{"timer-secondary", secondary.Label, !busy, secondary.Command != ""},
			{"timer-end", "结束本轮…", !busy && sessionActive(s) && !d.confirmEnd, true},
		} {
			if item := menu.ItemByID(state.id); item != nil {
				if item.Label != state.label {
					item.SetLabel(state.label)
				}
				if item.IsEnabled() != state.enabled {
					item.SetEnabled(state.enabled)
				}
				if item.IsVisible() != state.visible {
					item.SetVisible(state.visible)
				}
			}
		}
		if item := menu.ItemByID("compact-mode"); item != nil {
			if item.IsChecked() != d.compact.Load() {
				item.SetChecked(d.compact.Load())
			}
			if item.IsEnabled() != !d.uiReq.isPending() {
				item.SetEnabled(!d.uiReq.isPending())
			}
		}
	}
	if d.tray != nil {
		d.tray.SetToolTip("小海底 · " + d.statusLine(s) + " · " + panelTime(s))
	}
}

func (d *Desktop) invalidateNativeMenus() {
	if d.win == nil {
		return
	}
	d.win.Update(func() {
		if d.quitting.Load() || d.win.IsDestroyed() {
			return
		}
		d.refreshNativeMenus()
		if d.flyout != nil && !d.flyout.IsDestroyed() {
			d.flyout.Invalidate()
		}
	})
}
