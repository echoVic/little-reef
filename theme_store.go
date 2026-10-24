package main

import (
	"embed"
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
)

// Themes live inside the frontend bundle so the desktop never needs network
// access to offer a palette; each folder is one self-contained contract.
//
//go:embed web/themes
var themesFS embed.FS

const defaultTheme = "reef-realistic"

type themeMeta struct {
	ThemeID     string `json:"themeId"`
	DisplayName string `json:"displayName"`
	StyleFamily string `json:"styleFamily"`
}

type themeRecord struct {
	ID     string
	Name   string
	Family string
}

// installedThemes lists every bundled theme in load order.
func installedThemes() ([]themeRecord, error) {
	entries, err := fs.ReadDir(themesFS, "web/themes")
	if err != nil {
		return nil, err
	}
	var out []themeRecord
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		data, err := fs.ReadFile(themesFS, filepath.Join("web/themes", e.Name(), "theme.json"))
		if err != nil {
			return nil, err
		}
		var meta struct {
			Meta themeMeta `json:"meta"`
		}
		if err := json.Unmarshal(data, &meta); err != nil {
			return nil, err
		}
		if meta.Meta.ThemeID != e.Name() {
			return nil, errors.New("theme " + e.Name() + " 与目录名不一致")
		}
		out = append(out, themeRecord{ID: meta.Meta.ThemeID, Name: meta.Meta.DisplayName, Family: meta.Meta.StyleFamily})
	}
	return out, nil
}

// themeStore persists only the chosen theme id in the data directory. It is
// deliberately a separate file: the aquarium archive must stay byte-for-byte
// identical no matter how often the user switches palettes.
type themeStore struct {
	dir   string
	ids   []string
	names map[string]string
	families map[string]string
}

func newThemeStore(dir string) (*themeStore, error) {
	installed, err := installedThemes()
	if err != nil {
		return nil, err
	}
	s := &themeStore{dir: dir, names: map[string]string{}, families: map[string]string{}}
	for _, t := range installed {
		s.ids = append(s.ids, t.ID)
		s.names[t.ID] = t.Name
		s.families[t.ID] = t.Family
	}
	if !s.valid(defaultTheme) {
		return nil, errors.New("默认主题 reef-realistic 未随应用打包")
	}
	return s, nil
}

func (s *themeStore) valid(id string) bool { return slices.Contains(s.ids, id) }

// ThemeOption is one selectable entry for the settings picker.
type ThemeOption struct {
	ID     string `json:"id"`
	Name   string `json:"displayName"`
	Family string `json:"styleFamily"`
}

// list returns every bundled theme in load order.
func (s *themeStore) list() []ThemeOption {
	out := make([]ThemeOption, 0, len(s.ids))
	for _, id := range s.ids {
		out = append(out, ThemeOption{ID: id, Name: s.names[id], Family: s.families[id]})
	}
	return out
}

// load reads the saved choice; a missing or unreadable file falls back to the
// default theme, and an unknown id (e.g. uninstalled build) does the same.
func (s *themeStore) load() string {
	data, err := os.ReadFile(filepath.Join(s.dir, "theme.json"))
	if err != nil {
		return defaultTheme
	}
	var cfg struct {
		Theme string `json:"theme"`
	}
	if json.Unmarshal(data, &cfg) != nil || !s.valid(cfg.Theme) {
		return defaultTheme
	}
	return cfg.Theme
}

// set writes the choice atomically, mirroring saveLocked so a crash never
// leaves a half-written preferences file.
func (s *themeStore) set(id string) error {
	if !s.valid(id) {
		return errors.New("未知的主题")
	}
	if err := os.MkdirAll(s.dir, 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(struct {
		Theme string `json:"theme"`
	}{id}, "", "  ")
	if err != nil {
		return err
	}
	f, err := os.CreateTemp(s.dir, ".theme-*.tmp")
	if err != nil {
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	if _, err = f.Write(data); err != nil {
		f.Close()
		return err
	}
	if err = f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return os.Rename(name, filepath.Join(s.dir, "theme.json"))
}
