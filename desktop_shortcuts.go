package main

import "github.com/egoist/mygo"

type ShortcutBinding struct {
	Action      string `json:"action"`
	Accelerator string `json:"accelerator"`
}

type ShortcutSnapshot struct {
	Bindings     []ShortcutBinding `json:"bindings"`
	SpaceEnabled bool              `json:"spaceEnabled"`
}

var ShortcutSettingsChanged = mygo.NewEvent[ShortcutSnapshot]("desktop:shortcuts-changed")

// GetShortcutSettings returns a copy of the current presentation preferences.
func (d *Desktop) GetShortcutSettings() ShortcutSnapshot {
	cfg := d.shortcutSettings()
	out := ShortcutSnapshot{Bindings: make([]ShortcutBinding, 0, len(shortcutDefinitions)), SpaceEnabled: cfg.SpaceEnabled}
	for _, def := range shortcutDefinitions {
		out.Bindings = append(out.Bindings, ShortcutBinding{def.ID, cfg.Bindings[def.ID]})
	}
	return out
}

func (d *Desktop) shortcutSettings() ShortcutSettings {
	if d.shortcuts == nil {
		return defaultShortcutSettings()
	}
	return d.shortcuts.snapshot()
}

func (d *Desktop) shortcut(id string) string { return d.shortcutSettings().Bindings[id] }

type pausedMenuShortcut struct {
	item        *mygo.MenuItem
	accelerator string
}

func (d *Desktop) pauseShortcutMenus() {
	if len(d.pausedMenuShortcuts) > 0 {
		return
	}
	seen := map[*mygo.MenuItem]bool{}
	var pause func([]*mygo.MenuItem)
	pause = func(items []*mygo.MenuItem) {
		for _, item := range items {
			if seen[item] {
				continue
			}
			seen[item] = true
			if item.Accelerator != "" {
				d.pausedMenuShortcuts = append(d.pausedMenuShortcuts, pausedMenuShortcut{item, item.Accelerator})
				item.SetAccelerator("")
			}
			pause(item.Submenu)
		}
	}
	for _, menu := range []*mygo.Menu{d.appMenu, d.menu} {
		if menu != nil {
			pause(menu.Items())
		}
	}
}

func (d *Desktop) resumeShortcutMenus() {
	for _, paused := range d.pausedMenuShortcuts {
		paused.item.SetAccelerator(paused.accelerator)
	}
	d.pausedMenuShortcuts = nil
}

func (d *Desktop) syncShortcutMenus() {
	cfg := d.shortcutSettings()
	for _, menu := range []*mygo.Menu{d.appMenu, d.menu} {
		if menu == nil {
			continue
		}
		for _, def := range shortcutDefinitions {
			if def.Global {
				continue
			}
			if item := menu.ItemByID(def.ID); item != nil {
				item.SetAccelerator(cfg.Bindings[def.ID])
			}
		}
	}
}
