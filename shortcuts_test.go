package main

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

type fakeShortcutRegistry struct {
	active map[string]func()
	denied map[string]bool
}

func (r *fakeShortcutRegistry) Register(key string, fn func()) error {
	if r.denied[key] {
		return errors.New("occupied")
	}
	if r.active == nil {
		r.active = map[string]func(){}
	}
	if _, ok := r.active[key]; ok {
		return errors.New("already registered")
	}
	r.active[key] = fn
	return nil
}
func (r *fakeShortcutRegistry) Unregister(key string) { delete(r.active, key) }

func TestShortcutValidationNormalizesAndRejectsConflicts(t *testing.T) {
	cfg := defaultShortcutSettings()
	cfg.Bindings[shortcutPrimary] = "shift+cmdorctrl+p"
	normalized, err := normalizeShortcutSettings(cfg)
	if err != nil || normalized.Bindings[shortcutPrimary] != "CmdOrCtrl+Shift+P" {
		t.Fatalf("normalization: %+v / %v", normalized, err)
	}
	for _, bad := range []string{"A", "Shift+P", "CmdOrCtrl+Q", "CmdOrCtrl+C", "CmdOrCtrl+Space", "CmdOrCtrl+R", "CmdOrCtrl+1"} {
		candidate := defaultShortcutSettings()
		candidate.Bindings[shortcutPrimary] = bad
		if _, err := normalizeShortcutSettings(candidate); err == nil {
			t.Errorf("accepted conflicting shortcut %q", bad)
		}
	}
	cfg.Bindings[shortcutPrimary] = ""
	if _, err := normalizeShortcutSettings(cfg); err != nil {
		t.Fatalf("cannot disable a shortcut: %v", err)
	}
}

func TestShortcutChangesPersistAndGlobalFailurePreservesOldBinding(t *testing.T) {
	dir := t.TempDir()
	registry := &fakeShortcutRegistry{denied: map[string]bool{}}
	c := newShortcutController(dir, registry, func() {})
	if err := c.start(); err != nil {
		t.Fatal(err)
	}
	old := c.snapshot().Bindings[shortcutGlobal]
	next := c.snapshot()
	next.Bindings[shortcutGlobal] = "CmdOrCtrl+Alt+P"
	next.Bindings[shortcutPrimary] = "CmdOrCtrl+Shift+P"
	next.SpaceEnabled = false
	registry.denied[next.Bindings[shortcutGlobal]] = true
	if err := c.apply(next); err == nil {
		t.Fatal("accepted an occupied global shortcut")
	}
	if registry.active[old] == nil || c.snapshot().Bindings[shortcutGlobal] != old {
		t.Fatal("failed registration removed the old binding")
	}
	delete(registry.denied, next.Bindings[shortcutGlobal])
	if err := c.apply(next); err != nil {
		t.Fatal(err)
	}
	if registry.active[old] != nil || registry.active[next.Bindings[shortcutGlobal]] == nil {
		t.Fatal("global binding did not switch")
	}
	reloaded := newShortcutController(dir, &fakeShortcutRegistry{}, func() {})
	got := reloaded.snapshot()
	if got.SpaceEnabled || got.Bindings[shortcutPrimary] != "CmdOrCtrl+Shift+P" || got.Bindings[shortcutGlobal] != "CmdOrCtrl+Alt+P" {
		t.Fatalf("reload: %+v", got)
	}
	// Caller edits to a snapshot must not mutate the live controller.
	got.Bindings[shortcutPrimary] = ""
	if reloaded.snapshot().Bindings[shortcutPrimary] == "" {
		t.Fatal("snapshot aliases live bindings")
	}
}

func TestShortcutWriteFailureRollsBackNewGlobalRegistration(t *testing.T) {
	registry := &fakeShortcutRegistry{}
	c := newShortcutController(t.TempDir(), registry, func() {})
	if err := c.start(); err != nil {
		t.Fatal(err)
	}
	old := c.snapshot().Bindings[shortcutGlobal]
	blocked := filepath.Join(t.TempDir(), "blocked")
	if err := os.WriteFile(blocked, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	c.dir = blocked
	next := c.snapshot()
	next.Bindings[shortcutGlobal] = "CmdOrCtrl+Alt+P"
	if err := c.apply(next); err == nil {
		t.Fatal("expected write failure")
	}
	if registry.active[old] == nil || registry.active[next.Bindings[shortcutGlobal]] != nil || c.snapshot().Bindings[shortcutGlobal] != old {
		t.Fatal("write failure changed active bindings")
	}
}

func TestShortcutRecordingSuspendsAndRestoresOnlyOwnedGlobal(t *testing.T) {
	registry := &fakeShortcutRegistry{}
	c := newShortcutController(t.TempDir(), registry, func() {})
	if err := c.start(); err != nil {
		t.Fatal(err)
	}
	key := c.snapshot().Bindings[shortcutGlobal]
	registry.active["unrelated"] = func() {}
	c.suspend()
	if registry.active[key] != nil || registry.active["unrelated"] == nil {
		t.Fatal("recording did not suspend only its own shortcut")
	}
	if err := c.resume(); err != nil {
		t.Fatal(err)
	}
	if registry.active[key] == nil {
		t.Fatal("recording did not restore global shortcut")
	}
}

func TestDisabledGlobalStaysDisabledAcrossRecordingAndRestart(t *testing.T) {
	registry := &fakeShortcutRegistry{}
	dir := t.TempDir()
	c := newShortcutController(dir, registry, func() {})
	if err := c.start(); err != nil {
		t.Fatal(err)
	}
	next := c.snapshot()
	next.Bindings[shortcutGlobal] = ""
	if err := c.apply(next); err != nil {
		t.Fatal(err)
	}
	c.suspend()
	if err := c.resume(); err != nil {
		t.Fatal(err)
	}
	if len(registry.active) != 0 {
		t.Fatal("disabled global was restored during recording")
	}
	registry = &fakeShortcutRegistry{}
	reloaded := newShortcutController(dir, registry, func() {})
	if err := reloaded.start(); err != nil {
		t.Fatal(err)
	}
	if len(registry.active) != 0 || reloaded.snapshot().Bindings[shortcutGlobal] != "" {
		t.Fatal("disabled global was restored after restart")
	}
}

func TestPartialShortcutFileKeepsDefaultsAndCorruptionDoesNotRewriteIt(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "shortcuts.json")
	if err := os.WriteFile(path, []byte(`{"bindings":{"timer-primary":"CmdOrCtrl+Shift+P"}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	c := newShortcutController(dir, &fakeShortcutRegistry{}, func() {})
	if got := c.snapshot(); !got.SpaceEnabled || got.Bindings[shortcutPrimary] != "CmdOrCtrl+Shift+P" || got.Bindings[shortcutGlobal] == "" {
		t.Fatalf("partial settings lost defaults: %+v", got)
	}
	bad := []byte(`{"bindings":`)
	if err := os.WriteFile(path, bad, 0o600); err != nil {
		t.Fatal(err)
	}
	c = newShortcutController(dir, &fakeShortcutRegistry{}, func() {})
	if c.snapshot().Bindings[shortcutPrimary] != "CmdOrCtrl+Enter" || c.status() == "" {
		t.Fatal("corrupt file did not fall back with a status")
	}
	after, _ := os.ReadFile(path)
	if string(after) != string(bad) {
		t.Fatal("loading rewrote invalid settings")
	}
}
