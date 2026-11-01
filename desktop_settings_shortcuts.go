package main

import (
	"fmt"
	"runtime"

	"github.com/egoist/mygo/ui"
)

func (s *nativeSettings) beginShortcutRecording(id string) {
	s.stopShortcutRecording()
	s.recording = id
	s.recordingBefore = s.shortcutDraft.Bindings[id]
	s.capturedKey = ui.KeyUnknown
	s.capturedMods = 0
	s.feedback(nil, "")
	if s.desktop.shortcuts != nil {
		s.desktop.shortcuts.suspend()
	}
	s.desktop.pauseShortcutMenus()
}

func (s *nativeSettings) stopShortcutRecording() {
	if s.recording == "" {
		return
	}
	s.recording = ""
	s.capturedKey = ui.KeyUnknown
	s.capturedMods = 0
	if s.desktop.quitting.Load() {
		return
	}
	s.desktop.resumeShortcutMenus()
	if s.desktop.shortcuts != nil {
		if err := s.desktop.shortcuts.resume(); err != nil {
			s.feedback(err, "")
		}
	}
}

func (s *nativeSettings) shortcutInput(id string, ev ui.InputEvent) bool {
	if s.recording != id {
		return false
	}
	if ev.Kind == ui.InputKeyUp {
		if s.capturedKey != ui.KeyUnknown && ev.Key == s.capturedKey {
			s.stopShortcutRecording()
		}
		return true
	}
	if ev.Kind != ui.InputKeyDown {
		return ev.Kind == ui.InputText || ev.Kind == ui.InputCommand
	}
	if ev.Repeat {
		return true
	}
	if ev.Key == ui.KeyEscape && ev.Mods == 0 {
		s.shortcutDraft.Bindings[id] = s.recordingBefore
		s.stopShortcutRecording()
		s.feedback(nil, "已取消录制。")
		return true
	}
	if ev.Key == ui.KeyTab && ev.Mods == 0 {
		return false
	}
	if s.capturedKey != ui.KeyUnknown {
		return true
	}
	if (ev.Key == ui.KeyBackspace || ev.Key == ui.KeyDelete) && ev.Mods == 0 {
		s.shortcutDraft.Bindings[id] = ""
		s.capturedKey = ev.Key
		s.feedback(nil, "已停用该组合，保存后生效。")
		return true
	}
	if ev.Key == ui.KeyUnknown {
		return true
	}
	key, err := shortcutFromInput(ev.Mods, ev.Key)
	if err == nil {
		candidate := cloneShortcutSettings(s.shortcutDraft)
		candidate.Bindings[id] = key
		_, err = normalizeShortcutSettings(candidate)
	}
	if err != nil {
		s.feedback(err, "")
		return true
	}
	s.shortcutDraft.Bindings[id] = key
	s.capturedKey = ev.Key
	s.capturedMods = ev.Mods
	s.feedback(nil, "已录制，松开按键后可保存。")
	return true
}

func (s *nativeSettings) saveShortcuts() {
	if s.recording != "" {
		s.feedback(fmt.Errorf("请先完成或取消录制"), "")
		return
	}
	if s.desktop.shortcuts == nil {
		s.feedback(fmt.Errorf("快捷键设置暂时不可用"), "")
		return
	}
	if err := s.desktop.shortcuts.apply(s.shortcutDraft); err != nil {
		s.feedback(err, "")
		return
	}
	s.shortcutDraft = s.desktop.shortcuts.snapshot()
	s.desktop.syncShortcutMenus()
	_ = ShortcutSettingsChanged.Broadcast(s.desktop.GetShortcutSettings())
	s.feedback(nil, "快捷键已保存并生效。")
}

func (s *nativeSettings) shortcutsView(c *ui.Context) {
	// macOS can omit the main key-up for Command chords. Modifier release
	// still reaches the context, and restoring accelerators is safe once all
	// modifiers are up because configured shortcuts always require one.
	if runtime.GOOS == "darwin" && s.recording != "" && s.capturedKey != ui.KeyUnknown && s.capturedMods&ui.Super != 0 && c.Modifiers() == 0 {
		s.stopShortcutRecording()
	}
	ui.Column(c).FillWidth().Padding(24).Gap(16).Children(func() {
		ui.Text(c, "除全局唤起外，其余组合只在小海底处于前台时生效。").FontSize(12).Opacity(.7)
		ui.Text(c, "点击组合键后录制新组合；松开按键完成。Esc 取消，⌫ 停用。").FontSize(12).Opacity(.7)
		ui.Form(c, func() {
			for _, def := range shortcutDefinitions {
				id := def.ID
				field := ui.Field(c, def.Label, func() {
					ui.Row(c).Gap(8).Children(func() {
						label := displayShortcut(s.shortcutDraft.Bindings[id])
						if s.recording == id {
							label = "请按组合键…"
							if s.capturedKey != ui.KeyUnknown {
								label = "松开按键完成"
							}
						}
						button := ui.Button(c.Key("shortcut-"+id), label).Label("修改" + def.Label).Width(170).Disabled(s.busy)
						button.HandleInput(func(ev ui.InputEvent) bool { return s.shortcutInput(id, ev) })
						if button.Clicked() {
							s.beginShortcutRecording(id)
							button.Focus()
						}
						if s.recording == id && !button.Focused() {
							s.stopShortcutRecording()
						}
						if ui.Button(c, "停用").Label("停用" + def.Label).Disabled(s.busy || s.shortcutDraft.Bindings[id] == "").Clicked() {
							s.stopShortcutRecording()
							s.shortcutDraft.Bindings[id] = ""
							s.feedback(nil, "保存后停用该组合。")
						}
					})
				})
				if def.Global {
					field.Description("在其他应用中也能唤起小海底。")
				}
			}
		})
		ui.Divider(c)
		ui.Checkbox(c, &s.shortcutDraft.SpaceEnabled, "在水族馆空白处用空格键控制计时").Disabled(s.busy)
		ui.Text(c, "输入文字或操作按钮时不响应空格；带修饰键的空格也不会误触计时。").FontSize(12).Opacity(.7)
		if ui.Button(c, "恢复默认快捷键").Disabled(s.busy).Clicked() {
			s.stopShortcutRecording()
			s.shortcutDraft = defaultShortcutSettings()
			s.feedback(nil, "已恢复默认，保存后生效。")
		}
		if s.desktop.shortcuts != nil {
			if status := s.desktop.shortcuts.status(); status != "" {
				ui.Text(c, status).FontSize(12).TextColor(c.Theme().Danger)
			}
		}
	})
}
