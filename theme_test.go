package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestAutomaticThemeUsesLocalTimeSlots(t *testing.T) {
	a, now := testAquarium(t)
	a.themes, _ = newThemeStore(filepath.Dir(a.path))
	if _, err := a.SetThemeAuto(true); err != nil {
		t.Fatal(err)
	}
	loc := time.FixedZone("UTC+8", 8*60*60)
	for _, tc := range []struct {
		hour, minute int
		want         string
	}{
		{0, 0, "reef-realistic"}, {5, 59, "reef-realistic"},
		{6, 0, "ct-cream"}, {9, 59, "ct-cream"},
		{10, 0, "cm-cel"}, {16, 59, "cm-cel"},
		{17, 0, "cn-qinglu"}, {19, 59, "cn-qinglu"},
		{20, 0, "reef-realistic"}, {23, 59, "reef-realistic"},
	} {
		*now = time.Date(2026, 11, 1, tc.hour, tc.minute, 0, 0, loc)
		if got := a.Get(); got.Theme != tc.want || !got.ThemeAuto {
			t.Errorf("%02d:%02d: got %s (auto=%v), want %s", tc.hour, tc.minute, got.Theme, got.ThemeAuto, tc.want)
		}
	}
}

func TestAllThemesShuffleExcludesCurrentAndCoversInstalledSkins(t *testing.T) {
	a, _ := testAquarium(t)
	a.themes, _ = newThemeStore(filepath.Dir(a.path))
	seen := map[string]bool{defaultTheme: true}
	for index := 0; index < len(a.themes.ids)-1; index++ {
		a.theme = defaultTheme
		a.roll = func(n int) int { return index % n }
		s, err := a.SetThemeShuffle(true)
		if err != nil {
			t.Fatal(err)
		}
		if s.Theme == defaultTheme || !s.ThemeShuffle || s.ThemeAuto {
			t.Fatalf("shuffle: %+v", s)
		}
		seen[s.Theme] = true
	}
	if len(seen) != len(a.themes.ids) {
		t.Fatalf("shuffle skipped installed skins: %v", seen)
	}
}

func TestThemeShuffleAndTimeScheduleAreExclusive(t *testing.T) {
	a, _ := testAquarium(t)
	a.themes, _ = newThemeStore(filepath.Dir(a.path))
	if _, err := a.SetThemeAuto(true); err != nil {
		t.Fatal(err)
	}
	shuffled, err := a.SetThemeShuffle(true)
	if err != nil {
		t.Fatal(err)
	}
	if !shuffled.ThemeShuffle || shuffled.ThemeAuto {
		t.Fatalf("both automatic modes active: %+v", shuffled)
	}
	scheduled, err := a.SetThemeAuto(true)
	if err != nil {
		t.Fatal(err)
	}
	if !scheduled.ThemeAuto || scheduled.ThemeShuffle {
		t.Fatalf("schedule did not exit shuffle: %+v", scheduled)
	}
	if _, err := a.SetThemeShuffle(true); err != nil {
		t.Fatal(err)
	}
	manual, err := a.SetTheme("ct-jelly")
	if err != nil {
		t.Fatal(err)
	}
	if manual.ThemeAuto || manual.ThemeShuffle || manual.Theme != "ct-jelly" {
		t.Fatalf("manual selection did not exit automatic modes: %+v", manual)
	}
}

