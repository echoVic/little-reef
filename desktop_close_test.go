package main

import "testing"

func TestHandleWindowClose(t *testing.T) {
	cases := []struct {
		name     string
		quitting bool
		allow    bool
		intercept bool
	}{
		{"quitting true -> allow real quit", true, true, false},
		{"quitting false -> intercept hide", false, false, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			allow, intercept := handleWindowClose(c.quitting)
			if allow != c.allow || intercept != c.intercept {
				t.Fatalf("handleWindowClose(%v) = (%v,%v), want (%v,%v)",
					c.quitting, allow, intercept, c.allow, c.intercept)
			}
		})
	}
}
