package main

import (
	"errors"
	"path/filepath"
)

// File dialogs run off the render callback; completions return to their own window.
func (s *nativeSettings) archiveAction(run func() (string, error), saved func()) {
	s.busy = true
	s.message, s.error = "", ""
	go func() {
		message, err := run()
		s.win.Update(func() {
			if s.win.IsDestroyed() || s.desktop.settings != s {
				return
			}
			s.busy = false
			if err == nil && message != "" && saved != nil {
				saved()
			}
			s.feedback(err, message)
		})
	}()
}

func (s *nativeSettings) exportArchive() {
	s.archiveAction(func() (string, error) {
		path, err := s.desktop.exportArchive(s.ctx, s.win)
		if err != nil || path == "" {
			return "", err
		}
		return "已导出 " + filepath.Base(path), nil
	}, nil)
}

func (s *nativeSettings) importArchive() {
	s.archiveAction(func() (string, error) {
		snap, err := s.desktop.importArchive(s.ctx, s.win)
		if errors.Is(err, errArchiveCanceled) {
			return "", nil
		}
		if err != nil || snap.Revision == 0 {
			return "", err
		}
		return "海底已恢复。", nil
	}, func() { s.resetDraft(s.desktop.a.Get().Preferences) })
}
