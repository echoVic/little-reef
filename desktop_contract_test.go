package main

import (
	"encoding/json"
	"testing"
	"time"
)

func TestAudioRequestEventZeroVolumeMarshalsField(t *testing.T) {
	v := 0.0
	ev := AudioRequestEvent{RequestID: "r1", Command: "set-volume", Volume: &v}
	b, err := json.Marshal(ev)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatal(err)
	}
	if _, ok := m["volume"]; !ok {
		t.Fatalf("set-volume:0 must emit volume field, got %s", b)
	}
	if m["volume"].(float64) != 0 {
		t.Fatalf("volume should be 0, got %v", m["volume"])
	}
}

func TestAudioRequestEventToggleOmitsVolume(t *testing.T) {
	ev := AudioRequestEvent{RequestID: "r1", Command: "toggle"}
	b, _ := json.Marshal(ev)
	var m map[string]any
	json.Unmarshal(b, &m)
	if _, ok := m["volume"]; ok {
		t.Fatalf("toggle must not emit volume, got %s", b)
	}
}

func TestRequestStateRealTimerTimeout(t *testing.T) {
	var r requestState
	if !r.begin("r-timer", 100*time.Millisecond) {
		t.Fatal("begin failed")
	}
	if !r.isPending() {
		t.Fatal("should be pending immediately")
	}
	time.Sleep(250 * time.Millisecond)
	if r.isPending() {
		t.Fatal("should have timed out after 100ms")
	}
	if r.lastErr() != "操作超时" {
		t.Fatalf("expected timeout err, got %q", r.lastErr())
	}
}

func TestRequestStateSecondBeginRejected(t *testing.T) {
	var r requestState
	r.begin("r1", 5*time.Second)
	if r.begin("r2", time.Second) {
		t.Fatal("second begin should be rejected while pending")
	}
	r.done("r1", true, "")
	if !r.begin("r3", time.Second) {
		t.Fatal("begin after done should succeed")
	}
}