func TestThemeShufflePersistsDeadlineAndRotatesWhileIdle(t *testing.T) {
	a, now := testAquarium(t)
	a.themes, _ = newThemeStore(filepath.Dir(a.path))
	a.roll = func(n int) int { return n - 1 }
	before, err := os.ReadFile(a.path)
	if err != nil {
		t.Fatal(err)
	}
	initial, err := a.SetThemeShuffle(true)
	if err != nil {
		t.Fatal(err)
	}
	cfg := a.themes.loadConfig()
	if !cfg.Shuffle || cfg.Auto || cfg.Theme != initial.Theme || cfg.NextShuffleMS != now.Add(30*time.Minute).UnixMilli() {
		t.Fatalf("shuffle setting not persisted: %+v", cfg)
	}
	var pushed []Snapshot
	a.onChange = func(s Snapshot) { pushed = append(pushed, s) }
	*now = now.Add(30*time.Minute - time.Second)
	a.tick()
	if len(pushed) != 0 || a.Get().Theme != initial.Theme {
		t.Fatal("shuffle rotated too soon")
	}
	*now = now.Add(time.Second)
	a.tick()
	if len(pushed) != 1 || pushed[0].Theme == initial.Theme || !pushed[0].ThemeShuffle || pushed[0].Revision <= initial.Revision {
		t.Fatalf("idle rotation was not published: %+v", pushed)
	}
	cfg = a.themes.loadConfig()
	if cfg.Theme != pushed[0].Theme || cfg.NextShuffleMS != now.Add(30*time.Minute).UnixMilli() {
		t.Fatalf("new theme and deadline not persisted: %+v", cfg)
	}
	reloaded, err := newAquarium(a.path)
	if err != nil {
		t.Fatal(err)
	}
	reloaded.themes = a.themes
	reloaded.theme, reloaded.themeAuto = cfg.Theme, cfg.Auto
	reloaded.themeShuffle, reloaded.nextThemeShuffleMS = cfg.Shuffle, cfg.NextShuffleMS
	reloaded.now = a.now
	reloaded.tick()
	if got := reloaded.Get(); got.Theme != cfg.Theme || !got.ThemeShuffle {
		t.Fatalf("restart changed active skin before deadline: %+v", got)
	}
	// A long sleep skips missed rotations and schedules from the wake time.
	*now = now.Add(8 * time.Hour)
	a.tick()
	if len(pushed) != 2 || pushed[1].Theme == pushed[0].Theme {
		t.Fatalf("wake did not rotate once: %+v", pushed)
	}
	a.tick()
	if len(pushed) != 2 {
		t.Fatal("wake replayed missed rotations")
	}
	disabled, err := a.SetThemeShuffle(false)
	if err != nil {
		t.Fatal(err)
	}
	*now = now.Add(time.Hour)
	a.tick()
	if got := a.Get(); got.Theme != disabled.Theme || got.ThemeShuffle || got.ThemeAuto {
		t.Fatalf("disabled shuffle changed skin: %+v", got)
	}
	after, err := os.ReadFile(a.path)
	if err != nil {
		t.Fatal(err)
	}
	if string(before) != string(after) {
		t.Fatal("theme shuffle rewrote aquarium archive")
	}
	if _, err := a.SetThemeShuffle(true); err != nil {
		t.Fatal(err)
	}
	text, err := a.ExportArchive()
	if err != nil {
		t.Fatal(err)
	}
	var shell struct {
		Aquarium map[string]json.RawMessage `json:"aquarium"`
	}
	if err := json.Unmarshal([]byte(text), &shell); err != nil {
		t.Fatal(err)
	}
	if _, ok := shell.Aquarium["themeShuffle"]; ok {
		t.Fatal("shuffle setting leaked into backup")
	}
}

