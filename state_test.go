package main

import (
	"path/filepath"
	"testing"
	"time"
)

func testAquarium(t *testing.T) (*Aquarium, *time.Time) {
	t.Helper()
	a, err := newAquarium(filepath.Join(t.TempDir(), "aquarium.json"))
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 9, 10, 0, 0, 0, time.Local)
	a.now = func() time.Time { return now }
	p := a.Get().Preferences
	p.FocusMinutes, p.BreakMinutes = 1, 1
	if _, err = a.SetPreferences(p); err != nil {
		t.Fatal(err)
	}
	return a, &now
}

func advance(a *Aquarium, now *time.Time, seconds int) {
	for range seconds {
		*now = now.Add(time.Second)
		a.tick()
	}
}

func TestPauseResumeAndEarlyEndPreserveOnlyActiveTime(t *testing.T) {
	a, now := testAquarium(t)
	if _, err := a.Start("focus", "读书"); err != nil {
		t.Fatal(err)
	}
	advance(a, now, 10)
	if _, err := a.Pause(); err != nil {
		t.Fatal(err)
	}
	*now = now.Add(time.Hour)
	if _, err := a.Resume(); err != nil {
		t.Fatal(err)
	}
	advance(a, now, 5)
	s, err := a.End()
	if err != nil {
		t.Fatal(err)
	}
	if s.TotalSecs != 15 || s.Completed != 0 || len(s.Records) != 1 || s.Records[0].Completed {
		t.Fatalf("early-end record: %+v", s)
	}
}

func TestCompletionAwardsOnceAndVisitorSurvivesRestart(t *testing.T) {
	a, now := testAquarium(t)
	if _, err := a.Start("focus", "第一轮"); err != nil {
		t.Fatal(err)
	}
	advance(a, now, 65)
	s := a.Get()
	if s.Session.Status != "complete" || s.Completed != 1 || s.TotalSecs != 60 || len(s.Visitors) != 1 || s.TodayRounds != 1 {
		t.Fatalf("completion: %+v", s)
	}
	reloaded, err := newAquarium(a.path)
	if err != nil {
		t.Fatal(err)
	}
	r := reloaded.Get()
	if r.Completed != 1 || r.Visitors[0].Species != "clown" || r.TotalSecs != 60 {
		t.Fatalf("lost growth: %+v", r)
	}
}

func TestLongSchedulingGapPausesWithoutOfflineGrowth(t *testing.T) {
	a, now := testAquarium(t)
	if _, err := a.Start("focus", ""); err != nil {
		t.Fatal(err)
	}
	advance(a, now, 8)
	*now = now.Add(time.Hour)
	a.tick()
	s := a.Get()
	if s.Session.Status != "paused" || s.Session.ElapsedMS != 8000 || s.Completed != 0 {
		t.Fatalf("sleep counted: %+v", s)
	}
}

func TestRestartPausesRunningTimerAndRestoresPreferences(t *testing.T) {
	a, now := testAquarium(t)
	p := a.Get().Preferences
	p.Sound, p.Volume, p.SoundEnabled = "rain", .7, true
	if _, err := a.SetPreferences(p); err != nil {
		t.Fatal(err)
	}
	if _, err := a.Start("focus", ""); err != nil {
		t.Fatal(err)
	}
	advance(a, now, 12)
	if _, err := a.SetPreferences(p); err != nil {
		t.Fatal(err)
	}
	b, err := newAquarium(a.path)
	if err != nil {
		t.Fatal(err)
	}
	s := b.Get()
	if s.Session.Status != "paused" || s.Session.ElapsedMS != 12000 || s.Preferences.Sound != "rain" || s.Preferences.Volume != .7 {
		t.Fatalf("restart: %+v", s)
	}
}

func TestBreakDoesNotAwardGrowthAndFeedIsOnce(t *testing.T) {
	a, now := testAquarium(t)
	if _, err := a.Start("break", ""); err != nil {
		t.Fatal(err)
	}
	if _, err := a.Feed(); err != nil {
		t.Fatal(err)
	}
	if _, err := a.Feed(); err == nil {
		t.Fatal("double feeding accepted")
	}
	advance(a, now, 60)
	s := a.Get()
	if s.Completed != 0 || s.TotalSecs != 0 || len(s.Records) != 0 || s.Session.Status != "complete" {
		t.Fatalf("break growth: %+v", s)
	}
}

func TestInvalidSettingsAndSaveFailureDoNotMutateState(t *testing.T) {
	a, _ := testAquarium(t)
	p := a.Get().Preferences
	p.FocusMinutes = 0
	if _, err := a.SetPreferences(p); err == nil {
		t.Fatal("invalid duration accepted")
	}
	if a.Get().Preferences.FocusMinutes != 1 {
		t.Fatal("invalid settings mutated state")
	}
	// A directory as the target path makes atomic rename fail deterministically.
	a.path = filepath.Dir(a.path)
	if _, err := a.Start("focus", ""); err == nil {
		t.Fatal("save failure not reported")
	}
	if a.Get().Session.Status != "idle" {
		t.Fatal("failed save started the timer")
	}
}

func TestEveryAdvertisedSoundIsAccepted(t *testing.T) {
	p := Preferences{FocusMinutes: 25, BreakMinutes: 5, Volume: .5}
	for _, kind := range []string{"waves", "rain", "bubbles", "wind", "fire", "stream", "pink", "clock", "boil", "knock", "thunder", "cafe", "musicbox", "morning", "summer", "night", "forest", "deepsea", "desert", "traffic"} {
		p.Sound = kind
		if err := validatePreferences(p); err != nil {
			t.Errorf("sound %q rejected: %v", kind, err)
		}
	}
	p.Sound = "volcano"
	if err := validatePreferences(p); err == nil {
		t.Error("unknown sound accepted")
	}
}
