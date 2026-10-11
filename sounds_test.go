package main

import (
	"io/fs"
	"testing"
)

// Every sound except pink noise plays an embedded recording, and together
// they stay within the 30 MB budget.
func TestEveryRecordedSoundIsEmbedded(t *testing.T) {
	total := 0
	for _, kind := range advertisedSounds {
		if kind == "pink" {
			continue // synthesized in the page
		}
		data, err := fs.ReadFile(frontend, "web/sounds/"+kind+".mp3")
		if err != nil {
			t.Errorf("sound %q has no recording: %v", kind, err)
			continue
		}
		// An MPEG audio frame starts with eleven set sync bits.
		if len(data) < 64<<10 || data[0] != 0xFF || data[1]&0xE0 != 0xE0 {
			t.Errorf("sound %q: %d bytes, not an MP3 recording", kind, len(data))
		}
		total += len(data)
	}
	if total > 30<<20 {
		t.Errorf("recordings take %.1f MB, over the 30 MB budget", float64(total)/(1<<20))
	}
}
