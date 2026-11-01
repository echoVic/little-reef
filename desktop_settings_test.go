package main

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
)

func settingsFixture(t *testing.T) (*Aquarium, *nativeSettings) {
	t.Helper()
	a, _ := testAquarium(t)
	var err error
	a.themes, err = newThemeStore(filepath.Dir(a.path))
	if err != nil {
		t.Fatal(err)
	}
	s := newNativeSettings(&Desktop{a: a})
	t.Cleanup(s.cancel)
	return a, s
}

func TestNativeSettingsSavePreservesLiveAudioAndCurrentTimer(t *testing.T) {
	a, s := settingsFixture(t)
	if _, err := a.Start("focus", "native settings"); err != nil {
		t.Fatal(err)
	}
	before := a.Get().Session
	s.focusMinutes, s.breakMinutes, s.chime = "42", "7", false
	live := a.Get().Preferences
	live.Sound, live.Volume, live.SoundEnabled = "rain", .8, true
	if _, err := a.SetPreferences(live); err != nil {
		t.Fatal(err)
	}
	tt := ui.NewTester(s.view, 560, 800)
	if err := tt.Click("保存设置"); err != nil {
		t.Fatal(err)
	}
	got := a.Get()
	if got.Preferences.FocusMinutes != 42 || got.Preferences.BreakMinutes != 7 || got.Preferences.ChimeEnabled {
		t.Fatalf("native draft not saved: %+v", got.Preferences)
	}
	if got.Preferences.Sound != "rain" || got.Preferences.Volume != .8 || !got.Preferences.SoundEnabled {
		t.Fatalf("save clobbered live audio: %+v", got.Preferences)
	}
	if got.Session.DurationMS != before.DurationMS || got.Session.ID != before.ID {
		t.Fatalf("settings changed current timer: %+v", got.Session)
	}
	if s.error != "" || !tt.HasText("设置已保存，时长从下一轮生效。") {
		t.Fatalf("save feedback: %s / %v", s.error, tt.Texts())
	}
}

func TestNativeSettingsDraftSurvivesUpdatesAndRejectsInvalidDuration(t *testing.T) {
	a, s := settingsFixture(t)
	s.focusMinutes = "0"
	tt := ui.NewTester(s.view, 560, 800)
	before := a.Get().Preferences
	tt.Frame()
	if s.focusMinutes != "0" {
		t.Fatal("snapshot refresh reset unsaved input")
	}
	if err := tt.Click("保存设置"); err != nil {
		t.Fatal(err)
	}
	if a.Get().Preferences != before || s.error == "" {
		t.Fatalf("invalid draft saved or reported success: %+v / %s", a.Get().Preferences, s.error)
	}
	if reopened := newNativeSettings(s.desktop); reopened.focusMinutes != "1" {
		t.Fatal("reopening did not read saved preferences")
	}
}

func TestNativeSettingsCanEditFieldsAndReportsFailedSave(t *testing.T) {
	a, s := settingsFixture(t)
	tt := ui.NewTester(s.view, 560, 800)
	if err := tt.Click("专注时长"); err != nil {
		t.Fatal(err)
	}
	tt.Key(ui.Cmd, ui.KeyA)
	tt.Type("42")
	if s.focusMinutes != "42" {
		t.Fatalf("native field did not accept keyboard input: %q", s.focusMinutes)
	}
	before := a.Get().Preferences
	blocked := filepath.Join(t.TempDir(), "blocked")
	if err := os.WriteFile(blocked, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	a.path = filepath.Join(blocked, "aquarium.json")
	if err := tt.Click("保存设置"); err != nil {
		t.Fatal(err)
	}
	if s.error == "" || a.Get().Preferences != before || s.message != "" {
		t.Fatalf("failed write reported success: %s / %+v", s.error, a.Get().Preferences)
	}
}

func TestNativeSettingsCanceledImportCannotReplaceAquarium(t *testing.T) {
	a, s := settingsFixture(t)
	archive, err := a.ExportArchive()
	if err != nil {
		t.Fatal(err)
	}
	p := a.Get().Preferences
	p.FocusMinutes = 42
	if _, err := a.SetPreferences(p); err != nil {
		t.Fatal(err)
	}
	before := a.Get()
	s.cancel()
	if _, err := a.importArchive(s.ctx, archive); !errors.Is(err, context.Canceled) {
		t.Fatalf("closed settings import: %v", err)
	}
	if got := a.Get(); got.Preferences != before.Preferences || got.Revision != before.Revision {
		t.Fatalf("canceled import changed aquarium: %+v", got)
	}
}

func TestNativeSettingsThemeMenuAndAutomaticModes(t *testing.T) {
	a, s := settingsFixture(t)
	s.focusMinutes = "42"
	tt := ui.NewTester(s.view, 560, 800)
	if err := tt.Click("外观"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("随时间自动切换主题"); err != nil {
		t.Fatal(err)
	}
	if !a.Get().ThemeAuto {
		t.Fatalf("native schedule switch did not enable: feedback=%s / %s; texts=%v", s.error, s.message, tt.Texts())
	}
	if err := tt.Click("全部主题随机轮换"); err != nil {
		t.Fatal(err)
	}
	if snap := a.Get(); !snap.ThemeShuffle || snap.ThemeAuto {
		t.Fatalf("native modes not exclusive: %+v", snap)
	}
	if err := tt.Click(a.themes.names[a.Get().Theme]); err != nil {
		t.Fatal(err)
	}
	if len(tt.Menu()) != len(a.themes.ids) {
		t.Fatalf("theme menu missing skins: %v", tt.Menu())
	}
	if err := tt.ChooseMenuItem("马卡龙"); err != nil {
		t.Fatal(err)
	}
	if snap := a.Get(); snap.Theme != "ct-cream" || snap.ThemeAuto || snap.ThemeShuffle {
		t.Fatalf("native skin selection did not exit auto: %+v", snap)
	}
	if s.focusMinutes != "42" {
		t.Fatal("theme changes reset unsaved durations")
	}
}

func TestApplicationMenuExposesNativeSettingsAndStandardRoles(t *testing.T) {
	a, _ := testAquarium(t)
	d := &Desktop{a: a}
	m := d.applicationMenu()
	var settings, update *mygo.MenuItem
	for _, item := range m[0].Submenu {
		if item.ID == "settings" {
			settings = item
		}
		if item.ID == "check-update" {
			update = item
		}
	}
	if settings == nil || settings.Label != "设置…" || settings.Accelerator != "CmdOrCtrl+," || settings.Click == nil {
		t.Fatalf("missing settings menu shortcut: %+v", settings)
	}
	if update == nil {
		t.Fatal("check updates missing from app menu")
	}
	app := m[0]
	if app.Role != mygo.RoleAppMenu {
		t.Fatal("settings must live in application dropdown")
	}
	found := false
	for _, item := range app.Submenu {
		if item == settings {
			found = true
		}
	}
	if !found {
		t.Fatal("settings is outside application menu")
	}
	for _, role := range []mygo.MenuRole{mygo.RoleAbout, mygo.RoleServices, mygo.RoleHide, mygo.RoleHideOthers, mygo.RoleUnhide, mygo.RoleQuit} {
		found = false
		for _, item := range app.Submenu {
			if item.Role == role {
				found = true
			}
		}
		if !found {
			t.Fatalf("application menu lost standard role %s", role)
		}
	}
}
