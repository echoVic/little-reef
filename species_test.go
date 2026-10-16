package main

import (
	"io/fs"
	"math/rand/v2"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// completeRound runs one focus round to completion.
func completeRound(t *testing.T, a *Aquarium, now *time.Time) Snapshot {
	t.Helper()
	if _, err := a.Start("focus", ""); err != nil {
		t.Fatal(err)
	}
	advance(a, now, 61)
	return a.Get()
}

func TestSpeciesRosterIsComplete(t *testing.T) {
	if len(species) != 15 || species[0].Species != "clown" {
		t.Fatalf("roster: %+v", species)
	}
	seen := map[string]bool{}
	for _, s := range species {
		if s.Species == "" || s.Name == "" || seen[s.Species] {
			t.Errorf("bad or duplicate species: %+v", s)
		}
		seen[s.Species] = true
	}
}

// The page must know how to draw every species the backend can send.
func TestFrontendKnowsEverySpecies(t *testing.T) {
	data, err := fs.ReadFile(frontend, "web/creatures/species.js")
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range species {
		if !strings.Contains(string(data), `id: "`+s.Species+`"`) {
			t.Errorf("species.js has no %q", s.Species)
		}
	}
}

func TestVisitorsArriveUnmetFirst(t *testing.T) {
	a, now := testAquarium(t)
	pick := rand.New(rand.NewPCG(1, 2))
	// Every round brings a visitor; who comes is still left to chance.
	a.roll = func(n int) int {
		if n == 3 {
			return 0
		}
		return pick.IntN(n)
	}
	for round := 1; round <= len(species); round++ {
		s := completeRound(t, a, now)
		if len(s.Visitors) != round {
			t.Fatalf("round %d: %d visitors, want a new species every round: %+v", round, len(s.Visitors), s.Visitors)
		}
		if round == 1 && s.Visitors[0].Species != "clown" {
			t.Fatalf("first visitor %q, want clown", s.Visitors[0].Species)
		}
	}
	s := completeRound(t, a, now)
	visits := 0
	for _, v := range s.Visitors {
		visits += v.Visits
	}
	if len(s.Visitors) != len(species) || visits != len(species)+1 {
		t.Fatalf("after everyone has visited: %d species, %d visits", len(s.Visitors), visits)
	}
}

func TestOldSaveMeetsNewSpecies(t *testing.T) {
	path := filepath.Join(t.TempDir(), "aquarium.json")
	old := `{"preferences":{"focusMinutes":1,"breakMinutes":1,"sound":"waves","volume":0.35,"chimeEnabled":true},
"session":{"id":1,"kind":"focus","status":"idle","durationMs":60000},"completed":4,
"visitors":[{"species":"clown","name":"小丑鱼","date":"2026-10-10T10:00:00+08:00","visits":2},
{"species":"tang","name":"蓝吊鱼","date":"2026-10-11T10:00:00+08:00","visits":1},
{"species":"angel","name":"神仙鱼","date":"2026-10-12T10:00:00+08:00","visits":1},
{"species":"puffer","name":"小河豚","date":"2026-10-13T10:00:00+08:00","visits":1}]}`
	if err := os.WriteFile(path, []byte(old), 0o600); err != nil {
		t.Fatal(err)
	}
	a, err := newAquarium(path)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 15, 10, 0, 0, 0, time.Local)
	a.now = func() time.Time { return now }
	a.roll = func(int) int { return 0 }
	s := completeRound(t, a, &now)
	if len(s.Visitors) != 5 || s.Visitors[4].Species != "cleaner" || s.Visitors[0].Visits != 2 {
		t.Fatalf("old save after a round: %+v", s.Visitors)
	}
}