func TestThemeShuffleSaveFailureKeepsCurrentSkinAndMode(t *testing.T) {
	a, now := testAquarium(t)
	a.themes, _ = newThemeStore(filepath.Dir(a.path))
	if _, err := a.SetThemeAuto(true); err != nil {
		t.Fatal(err)
	}
	before := a.Get()
	blocked := filepath.Join(t.TempDir(), "blocked")
	if err := os.WriteFile(blocked, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	originalDir := a.themes.dir
	a.themes.dir = blocked
	if _, err := a.SetThemeShuffle(true); err == nil {
		t.Fatal("expected save failure")
	}
	if got := a.Get(); got.Theme != before.Theme || !got.ThemeAuto || got.ThemeShuffle || got.Revision != before.Revision {
		t.Fatalf("failed enable changed mode: %+v", got)
	}
	a.themes.dir = originalDir
	if _, err := a.SetThemeShuffle(true); err != nil {
		t.Fatal(err)
	}
	before = a.Get()
	a.themes.dir = blocked
	*now = now.Add(time.Hour)
	a.tick()
	if got := a.Get(); got.Theme != before.Theme || !got.ThemeShuffle || got.Revision != before.Revision {
		t.Fatalf("failed scheduled save changed theme: %+v", got)
	}
	a.themes.dir = originalDir
	a.tick()
	if a.Get().Theme == before.Theme {
		t.Fatal("rotation did not recover after write failure")
	}
}

func TestAutomaticThemePublishesWithoutRunningTimer(t *testing.T) {
	for _, status := range []string{"idle", "paused", "complete", "running"} {
		t.Run(status, func(t *testing.T) {
			a, now := testAquarium(t)
			a.themes, _ = newThemeStore(filepath.Dir(a.path))
			*now = time.Date(2026, 11, 1, 9, 59, 59, 0, time.Local)
			if _, err := a.SetThemeAuto(true); err != nil {
				t.Fatal(err)
			}
			a.state.Session.Status = status
			a.segment, a.lastTick = *now, *now
			before := a.Get()
			var pushed []Snapshot
			a.onChange = func(s Snapshot) { pushed = append(pushed, s) }
			*now = now.Add(time.Second)
			a.tick()
			if len(pushed) != 1 || pushed[0].Theme != "cm-cel" || pushed[0].Revision <= before.Revision {
				t.Fatalf("theme boundary was not published: %+v", pushed)
			}
			if pushed[0].Session.Status != status {
				t.Fatalf("theme switch changed timer: %+v", pushed[0].Session)
			}
			if status != "running" {
				a.tick()
				if len(pushed) != 1 {
					t.Fatal("unchanged theme should not be republished")
				}
			}
		})
	}
}

func TestThemeAutoPersistsAndManualChoiceDisablesIt(t *testing.T) {
	a, now := testAquarium(t)
	a.themes, _ = newThemeStore(filepath.Dir(a.path))
	before, err := os.ReadFile(a.path)
	if err != nil {
		t.Fatal(err)
	}
	first := a.Get()
	enabled, err := a.SetThemeAuto(true)
	if err != nil {
		t.Fatal(err)
	}
	if !enabled.ThemeAuto || enabled.Theme != "cm-cel" || enabled.Revision <= first.Revision {
		t.Fatalf("enable: %+v", enabled)
	}
	cfg := a.themes.loadConfig()
	if !cfg.Auto {
		t.Fatal("automatic setting did not survive reload")
	}
	// Restart at a different time must resolve that time's theme immediately.
	reloaded, err := newAquarium(a.path)
	if err != nil {
		t.Fatal(err)
	}
	reloaded.themes = a.themes
	reloaded.theme, reloaded.themeAuto = cfg.Theme, cfg.Auto
	reloaded.now = func() time.Time { return time.Date(2026, 11, 1, 21, 0, 0, 0, time.Local) }
	if got := reloaded.Get(); !got.ThemeAuto || got.Theme != "reef-realistic" {
		t.Fatalf("restart: %+v", got)
	}
	manual, err := a.SetTheme("ct-jelly")
	if err != nil {
		t.Fatal(err)
	}
	if manual.ThemeAuto || manual.Theme != "ct-jelly" || manual.Revision <= enabled.Revision {
		t.Fatalf("manual: %+v", manual)
	}
	if cfg := a.themes.loadConfig(); cfg.Auto || cfg.Theme != "ct-jelly" {
		t.Fatalf("saved manual choice: %+v", cfg)
	}
	*now = now.Add(12 * time.Hour)
	a.tick()
	if a.Get().Theme != "ct-jelly" {
		t.Fatal("automatic schedule overrode manual selection")
	}
	if _, err := a.SetThemeAuto(true); err != nil {
		t.Fatal(err)
	}
	disabled, err := a.SetThemeAuto(false)
	if err != nil {
		t.Fatal(err)
	}
	*now = now.Add(12 * time.Hour)
	a.tick()
	if got := a.Get(); got.ThemeAuto || got.Theme != disabled.Theme {
		t.Fatalf("disabled mode did not keep current theme: %+v", got)
	}
	after, err := os.ReadFile(a.path)
	if err != nil {
		t.Fatal(err)
	}
	if string(before) != string(after) {
		t.Fatal("theme mode rewrote aquarium archive")
	}
	text, err := a.ExportArchive()
	if err != nil {
		t.Fatal(err)
	}
	var shell struct {
		Aquarium map[string]json.RawMessage `json:"aquarium"`
	}
	if err := json.Unmarshal([]byte(text), &shell); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"theme", "themeAuto"} {
		if _, ok := shell.Aquarium[key]; ok {
			t.Fatalf("%s leaked into backup", key)
		}
	}
}

