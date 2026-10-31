package main

import (
	"context"
	"testing"
)

type fakeBroadcaster struct {
	audio []AudioRequestEvent
	ui    []UIRequestEvent
}

func (f *fakeBroadcaster) broadcastAudio(ev AudioRequestEvent) { f.audio = append(f.audio, ev) }
func (f *fakeBroadcaster) broadcastUI(ev UIRequestEvent)       { f.ui = append(f.ui, ev) }

func TestVolumeRapidCoalesceEndsAtZero(t *testing.T) {
	d := &Desktop{}
	fb := &fakeBroadcaster{}
	d.bc = fb

	// First volume request goes out.
	d.requestAudio("set-volume", 0.36)
	if len(fb.audio) != 1 {
		t.Fatalf("expected 1 event, got %d", len(fb.audio))
	}
	if *fb.audio[0].Volume != 0.36 {
		t.Fatalf("first volume should be 0.36, got %v", *fb.audio[0].Volume)
	}
	// User keeps dragging: 0.78, then 0.0. Both rejected (busy) and stashed.
	d.requestAudio("set-volume", 0.78)
	d.requestAudio("set-volume", 0.0)
	if len(fb.audio) != 1 {
		t.Fatalf("busy drags must not send, got %d", len(fb.audio))
	}
	// Frontend ACKs first request with volume 0.36.
	d.ReportAudioState(context.Background(),
		fb.audio[0].RequestID,
		AudioState{Running: true, Requested: true, Volume: 0.36})
	// Should flush latest (0.0).
	if len(fb.audio) != 2 {
		t.Fatalf("expected flush event, got %d", len(fb.audio))
	}
	if *fb.audio[1].Volume != 0.0 {
		t.Fatalf("final flushed volume must be 0.0, got %v", *fb.audio[1].Volume)
	}
	// The flush itself begins a new pending request; that's expected.
	if !d.req.isPending() {
		t.Fatal("flush should start a new pending request")
	}
}

func TestStaleACKIgnoredBroadcastUnchanged(t *testing.T) {
	d := &Desktop{}
	fb := &fakeBroadcaster{}
	d.bc = fb
	d.requestAudio("toggle", 0)
	before := len(fb.audio)
	// ACK with wrong id.
	d.ReportAudioState(context.Background(), "wrong-id", AudioState{Running: true, Requested: true})
	if !d.req.isPending() {
		t.Fatal("stale ACK must not clear pending")
	}
	if len(fb.audio) != before {
		t.Fatalf("stale ACK must not broadcast, got %d events", len(fb.audio))
	}
}

func TestFailedACKNoRetry(t *testing.T) {
	d := &Desktop{}
	fb := &fakeBroadcaster{}
	d.bc = fb
	d.requestAudio("set-volume", 0.5)
	id := fb.audio[0].RequestID
	// Set a draft while busy.
	d.requestAudio("set-volume", 0.9)
	// Frontend reports error.
	d.ReportAudioState(context.Background(), id, AudioState{Error: "decode failed"})
	if d.req.isPending() {
		t.Fatal("failed ACK must clear pending")
	}
	if d.req.lastErr() != "decode failed" {
		t.Fatalf("expected error, got %q", d.req.lastErr())
	}
	if len(fb.audio) != 1 {
		t.Fatalf("failed ACK must not retry/flush, got %d events", len(fb.audio))
	}
}

func TestNeedGestureNoRetry(t *testing.T) {
	d := &Desktop{}
	fb := &fakeBroadcaster{}
	d.bc = fb
	d.requestAudio("toggle", 0)
	id := fb.audio[0].RequestID
	d.ReportAudioState(context.Background(), id, AudioState{NeedGesture: true})
	if d.req.isPending() {
		t.Fatal("needGesture must clear pending")
	}
	if len(fb.audio) != 1 {
		t.Fatalf("needGesture must not retry, got %d events", len(fb.audio))
	}
	d.vol.mu.Lock()
	active := d.vol.active
	d.vol.mu.Unlock()
	if active {
		t.Fatal("needGesture must clear draft")
	}
}

func TestTimeoutHookClearsDraft(t *testing.T) {
	d := &Desktop{}
	fb := &fakeBroadcaster{}
	d.bc = fb
	d.requestAudio("set-volume", 0.5)
	d.requestAudio("set-volume", 0.9)
	// Simulate the timeout hook (requestState timer fires this).
	d.req.onTimeout()
	d.vol.mu.Lock()
	active := d.vol.active
	d.vol.mu.Unlock()
	if active {
		t.Fatal("timeout hook must clear volume draft")
	}
}
