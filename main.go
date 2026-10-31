// Aquarium is a focus timer whose completed sessions grow a small reef.
// The page is the built Vite bundle embedded from web/dist; no network access.
package main

import (
	"embed"
	"errors"
	"flag"
	"io/fs"
	"log"
	"os"
	"path/filepath"

	"github.com/egoist/mygo"
	_ "github.com/egoist/mygo/locales/zh-Hans"
)

// Embed exactly what the Go side serves or gates on. Listing paths explicitly
// keeps web/node_modules and other frontend scratch out of the binary; web/dist
// is the production Vite bundle and must exist (run `npm run build` in web/).
//
//go:embed web/dist
//go:embed web/public/themes
//go:embed web/public/sounds
//go:embed web/src/reef/species.ts
var frontend embed.FS

var Changed = mygo.NewEvent[Snapshot]("aquarium:changed")

// embeddedFrontend returns the production Vite bundle (web/dist). It fails
// loudly when dist/index.html is missing: after the React migration the
// legacy no-build page is gone and there is no usable fallback, so a run
// without a build must not silently serve a broken page. Build the frontend
// first: cd web && npm ci --registry=https://registry.npmjs.org/ && npm run build.
// Compilation never depends on dist existing (//go:embed web covers the whole
// tree), so go build / go test stay green before any frontend build.
func embeddedFrontend() (fs.FS, error) {
	root, err := fs.Sub(frontend, "web")
	if err != nil {
		return nil, err
	}
	if _, err := fs.Stat(root, "dist/index.html"); err != nil {
		return nil, errors.New("web/dist/index.html 不存在：请先在 web/ 执行 npm ci --registry=https://registry.npmjs.org/ && npm run build 构建前端")
	}
	return fs.Sub(root, "dist")
}

func main() {
	webAddr := flag.String("web", "", "仅在回环地址提供浏览器版，例如 127.0.0.1:4173")
	dataDir := flag.String("data-dir", "", "指定独立存档目录")
	exportIcons := flag.Bool("export-icons", false, "重新生成 assets/icon.png 与网页图标后退出")
	flag.Parse()
	if *exportIcons {
		if err := exportIconAssets(); err != nil {
			log.Fatal(err)
		}
		return
	}
	mygo.App.SetName("小海底")
	mygo.App.SetLanguages("zh-Hans")
	web, err := embeddedFrontend()
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
	themeStore, err := newThemeStore(dir)
	if err != nil {
		log.Fatal(err)
	}
	a.themes = themeStore
	a.theme = themeStore.load()
	desktop.a = a
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
	if err := desktop.run(web); err != nil {
		log.Fatal(err)
	}
}
