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

// A Monday in the middle of a month gives clear week/month boundaries for the
// aggregation tests below.
func mondayClock() time.Time { return time.Date(2026, 10, 26, 10, 0, 0, 0, time.Local) }

func TestWeeklyMonthlyAndDayAggregation(t *testing.T) {
	a, _ := testAquarium(t)
	now := mondayClock()
	a.now = func() time.Time { return now }
	a.state.Completed = 4
	a.state.Records = []Record{
		{ID: 1, Task: "a", Seconds: 600, Completed: true, Date: "2026-10-26T09:00:00+08:00"},  // today (Monday), this week, this month
		{ID: 2, Task: "b", Seconds: 1200, Completed: false, Date: "2026-10-25T21:00:00+08:00"}, // Sunday last week, this month
		{ID: 3, Task: "c", Seconds: 1800, Completed: true, Date: "2026-10-20T09:00:00+08:00"}, // Tuesday last week, this month
		{ID: 4, Task: "d", Seconds: 2400, Completed: true, Date: "2026-09-26T09:00:00+08:00"}, // last month, same day-of-month
		{ID: 5, Task: "e", Seconds: 300, Completed: true, Date: "2026-10-26T20:00:00+08:00"}, // another record the same day
	}
	s := a.Get()
	// Today: both records on 10-26; the early-end record on 10-25 does not count.
	if s.TodaySecs != 900 || s.TodayRounds != 2 {
		t.Fatalf("today: %+v", s)
	}
	// This week (Mon 10-26 .. Sun 11-01): only the two records on 10-26.
	if s.WeekSecs != 900 || s.WeekRounds != 2 || s.WeekDays != 1 {
		t.Fatalf("week: secs=%d rounds=%d days=%d", s.WeekSecs, s.WeekRounds, s.WeekDays)
	}
	// This month: everything from October; the early-end record counts seconds, not rounds.
	if s.MonthSecs != 3900 || s.MonthRounds != 3 {
		t.Fatalf("month: secs=%d rounds=%d", s.MonthSecs, s.MonthRounds)
	}
	// Distinct days across the kept records: 10-26, 10-25, 10-20, 09-26.
	if s.TotalDays != 4 {
		t.Fatalf("total days: %d", s.TotalDays)
	}
}

func TestInProgressSessionCountsTodayOnly(t *testing.T) {
	a, _ := testAquarium(t)
	now := mondayClock()
	a.now = func() time.Time { return now }
	a.state.Records = []Record{
		{ID: 1, Task: "a", Seconds: 600, Completed: true, Date: "2026-10-26T09:00:00+08:00"},
	}
	// A running session adds its elapsed time to today, but never to week/month.
	a.state.Session = Session{Kind: "focus", Status: "running", DurationMS: 600000, ElapsedMS: 120000}
	a.segment = now
	s := a.Get()
	if s.TodaySecs != 720 || s.WeekSecs != 600 || s.MonthSecs != 600 {
		t.Fatalf("running session leaked into period stats: %+v", s)
	}
}

func TestNextTierDistance(t *testing.T) {
	a, _ := testAquarium(t)
	for completed, want := range map[int]int{0: 3, 2: 1, 5: 7, 11: 1, 23: 1, 24: 0, 40: 0} {
		a.state.Completed = completed
		if got := a.Get().NextTier; got != want {
			t.Fatalf("completed %d: next tier %d, want %d", completed, got, want)
		}
	}
}

func TestAggregationSurvivesThousandRecordTruncation(t *testing.T) {
	a, _ := testAquarium(t)
	now := mondayClock()
	a.now = func() time.Time { return now }
	// Pre-existing state can hold up to 1000 records (recordLocked trims on write).
	// Aggregation must not choke at that scale.
	records := make([]Record, 0, 1000)
	for i := 0; i < 1000; i++ {
		records = append(records, Record{ID: int64(i), Seconds: 60, Completed: true, Date: "2026-10-26T09:00:00+08:00"})
	}
	a.state.Records = records
	s := a.Get()
	if s.TotalDays != 1 || s.WeekSecs != 60000 || s.WeekRounds != 1000 || s.MonthRounds != 1000 {
		t.Fatalf("truncated aggregation: days=%d week=%d/%d month=%d", s.TotalDays, s.WeekSecs, s.WeekRounds, s.MonthRounds)
	}
}

// advertisedSounds pins the sound panel's choices, in the order index.html lists them.
var advertisedSounds = []string{"waves", "rain", "thunder", "stream", "bubbles", "boil", "deepsea", "wind", "fire", "forest", "summer", "night", "desert", "morning", "clock", "knock", "cafe", "musicbox", "traffic", "pink"}

func TestEveryAdvertisedSoundIsAccepted(t *testing.T) {
	p := Preferences{FocusMinutes: 25, BreakMinutes: 5, Volume: .5}
	for _, kind := range advertisedSounds {
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
