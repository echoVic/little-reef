package main

import "testing"

func TestNeedsStartupFullReset(t *testing.T) {
	cases := []struct {
		name string
		w, h int
		want bool
	}{
		// Compact-mode rect left by SetCompact(true): must reset to full.
		{"compact 400x350", 400, 350, true},
		// Barely-below minimum either axis: still reset (too narrow/tall to
		// be a real full window).
		{"width below min", 759, 800, true},
		{"height below min", 1100, 679, true},
		// Exactly at minimum: keep (user may have sized the window to min).
		{"at minimum", fullMinWidth, fullMinHeight, false},
		// Default full-size: keep.
		{"default 1100x800", fullWidth, fullHeight, false},
		// User-resized large window: keep, don't fight their placement.
		{"wide 1400x900", 1400, 900, false},
		// Zero/negative (shouldn't happen, but be defensive): treat as reset.
		{"zero", 0, 0, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := needsStartupFullReset(c.w, c.h); got != c.want {
				t.Errorf("needsStartupFullReset(%d,%d) = %v, want %v", c.w, c.h, got, c.want)
			}
		})
	}
}
