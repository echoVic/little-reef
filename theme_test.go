package main

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
)

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
