package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

type ShortcutSettings struct {
	Bindings     map[string]string `json:"bindings"`
	SpaceEnabled bool              `json:"spaceEnabled"`
}

func defaultShortcutSettings() ShortcutSettings {
	cfg := ShortcutSettings{Bindings: map[string]string{}, SpaceEnabled: true}
	for _, def := range shortcutDefinitions {
		cfg.Bindings[def.ID] = def.Default
	}
	return cfg
}

func cloneShortcutSettings(cfg ShortcutSettings) ShortcutSettings {
	copy := ShortcutSettings{Bindings: map[string]string{}, SpaceEnabled: cfg.SpaceEnabled}
	for id, key := range cfg.Bindings {
		copy.Bindings[id] = key
	}
	return copy
}

func normalizeShortcutSettings(cfg ShortcutSettings) (ShortcutSettings, error) {
	out := defaultShortcutSettings()
	out.SpaceEnabled = cfg.SpaceEnabled
	known := map[string]bool{}
	used := map[string]string{}
	for _, def := range shortcutDefinitions {
		known[def.ID] = true
		raw, ok := cfg.Bindings[def.ID]
		if !ok {
			raw = def.Default
		}
		key, err := normalizeShortcut(raw)
		if err != nil {
			return ShortcutSettings{}, fmt.Errorf("%s：%w", def.Label, err)
		}
		if key != "" {
			if reservedShortcut(key) {
				return ShortcutSettings{}, fmt.Errorf("%s 是系统或编辑快捷键，请换一个组合", displayShortcut(key))
			}
			if label := used[key]; label != "" {
				return ShortcutSettings{}, fmt.Errorf("%s 已用于“%s”", displayShortcut(key), label)
			}
			used[key] = def.Label
		}
		out.Bindings[def.ID] = key
	}
	for id := range cfg.Bindings {
		if !known[id] {
			return ShortcutSettings{}, fmt.Errorf("未知快捷键操作 %q", id)
		}
	}
	return out, nil
}

type shortcutRegistry interface {
	Register(string, func()) error
	Unregister(string)
}

// shortcutController owns its global registration and a separate presentation file.
// Menu and recording changes run on the UI thread; snapshots may arrive via IPC.
type shortcutController struct {
	mu                         sync.Mutex
	dir                        string
	config                     ShortcutSettings
	registry                   shortcutRegistry
	wake                       func()
	activeGlobal, resumeGlobal string
	suspended                  bool
	lastError                  string
}

func newShortcutController(dir string, registry shortcutRegistry, wake func()) *shortcutController {
	c := &shortcutController{dir: dir, registry: registry, wake: wake, config: defaultShortcutSettings()}
	data, err := os.ReadFile(filepath.Join(dir, "shortcuts.json"))
	if errors.Is(err, os.ErrNotExist) {
		return c
	}
	candidate := defaultShortcutSettings()
	if err == nil {
		err = json.Unmarshal(data, &candidate)
	}
	if err == nil {
		candidate, err = normalizeShortcutSettings(candidate)
	}
	if err != nil {
		c.lastError = "快捷键配置无法读取，已使用默认设置。"
		return c
	}
	c.config = candidate
	return c
}

func (c *shortcutController) snapshot() ShortcutSettings {
	c.mu.Lock()
	defer c.mu.Unlock()
	return cloneShortcutSettings(c.config)
}
func (c *shortcutController) status() string { c.mu.Lock(); defer c.mu.Unlock(); return c.lastError }

func (c *shortcutController) start() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	key := c.config.Bindings[shortcutGlobal]
	if key == "" || c.activeGlobal == key {
		return nil
	}
	if err := c.registry.Register(key, c.wake); err != nil {
		c.lastError = "全局快捷键不可用，请换一个组合：" + err.Error()
		return errors.New(c.lastError)
	}
	c.activeGlobal = key
	return nil
}

func (c *shortcutController) apply(candidate ShortcutSettings) error {
	next, err := normalizeShortcutSettings(candidate)
	if err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.suspended {
		return errors.New("请先完成或取消快捷键录制")
	}
	wanted, old := next.Bindings[shortcutGlobal], c.activeGlobal
	registered := false
	if wanted != "" && wanted != old {
		if err = c.registry.Register(wanted, c.wake); err != nil {
			return fmt.Errorf("无法使用全局快捷键 %s，仍保留原设置：%w", displayShortcut(wanted), err)
		}
		registered = true
	}
	if err = c.save(next); err != nil {
		if registered {
			c.registry.Unregister(wanted)
		}
		return err
	}
	if old != "" && old != wanted {
		c.registry.Unregister(old)
	}
	c.config, c.activeGlobal, c.lastError = next, wanted, ""
	return nil
}

func (c *shortcutController) save(cfg ShortcutSettings) error {
	if err := os.MkdirAll(c.dir, 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	f, err := os.CreateTemp(c.dir, ".shortcuts-*.tmp")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	defer f.Close()
	if _, err = f.Write(data); err != nil {
		return err
	}
	if err = f.Sync(); err != nil {
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return os.Rename(f.Name(), filepath.Join(c.dir, "shortcuts.json"))
}

func (c *shortcutController) suspend() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.suspended {
		return
	}
	c.suspended = true
	c.resumeGlobal = c.activeGlobal
	if c.activeGlobal != "" {
		c.registry.Unregister(c.activeGlobal)
		c.activeGlobal = ""
	}
}

func (c *shortcutController) resume() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.suspended {
		return nil
	}
	c.suspended = false
	key := c.resumeGlobal
	c.resumeGlobal = ""
	if key == "" {
		return nil
	}
	if err := c.registry.Register(key, c.wake); err != nil {
		c.lastError = "全局快捷键未能恢复，请换一个组合：" + err.Error()
		return errors.New(c.lastError)
	}
	c.activeGlobal = key
	return nil
}

func (c *shortcutController) stop() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.activeGlobal != "" {
		c.registry.Unregister(c.activeGlobal)
	}
	c.activeGlobal, c.resumeGlobal = "", ""
	c.suspended = false
}
