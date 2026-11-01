package main

import (
	"fmt"
	"math"

	"github.com/egoist/mygo/ui"
)

func (d *Desktop) panelView(c *ui.Context) {
	snap, aud := d.a.Get(), d.audio.get()
	if theme := d.theme.get(snap.Theme, d.parseTheme); theme != nil {
		c.SetTheme(theme)
	}
	busy := d.timerReq.isPending()
	primary, secondary := panelPrimary(snap), panelSecondary(snap)
	confirmationWasOpen := d.confirmEnd
	if d.confirmEnd && (d.confirmEndSession != snap.Session.ID || !sessionActive(snap)) {
		d.confirmEnd = false
	}
	ui.Column(c).Fill().Padding(16).Gap(10).Children(func() {
		ui.Scroll(c).Grow(1).FillWidth().Children(func() {
			ui.Column(c).FillWidth().Gap(10).Children(func() {
				ui.Row(c).Children(func() {
					ui.Text(c, "小海底").Bold().Grow(1)
					ui.Text(c, fmt.Sprintf("今天 %d 轮", snap.TodayRounds)).FontSize(11).Opacity(.7)
				})
				if task := []rune(snap.Session.Task); len(task) > 0 {
					if len(task) > 22 {
						task = append(task[:22], '…')
					}
					ui.Text(c, string(task)).Label("当前任务").FontSize(12).Opacity(.8)
				}
				ui.Column(c).AlignItems(ui.Center).Gap(4).Children(func() {
					ui.Text(c, panelTime(snap)).Label("剩余时间").FontSize(42).Bold()
					ui.Text(c, d.statusLine(snap)).Label("状态").FontSize(12).Opacity(.7)
				})
				ui.Row(c).Gap(8).Children(func() {
					label := primary.Label
					if busy {
						label = "正在处理…"
					}
					if ui.PrimaryButton(c, label).Disabled(busy).Grow(1).Clicked() {
						d.startTimerAction(primary.Command, 0)
					}
					if secondary.Command != "" {
						if ui.Button(c, secondary.Label).Disabled(busy).Clicked() {
							d.startTimerAction(secondary.Command, 0)
						}
					} else if ui.Button(c, "结束本轮").Disabled(busy).Clicked() {
						d.confirmEnd, d.confirmEndSession = true, snap.Session.ID
					}
				})
				ui.Divider(c)
				label := "开启声音"
				if aud.Requested {
					label = "关闭声音"
				}
				if aud.NeedGesture {
					label = "前往主窗口开启声音"
				}
				if d.req.isPending() {
					label = "声音处理中…"
				}
				if ui.Button(c, label).Label(label).Disabled(d.req.isPending()).FillWidth().Clicked() {
					if aud.NeedGesture {
						d.openAquarium()
					} else {
						d.requestAudio("toggle", 0)
					}
				}
				d.vol.mu.Lock()
				volume := snap.Preferences.Volume
				if d.vol.active {
					volume = d.vol.val
				}
				d.vol.mu.Unlock()
				ui.Row(c).Gap(8).Children(func() {
					ui.Text(c, "音量").FontSize(12)
					if ui.Slider(c, &volume, 0, 1).Label("音量").Grow(1).Changed() {
						d.vol.mu.Lock()
						d.vol.val, d.vol.active = volume, true
						d.vol.mu.Unlock()
						d.requestAudio("set-volume", volume)
					}
					ui.Text(c, fmt.Sprintf("%d%%", int(math.Round(volume*100)))).Width(34).FontSize(12)
				})

			})
		})
		message := d.timerReq.lastErr()
		if message == "" {
			message = d.req.lastErr()
		}
		if message == "" {
			message = d.uiReq.lastErr()
		}
		if message != "" {
			ui.Text(c, message).Label("错误").FontSize(11).TextColor(c.Theme().Danger)
		}
		ui.Divider(c)
		ui.Row(c).Gap(6).Children(func() {
			if ui.Button(c, "打开水族馆").Clicked() {
				d.openAquarium()
			}
			mode := "挂件模式"
			if d.compact.Load() {
				mode = "普通窗口"
			}
			if ui.Button(c, mode).Disabled(d.uiReq.isPending()).Clicked() {
				d.requestCompact(!d.compact.Load())
			}
			if ui.Button(c, "设置…").Clicked() {
				d.OpenSettings()
			}
		})

	})
	if d.confirmEnd {
		if ui.AlertDialog(c, &d.confirmEnd, "结束本轮？", "已投入的专注会保留，不计为完成一轮。", "继续这一轮", "结束本轮") == 1 {
			d.startTimerAction(timerEnd, d.confirmEndSession)
		}
	}
	if confirmationWasOpen != d.confirmEnd {
		d.invalidateNativeMenus()
	}
}
