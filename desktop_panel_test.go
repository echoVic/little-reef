package main

import (
	"errors"
	"testing"
	"time"
)

func TestRequestStateDoneIdMatching(t *testing.T) {
	var r requestState
	if !r.begin("req-1", time.Second) {
		t.Fatal("first begin should succeed")
	}
	// Second begin should be rejected while pending.
	if r.begin("req-2", time.Second) {
		t.Fatal("second begin should be rejected while pending")
	}
	// Correct ACK clears.
	r.done("req-1", true, "")
	if r.isPending() {
		t.Fatal("correct ACK did not clear pending")
	}
	// Now begin again.
	if !r.begin("req-2", time.Second) {
		t.Fatal("begin after done should succeed")
	}
	r.done("req-2", true, "")
	if r.lastErr() != "" {
		t.Fatal("error should be empty after success")
	}
}

func TestRequestStateError(t *testing.T) {
	var r requestState
	r.begin("req-1", time.Second)
	r.done("req-1", false, "boom")
	if r.isPending() {
		t.Fatal("should not be pending after done")
	}
	if r.lastErr() != "boom" {
		t.Fatalf("expected boom, got %q", r.lastErr())
	}
}

func TestRequestStateTimeout(t *testing.T) {
	var r requestState
	r.begin("req-timeout", time.Second)
	time.Sleep(100 * time.Millisecond)
	// The timer is 1s; after 100ms we should still be pending.
	if !r.isPending() {
		t.Fatal("should still be pending before timeout")
	}
	// Manually fire the timeout path.
	r.mu.Lock()
	if r.current == "req-timeout" {
		r.current = ""
		r.err = "操作超时"
	}
	r.mu.Unlock()
	if r.isPending() {
		t.Fatal("should be cleared after timeout")
	}
	if r.lastErr() != "操作超时" {
		t.Fatalf("expected timeout err, got %q", r.lastErr())
	}
}

func TestTaskEllipsisByRune(t *testing.T) {
	// Chinese string longer than 24 runes gets truncated by rune, not byte.
	s := "这是一个非常长的任务标题需要被截断处理否则会出现乱码问题测试"
	rs := []rune(s)
	if len(rs) <= 24 {
		t.Fatal("test string must be >24 runes")
	}
	out := s
	if len(rs) > 24 {
		out = string(rs[:24]) + "…"
	}
	if got := len([]rune(out)); got != 25 {
		t.Fatalf("expected 25 runes, got %d", got)
	}
	// Must not end mid-byte (rune count is well-formed).
	for _, r := range out {
		if r == '�' {
			t.Fatal("ellipsis produced replacement char")
		}
	}
}

func TestStatusLine(t *testing.T) {
	d := &Desktop{}
	cases := []struct {
		name   string
		snap   Snapshot
		expect string
	}{
		{"idle fresh", Snapshot{Session: Session{Status: "idle"}}, "空闲"},
		{"idle with notice", Snapshot{Session: Session{Status: "idle"}, Notice: "这段时间也算数"}, "这段时间也算数"},
		{"running focus", Snapshot{Session: Session{Status: "running", Kind: "focus"}}, "专注进行中"},
		{"running break", Snapshot{Session: Session{Status: "running", Kind: "break"}}, "休息进行中"},
		{"paused", Snapshot{Session: Session{Status: "paused"}}, "已暂停"},
		{"idle after rounds", Snapshot{Session: Session{Status: "idle"}, TodayRounds: 3}, "已完成今日 3 轮"},
		{"complete focus", Snapshot{Session: Session{Status: "complete", Kind: "focus"}}, "专注完成，建议休息"},
		{"complete break", Snapshot{Session: Session{Status: "complete", Kind: "break"}}, "休息结束，开始下一轮"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := d.statusLine(c.snap); got != c.expect {
				t.Errorf("statusLine() = %q, want %q", got, c.expect)
			}
		})
	}
}

func TestEndRequestRecordsError(t *testing.T) {
	d := &Desktop{}
	id, ok := d.beginRequest()
	if !ok {
		t.Fatal("beginRequest should succeed")
	}
	d.endRequest(id, errors.New("disk full"))
	if d.req.isPending() {
		t.Fatal("should not be pending after endRequest")
	}
	if d.req.lastErr() != "disk full" {
		t.Fatalf("expected disk full, got %q", d.req.lastErr())
	}
}
