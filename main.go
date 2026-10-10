// Aquarium is a focus timer whose completed sessions grow a small reef.
// Its embedded frontend needs neither a JavaScript build nor network access.
package main

import (
	"bytes"
	"context"
	"embed"
	"flag"
	"image"
	"image/color"
	"image/png"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"runtime"

	"github.com/egoist/mygo"
)

//go:embed web
var frontend embed.FS

var Changed = mygo.NewEvent[Snapshot]("aquarium:changed")

// Desktop controls the current aquarium window.
type Desktop struct{ tray *mygo.Tray }

// Hide keeps the page and sound alive in the tray, or minimizes without a tray.
func (d *Desktop) Hide(ctx context.Context) {
	if win := mygo.CallerWindow(ctx); win != nil {
		if d.tray != nil {
			win.Hide()
		} else {
			win.Minimize()
		}
	}
}

// SetCompact turns the window into a small always-on-top desktop aquarium.
func (d *Desktop) SetCompact(ctx context.Context, compact bool) {
	if win := mygo.CallerWindow(ctx); win != nil {
		win.SetAlwaysOnTop(compact)
		if compact {
			win.SetMinimumSize(360, 260)
			win.SetSize(400, 350)
			area := mygo.Screen.PrimaryDisplay().WorkArea
			win.SetPosition(area.X+max(0, area.Width-420), area.Y+max(0, area.Height-370))
		} else {
			win.SetMinimumSize(760, 680)
			win.SetSize(1100, 800)
			win.Center()
		}
	}
}

// Quit closes the desktop app and saves the current session.
func (*Desktop) Quit() { mygo.App.Quit() }

func icon() []byte {
	img := image.NewNRGBA(image.Rect(0, 0, 32, 32))
	ink := color.NRGBA{R: 106, G: 216, B: 194, A: 255}
	if runtime.GOOS == "darwin" {
		ink = color.NRGBA{A: 255}
	}
	for y := 6; y < 26; y++ {
		for x := 3; x < 29; x++ {
			dx, dy := float64(x-18)/11, float64(y-16)/8
			if dx*dx+dy*dy < 1 || (x < 10 && abs(y-16) < 10-x) {
				img.SetNRGBA(x, y, ink)
			}
		}
	}
	var b bytes.Buffer
	_ = png.Encode(&b, img)
	return b.Bytes()
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}

func main() {
	webAddr := flag.String("web", "", "仅在回环地址提供浏览器版，例如 127.0.0.1:4173")
	dataDir := flag.String("data-dir", "", "指定独立存档目录")
	flag.Parse()
	mygo.App.SetName("小海底")
	mygo.App.SetVersion("0.1.0")
	web, err := fs.Sub(frontend, "web")
	if err != nil {
		log.Fatal(err)
	}
	desktop := &Desktop{}
	// Generation binds types but does not open files, acquire locks, or start work.
	if os.Getenv("MYGO_GENERATE") != "" {
		mygo.Bind(&Aquarium{})
		mygo.Bind(desktop)
		if err := mygo.App.Run(); err != nil {
			log.Fatal(err)
		}
		return
	}
	dir := *dataDir
	if dir == "" {
		if *webAddr != "" {
			base, e := os.UserConfigDir()
			if e != nil {
				log.Fatal(e)
			}
			dir = filepath.Join(base, "mygo-aquarium-browser")
		} else {
			dir, err = mygo.App.Path(mygo.PathUserData)
			if err != nil {
				log.Fatal(err)
			}
		}
	}
	a, err := newAquarium(filepath.Join(dir, "aquarium.json"))
	if err != nil {
		log.Fatal(err)
	}
	mygo.Bind(a)
	mygo.Bind(desktop)
	if *webAddr != "" {
		if err := serveBrowser(*webAddr, web, a); err != nil {
			log.Fatal(err)
		}
		return
	}
	if !mygo.App.RequestSingleInstanceLock() {
		return
	}
	mygo.SetFrontend(web)
	var win *mygo.Window
	quitting := false
	a.onChange = func(s Snapshot) { _ = Changed.Broadcast(s) }
	a.onDone = func(s Snapshot) {
		go func() {
			n := mygo.NewNotification(mygo.NotificationOptions{Title: "小海底 · " + map[bool]string{true: "专注完成", false: "休息结束"}[s.Session.Kind == "focus"], Body: s.Notice})
			n.OnClick(func() { win.Show(); win.Focus() })
			_ = n.Show()
		}()
	}
	mygo.App.WhenReady(func() {
		win = mygo.NewWindow(mygo.WindowOptions{
			Title: "小海底 · 桌面水族馆", URL: "/", Width: 1100, Height: 800, MinWidth: 760, MinHeight: 680,
			Frameless: true, Transparent: true, BackgroundColor: "#0c1820", StateKey: "aquarium-main",
		})
		win.SetMenu(mygo.NewMenu(nil))
		win.OnClose(func(e *mygo.CloseEvent) {
			if !quitting && desktop.tray != nil {
				e.PreventDefault()
				win.Hide()
			}
		})
		show := func() { win.Show(); win.Focus() }
		mygo.App.OnActivate(func(bool) { show() })
		tray, trayErr := mygo.NewTray(mygo.TrayOptions{Icon: icon(), IconIsTemplate: runtime.GOOS == "darwin", ToolTip: "小海底 · 专注养出一片海",
			Menu: mygo.NewMenu([]*mygo.MenuItem{{Label: "打开小海底", Click: func(*mygo.MenuItem, *mygo.Window) { show() }}, mygo.Separator(), {Label: "退出小海底", Click: func(*mygo.MenuItem, *mygo.Window) { mygo.App.Quit() }}}),
		})
		if trayErr == nil {
			desktop.tray = tray
		} else {
			log.Print("托盘不可用，将保留普通窗口：", trayErr)
		}
		_ = mygo.GlobalShortcut.Register("CmdOrCtrl+Shift+A", show)
		mygo.Power.OnSuspend(func() { go func() { _, _ = a.Pause() }() })
		go a.run()
	})
	mygo.App.OnBeforeQuit(func(*mygo.QuitEvent) { quitting = true })
	mygo.App.OnWillQuit(func(*mygo.QuitEvent) {
		if err := a.shutdown(); err != nil {
			log.Print("存档失败：", err)
		}
		if desktop.tray != nil {
			desktop.tray.Destroy()
		}
	})
	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}
