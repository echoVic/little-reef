package main

import (
	"errors"
	"fmt"
	"time"

	"github.com/egoist/mygo"
)

type timerCommand string

const (
	timerStartFocus timerCommand = "start-focus"
	timerStartBreak timerCommand = "start-break"
	timerPause      timerCommand = "pause"
	timerResume     timerCommand = "resume"
	timerEnd        timerCommand = "end"
)

type timerAction struct {
	Label   string
	Command timerCommand
}

func sessionActive(s Snapshot) bool {
	return s.Session.Status == "running" || s.Session.Status == "paused"
}

func panelPrimary(s Snapshot) timerAction {
	kind := "专注"
	if s.Session.Kind == "break" {
		kind = "休息"
	}
	switch s.Session.Status {
	case "running":
		return timerAction{"暂停" + kind, timerPause}
	case "paused":
		return timerAction{"继续" + kind, timerResume}
	case "complete":
		if s.Session.Kind == "focus" {
			return timerAction{"开始休息", timerStartBreak}
		}
	}
	return timerAction{"开始专注", timerStartFocus}
}

func panelSecondary(s Snapshot) timerAction {
	if sessionActive(s) {
		return timerAction{}
	}
	if panelPrimary(s).Command == timerStartBreak {
		return timerAction{"开始专注", timerStartFocus}
	}
	return timerAction{"开始休息", timerStartBreak}
}

func panelTime(s Snapshot) string {
	remaining := max(int64(0), s.Session.DurationMS-s.Session.ElapsedMS)
	if s.Session.Status == "idle" {
		remaining = int64(s.Preferences.FocusMinutes) * 60 * 1000
	}
	seconds := (remaining + 999) / 1000
	return fmt.Sprintf("%02d:%02d", seconds/60, seconds%60)
}

func (d *Desktop) performTimerAction(command timerCommand, sessionID int64) error {
	var err error
	switch command {
	case timerStartFocus:
		_, err = d.a.Start("focus", "")
	case timerStartBreak:
		_, err = d.a.Start("break", "")
	case timerPause:
		_, err = d.a.Pause()
	case timerResume:
		_, err = d.a.Resume()
	case timerEnd:
		_, err = d.a.endSession(sessionID)
	default:
		err = errors.New("未知的计时操作")
	}
	return err
}

func (d *Desktop) startTimerAction(command timerCommand, sessionID int64) {
	id, ok := d.beginRequest()
	if !ok {
		return
	}
	d.invalidateNativeMenus()
	go func() { d.endRequest(id, d.performTimerAction(command, sessionID)) }()
}

func (d *Desktop) beginRequest() (string, bool) {
	id := fmt.Sprintf("timer-%d", time.Now().UnixNano())
	d.timerReq.setOnTimeout(d.invalidateNativeMenus)
	return id, d.timerReq.begin(id, 3*time.Second)
}

func (d *Desktop) endRequest(id string, err error) {
	message := ""
	if err != nil {
		message = err.Error()
	}
	d.timerReq.done(id, err == nil, message)
	d.invalidateNativeMenus()
	if err != nil && d.win != nil {
		d.win.Update(func() {
			if d.quitting.Load() || d.win.IsDestroyed() {
				return
			}
			if d.tray != nil {
				d.openFlyout()
			} else {
				go func() {
					_, _ = mygo.Dialog.Message(mygo.MessageOptions{Parent: d.win, Type: mygo.MessageError, Title: "计时操作未完成", Message: message})
				}()
			}
		})
	}
}

func (d *Desktop) askEndRound() {
	if d.win == nil {
		return
	}
	d.win.Update(func() {
		if d.quitting.Load() || d.timerReq.isPending() || d.confirmEnd {
			return
		}
		s := d.a.Get()
		if !sessionActive(s) {
			return
		}
		d.confirmEnd, d.confirmEndSession = true, s.Session.ID
		d.invalidateNativeMenus()
		if d.tray != nil {
			d.openFlyout()
			return
		}
		d.show()
		go func(target int64) {
			result, err := mygo.Dialog.Message(mygo.MessageOptions{Parent: d.win, Type: mygo.MessageQuestion, Title: "结束本轮？", Message: "结束本轮？", Detail: "已投入的专注会保留，不计为完成一轮。", Buttons: []string{"继续这一轮", "结束本轮"}, DefaultButton: 0, CancelButton: 0})
			d.win.Update(func() {
				d.confirmEnd = false
				if err == nil && result.Button == 1 && !d.quitting.Load() {
					d.startTimerAction(timerEnd, target)
				}
				d.refreshNativeMenus()
			})
		}(s.Session.ID)
	})
}
