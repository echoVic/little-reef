package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

// The optional browser mode uses the same clock and save format as the desktop.
// It only binds loopback, validates Host/Origin, and exposes an explicit allowlist.
func serveBrowser(addr string, web fs.FS, a *Aquarium) error {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return err
	}
	ip := net.ParseIP(host)
	if ip == nil || !ip.IsLoopback() {
		return errors.New("浏览器模式只能监听明确的回环地址")
	}
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	actual := listener.Addr().String()
	var mu sync.Mutex
	subs := map[chan Snapshot]struct{}{}
	a.onChange = func(s Snapshot) {
		mu.Lock()
		defer mu.Unlock()
		for ch := range subs {
			select {
			case ch <- s:
			default:
			}
		}
	}
	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.FS(web)))
	mux.HandleFunc("/rpc", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			Method string            `json:"method"`
			Args   []json.RawMessage `json:"args"`
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
		if err := decoder.Decode(&req); err != nil {
			http.Error(w, "无效请求", http.StatusBadRequest)
			return
		}
		if err := decoder.Decode(new(any)); err != io.EOF {
			http.Error(w, "无效请求", http.StatusBadRequest)
			return
		}
		var result Snapshot
		var archiveText string
		var callErr error
		switch req.Method {
		case "Aquarium.Get":
			result = a.Get()
		case "Aquarium.ExportArchive":
			archiveText, callErr = a.ExportArchive()
		case "Aquarium.ImportArchive":
			var text string
			if len(req.Args) != 1 || json.Unmarshal(req.Args[0], &text) != nil {
				callErr = errors.New("无效的存档内容")
			} else {
				result, callErr = a.ImportArchive(text)
			}
		case "Aquarium.Start":
			var kind, task string
			if len(req.Args) != 2 || json.Unmarshal(req.Args[0], &kind) != nil || json.Unmarshal(req.Args[1], &task) != nil {
				callErr = errors.New("无效的计时参数")
			} else {
				result, callErr = a.Start(kind, task)
			}
		case "Aquarium.Pause":
			result, callErr = a.Pause()
		case "Aquarium.Resume":
			result, callErr = a.Resume()
		case "Aquarium.End":
			result, callErr = a.End()
		case "Aquarium.Feed":
			result, callErr = a.Feed()
		case "Aquarium.SetPreferences":
			var p Preferences
			if len(req.Args) != 1 || json.Unmarshal(req.Args[0], &p) != nil {
				callErr = errors.New("无效的设置")
			} else {
				result, callErr = a.SetPreferences(p)
			}
		default:
			callErr = errors.New("不支持的操作")
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		if callErr != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": callErr.Error()})
			return
		}
		if archiveText != "" {
			_ = json.NewEncoder(w).Encode(archiveText)
			return
		}
		_ = json.NewEncoder(w).Encode(result)
	})
	mux.HandleFunc("/events", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		f, ok := w.(http.Flusher)
		if !ok {
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-store")
		ch := make(chan Snapshot, 4)
		mu.Lock()
		subs[ch] = struct{}{}
		mu.Unlock()
		defer func() { mu.Lock(); delete(subs, ch); mu.Unlock() }()
		write := func(s Snapshot) {
			data, _ := json.Marshal(s)
			_, _ = w.Write(append(append([]byte("data: "), data...), '\n', '\n'))
			f.Flush()
		}
		write(a.Get())
		heartbeat := time.NewTicker(15 * time.Second)
		defer heartbeat.Stop()
		for {
			select {
			case s := <-ch:
				write(s)
			case <-heartbeat.C:
				_, _ = io.WriteString(w, ": keepalive\n\n")
				f.Flush()
			case <-r.Context().Done():
				return
			}
		}
	})
	server := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Host != actual {
			http.Error(w, "无效的访问地址", http.StatusForbidden)
			return
		}
		if origin := r.Header.Get("Origin"); origin != "" {
			u, e := url.Parse(origin)
			if e != nil || u.Scheme != "http" || u.Host != actual {
				http.Error(w, "无效的请求来源", http.StatusForbidden)
				return
			}
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
		mux.ServeHTTP(w, r)
	}), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 30 * time.Second}
	go a.run()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		c, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = server.Shutdown(c)
	}()
	err = server.Serve(listener)
	if saveErr := a.shutdown(); saveErr != nil {
		return saveErr
	}
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}
