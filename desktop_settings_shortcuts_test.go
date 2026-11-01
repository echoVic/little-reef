package main

import (
	"path/filepath"
	"runtime"
	"testing"

	"github.com/egoist/mygo/ui"
)

func shortcutSettingsFixture(t *testing.T) (*nativeSettings, *shortcutController, *fakeShortcutRegistry, *ui.Tester) {
	t.Helper()
	a, s := settingsFixture(t)
	registry := &fakeShortcutRegistry{}
	controller := newShortcutController(filepath.Dir(a.path), registry, func() {})
	if err := controller.start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(controller.stop)
	s.desktop.shortcuts = controller
	s.shortcutDraft = controller.snapshot()
	tt := ui.NewTester(s.view, 560, 800)
	if err := tt.Click("快捷键"); err != nil {
		t.Fatal(err)
	}
	return s, controller, registry, tt
}

func TestNativeShortcutRecordingSavesAfterRelease(t *testing.T) {
	s, controller, registry, tt := shortcutSettingsFixture(t)
	global := controller.snapshot().Bindings[shortcutGlobal]
	if err := tt.Click("修改开始／暂停／继续"); err != nil {
		t.Fatal(err)
	}
	if registry.active[global] != nil {
		t.Fatal("global shortcut remained active while recording")
	}
	tt.Key(ui.Cmd|ui.Shift, ui.KeyP)
	if s.recording != "" || registry.active[global] == nil {
		t.Fatal("key release did not finish recording")
	}
	if controller.snapshot().Bindings[shortcutPrimary] != "CmdOrCtrl+Enter" {
		t.Fatal("unsaved recording changed live shortcuts")
	}
	if err := tt.Click("保存快捷键"); err != nil {
		t.Fatal(err)
	}
	if controller.snapshot().Bindings[shortcutPrimary] != "CmdOrCtrl+Shift+P" || s.error != "" {
		t.Fatalf("recording was not saved: %s", s.error)
	}
}

func TestShortcutRecordingKeepsBindingsSuspendedUntilKeyUp(t *testing.T) {
	s, controller, registry, _ := shortcutSettingsFixture(t)
	global := controller.snapshot().Bindings[shortcutGlobal]
	s.beginShortcutRecording(shortcutPrimary)
	s.shortcutInput(shortcutPrimary, ui.InputEvent{Kind: ui.InputKeyDown, Key: ui.KeyP, Mods: ui.Cmd | ui.Shift})
	if s.recording != shortcutPrimary || registry.active[global] != nil {
		t.Fatal("bindings resumed while recorded keys were held")
	}
	s.shortcutInput(shortcutPrimary, ui.InputEvent{Kind: ui.InputKeyUp, Key: ui.KeyP, Mods: ui.Cmd | ui.Shift})
	if s.recording != "" || registry.active[global] == nil {
		t.Fatal("key release did not restore bindings")
	}
}

func TestShortcutRecordingFinishesOnModifierReleaseWithoutKeyUp(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("Command-keyup fallback is macOS-specific")
	}
	s, controller, registry, tt := shortcutSettingsFixture(t)
	global := controller.snapshot().Bindings[shortcutGlobal]
	if err := tt.Click("修改开始／暂停／继续"); err != nil {
		t.Fatal(err)
	}
	tt.HoldModifiers(ui.Cmd | ui.Shift)
	s.shortcutInput(shortcutPrimary, ui.InputEvent{Kind: ui.InputKeyDown, Key: ui.KeyP, Mods: ui.Cmd | ui.Shift})
	tt.Frame()
	if s.recording == "" {
		t.Fatal("recording ended before modifiers were released")
	}
	tt.HoldModifiers(0)
	if s.recording != "" || registry.active[global] == nil {
		t.Fatal("missing Command keyup left shortcuts suspended")
	}
}

func TestShortcutRecordingWithoutCommandWaitsForKeyUp(t *testing.T) {
	s, controller, registry, tt := shortcutSettingsFixture(t)
	global := controller.snapshot().Bindings[shortcutGlobal]
	if err := tt.Click("修改开始／暂停／继续"); err != nil {
		t.Fatal(err)
	}
	tt.HoldModifiers(ui.Alt)
	s.shortcutInput(shortcutPrimary, ui.InputEvent{Kind: ui.InputKeyDown, Key: ui.KeyF11, Mods: ui.Alt})
	tt.Frame()
	tt.HoldModifiers(0)
	if s.recording == "" || registry.active[global] != nil {
		t.Fatal("non-Command chord resumed bindings before main key release")
	}
	s.shortcutInput(shortcutPrimary, ui.InputEvent{Kind: ui.InputKeyUp, Key: ui.KeyF11})
	if s.recording != "" || registry.active[global] == nil {
		t.Fatal("main key release did not restore bindings")
	}
}

func TestNativeShortcutRecordingRejectsDuplicatesAndEscapeCancels(t *testing.T) {
	s, controller, registry, tt := shortcutSettingsFixture(t)
	if err := tt.Click("修改开始／暂停／继续"); err != nil {
		t.Fatal(err)
	}
	tt.Key(ui.Cmd, ui.Key1)
	if s.recording != shortcutPrimary || s.error == "" || s.shortcutDraft.Bindings[shortcutPrimary] != "CmdOrCtrl+Enter" {
		t.Fatal("duplicate recording was accepted")
	}
	tt.Key(0, ui.KeyEscape)
	if s.recording != "" || registry.active[controller.snapshot().Bindings[shortcutGlobal]] == nil {
		t.Fatal("escape did not safely cancel recording")
	}
}

func TestNativeShortcutDisableAndRestoreDefaultsAreDrafted(t *testing.T) {
	s, controller, _, tt := shortcutSettingsFixture(t)
	if err := tt.Click("停用开始／暂停／继续"); err != nil {
		t.Fatal(err)
	}
	if s.shortcutDraft.Bindings[shortcutPrimary] != "" || controller.snapshot().Bindings[shortcutPrimary] == "" {
		t.Fatal("disable did not stay in draft")
	}
	if err := tt.Click("恢复默认快捷键"); err != nil {
		t.Fatal(err)
	}
	if s.shortcutDraft.Bindings[shortcutPrimary] != "CmdOrCtrl+Enter" || !s.shortcutDraft.SpaceEnabled {
		t.Fatal("defaults were not restored")
	}
}
