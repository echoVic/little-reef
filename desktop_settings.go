package main

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
)

const (
	settingsGeneral = iota
	settingsAppearance
	settingsShortcuts
	settingsArchive
)

// nativeSettings owns only this window's unsaved draft. Aquarium owns live settings.
type nativeSettings struct {
	desktop                    *Desktop
	ctx                        context.Context
	cancel                     context.CancelFunc
	win                        *mygo.Window
	focusMinutes               string
	breakMinutes               string
	chime                      bool
	busy                       bool
	confirmImport              bool
	message                    string
	error                      string
	tab                        int
	shortcutDraft              ShortcutSettings
	recording, recordingBefore string
	capturedKey                ui.Key
	capturedMods               ui.Modifiers
}

func newNativeSettings(d *Desktop) *nativeSettings {
	ctx, cancel := context.WithCancel(context.Background())
	s := &nativeSettings{desktop: d, ctx: ctx, cancel: cancel, shortcutDraft: d.shortcutSettings()}
	s.resetDraft(d.a.Get().Preferences)
	return s
}

func (s *nativeSettings) resetDraft(p Preferences) {
	s.focusMinutes = strconv.Itoa(p.FocusMinutes)
	s.breakMinutes = strconv.Itoa(p.BreakMinutes)
	s.chime = p.ChimeEnabled
}

// OpenSettings opens or focuses the shared native settings window.
func (d *Desktop) OpenSettings() {
	mygo.RunOnMain(func() {
		if d.quitting.Load() {
			return
		}
		if s := d.settings; s != nil && !s.win.IsDestroyed() {
			s.win.Show()
			s.win.Focus()
			return
		}
		s := newNativeSettings(d)
		d.settings = s
		s.win = mygo.NewWindow(mygo.WindowOptions{
			Title: "小海底设置", Width: 560, Height: 680, MinWidth: 480, MinHeight: 520,
			DisableMinimize: true, DisableMaximize: true, Content: ui.View(s.view),
		})
		s.win.OnClosed(func() {
			s.stopShortcutRecording()
			s.cancel()
			if d.settings == s {
				d.settings = nil
			}
		})
		s.win.OnBlur(s.stopShortcutRecording)
		s.win.Focus()
	})
}

func (s *nativeSettings) feedback(err error, message string) {
	s.message, s.error = "", ""
	if err != nil {
		s.error = err.Error()
	} else {
		s.message = message
	}
}

func (s *nativeSettings) savePreferences() {
	focus, focusErr := strconv.Atoi(strings.TrimSpace(s.focusMinutes))
	rest, restErr := strconv.Atoi(strings.TrimSpace(s.breakMinutes))
	if focusErr != nil || restErr != nil {
		s.feedback(errors.New("请填写整数分钟：专注 1–120，休息 1–30。"), "")
		return
	}
	_, err := s.desktop.a.setTimerPreferences(focus, rest, s.chime)
	s.feedback(err, "设置已保存，时长从下一轮生效。")
}

func (s *nativeSettings) view(c *ui.Context) {
	ui.Column(c).Fill().Children(func() {
		previousTab := s.tab
		ui.Tabs(c, &s.tab, "通用", "外观", "快捷键", "备份与恢复").Margin(16, 24, 0, 24)
		if previousTab != s.tab {
			s.stopShortcutRecording()
			s.feedback(nil, "")
		}
		ui.Scroll(c.Key("settings-page-" + strconv.Itoa(s.tab))).Grow(1).FillWidth().Children(func() {
			if s.tab == settingsShortcuts {
				s.shortcutsView(c)
				return
			}
			ui.Column(c).Padding(24).Gap(20).FillWidth().Children(func() {
				switch s.tab {
				case settingsAppearance:
					s.appearanceView(c)
				case settingsArchive:
					s.archiveView(c)
				default:
					s.generalView(c)
				}
			})
		})
		ui.Divider(c)
		ui.Row(c).Padding(16, 24).Gap(12).Children(func() {
			message := s.message
			if s.error != "" {
				message = s.error
			}
			ui.Text(c, message).FontSize(12).Grow(1)
			if s.tab != settingsGeneral && s.tab != settingsShortcuts {
				return
			}
			label := "保存设置"
			if s.tab == settingsShortcuts {
				label = "保存快捷键"
			}
			if ui.PrimaryButton(c, label).Disabled(s.busy || s.recording != "").Clicked() {
				if s.tab == settingsShortcuts {
					s.saveShortcuts()
				} else {
					s.savePreferences()
				}
			}
		})
	})
	if ui.AlertDialog(c, &s.confirmImport, "导入存档？", "导入会替换当前海底，建议先导出一份备份。", "取消", "导入") == 1 {
		s.importArchive()
	}
}