func TestThemeAutoKeepsLegacyChoiceAndRollsBackFailedSave(t *testing.T) {
	a, _ := testAquarium(t)
	a.themes, _ = newThemeStore(filepath.Dir(a.path))
	if err := os.WriteFile(filepath.Join(a.themes.dir, "theme.json"), []byte(`{"theme":"ct-jelly"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg := a.themes.loadConfig()
	if cfg.Theme != "ct-jelly" || cfg.Auto {
		t.Fatalf("legacy theme: %+v", cfg)
	}
	before := a.Get()
	// A file in place of the data directory makes the atomic save fail.
	blocked := filepath.Join(t.TempDir(), "blocked")
	if err := os.WriteFile(blocked, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	a.themes.dir = blocked
	if _, err := a.SetThemeAuto(true); err == nil {
		t.Fatal("expected write failure")
	}
	if got := a.Get(); got.ThemeAuto || got.Theme != before.Theme || got.Revision != before.Revision {
		t.Fatalf("failed write changed live theme: %+v", got)
	}
}

func TestThemeSwitchNeverTouchesArchiveBytes(t *testing.T) {
	dir := t.TempDir()
	a, err := newAquarium(filepath.Join(dir, "aquarium.json"))
	if err != nil {
		t.Fatal(err)
	}
	store, err := newThemeStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	a.themes = store
	a.theme = store.load()
	// Give the archive real business data so the red line means something.
	if _, err := a.Start("focus", "写主题测试"); err != nil {
		t.Fatal(err)
	}
	if _, err := a.Pause(); err != nil {
		t.Fatal(err)
	}
	before, err := os.ReadFile(filepath.Join(dir, "aquarium.json"))
	if err != nil {
		t.Fatal(err)
	}
	hash := sha256.Sum256(before)

	valid := store.ids[0]
	for i := 0; i < 100; i++ {
		id := valid
		if i%3 == 1 {
			id = "not-a-real-theme"
		}
		if i%3 == 2 {
			id = valid
		}
		if _, err := a.SetTheme(id); err != nil && id == valid {
			t.Fatalf("第 %d 次合法切换失败: %v", i, err)
		}
	}

	after, err := os.ReadFile(filepath.Join(dir, "aquarium.json"))
	if err != nil {
		t.Fatal(err)
	}
	if got := sha256.Sum256(after); got != hash {
		t.Fatalf("aquarium.json 被主题切换改动了\n前: %s\n后: %s",
			hex.EncodeToString(hash[:]), hex.EncodeToString(got[:]))
	}

	// No atomic-write temp files left behind in the data directory.
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if matched, _ := filepath.Match(".*.tmp", e.Name()); matched {
			t.Fatalf("切换留下了临时文件 %s", e.Name())
		}
	}

	// The illegal ids must have been ignored; the persisted choice is the
	// last legal one, and survives a reload.
	if got := store.load(); got != valid {
		t.Fatalf("theme.json 应为 %s，实际 %s", valid, got)
	}
}

func TestThemeStoreRejectsUnknownAndKeepsDefault(t *testing.T) {
	dir := t.TempDir()
	store, err := newThemeStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	if store.load() != defaultTheme {
		t.Fatal("无 theme.json 时应回退默认主题")
	}
	if err := store.set("bogus"); err == nil {
		t.Fatal("非法 id 写入应被拒绝")
	}
	if store.load() != defaultTheme {
		t.Fatal("非法写入后仍应保持默认主题")
	}
}
