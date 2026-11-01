package main

import "github.com/egoist/mygo/ui"

func (s *nativeSettings) generalView(c *ui.Context) {
	ui.Fieldset(c, "计时与提示音", func() {
		ui.Form(c, func() {
			ui.Field(c, "专注时长", func() { ui.TextInput(c, &s.focusMinutes).Width(120).Disabled(s.busy) }).Description("1–120 分钟")
			ui.Field(c, "休息时长", func() { ui.TextInput(c, &s.breakMinutes).Width(120).Disabled(s.busy) }).Description("1–30 分钟")
		})
		ui.Checkbox(c, &s.chime, "完成时播放轻柔提示音").Disabled(s.busy)
		ui.Text(c, "时长调整从下一轮开始，本轮计时保持不变。").FontSize(12).Opacity(.7)
		ui.Text(c, "电脑休眠和应用退出会暂停计时，回来后手动继续。").FontSize(12).Opacity(.7)
	})
}

func (s *nativeSettings) appearanceView(c *ui.Context) {
	a := s.desktop.a
	snap := a.Get()
	ui.Fieldset(c, "海底皮肤", func() {
		ui.Form(c, func() {
			ui.Field(c, "当前皮肤", func() {
				name := a.themes.names[snap.Theme]
				ui.MenuButton(c, name, func(m *ui.Menu) {
					for _, theme := range a.themes.list() {
						if m.Item(theme.Name).Radio(theme.ID == snap.Theme).Chosen() {
							_, err := a.SetTheme(theme.ID)
							s.feedback(err, "皮肤已切换，自动模式已关闭。")
						}
					}
				}).Label("海底皮肤").Disabled(s.busy)
			})
			auto, shuffle := snap.ThemeAuto, snap.ThemeShuffle
			var autoSwitch, shuffleSwitch ui.Element
			ui.Field(c, "随时间自动切换主题", func() {
				autoSwitch = ui.Switch(c, &auto).Disabled(s.busy)
			}).Description("06:00 马卡龙 · 10:00 赛璐璐\n17:00 青绿江山 · 20:00 深海写实")
			if autoSwitch.Changed() {
				_, err := a.SetThemeAuto(auto)
				s.feedback(err, "主题模式已保存。")
			}
			ui.Field(c, "全部主题随机轮换", func() {
				shuffleSwitch = ui.Switch(c, &shuffle).Disabled(s.busy)
			}).Description("每 30 分钟随机切换，不连续重复。")
			if shuffleSwitch.Changed() {
				_, err := a.SetThemeShuffle(shuffle)
				s.feedback(err, "主题模式已保存。")
			}
		})
		ui.Text(c, "皮肤和主题模式立即生效；两种自动模式只能开启一种。").FontSize(12).Opacity(.7)
	})
}

func (s *nativeSettings) archiveView(c *ui.Context) {
	ui.Fieldset(c, "备份与恢复", func() {
		ui.Text(c, "导出一份存档；换电脑或重装时可以恢复。").FontSize(12).Opacity(.7)
		ui.Row(c).Gap(10).Children(func() {
			if ui.Button(c, "导出存档…").Disabled(s.busy).Clicked() {
				s.exportArchive()
			}
			if ui.Button(c, "导入存档…").Disabled(s.busy).Clicked() {
				s.confirmImport = true
			}
		})
	})
}
