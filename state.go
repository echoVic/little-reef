package main

import (
	"encoding/json"
	"errors"
	"math"
	"math/rand/v2"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"
)

// Preferences controls the next session and its optional soundscape.
type Preferences struct {
	FocusMinutes int     `json:"focusMinutes"`
	BreakMinutes int     `json:"breakMinutes"`
	Sound        string  `json:"sound"`
	Volume       float64 `json:"volume"`
	SoundEnabled bool    `json:"soundEnabled"`
	ChimeEnabled bool    `json:"chimeEnabled"`
}

// Session is one focus or break timer, measured by the backend.
type Session struct {
	ID         int64  `json:"id"`
	Kind       string `json:"kind"`
	Status     string `json:"status"`
	Task       string `json:"task"`
	DurationMS int64  `json:"durationMs"`
	ElapsedMS  int64  `json:"elapsedMs"`
	StartedAt  string `json:"startedAt"`
}

// Record preserves time spent even when a focus session ends early.
type Record struct {
	ID        int64  `json:"id"`
	Task      string `json:"task"`
	Seconds   int64  `json:"seconds"`
	Completed bool   `json:"completed"`
	Date      string `json:"date"`
}

// Visitor is an encounter kept even if the aquarium window was hidden.
type Visitor struct {
	Species string `json:"species"`
	Name    string `json:"name"`
	Date    string `json:"date"`
	Visits  int    `json:"visits"`
}

// Snapshot is shared by the desktop IPC, browser view, and saved state.
type Snapshot struct {
	Revision    int64       `json:"revision"`
	Preferences Preferences `json:"preferences"`
	Session     Session     `json:"session"`
	Completed   int         `json:"completed"`
	TotalSecs   int64       `json:"totalSecs"`
	TodaySecs   int64       `json:"todaySecs"`
	TodayRounds int         `json:"todayRounds"`
	Records     []Record    `json:"records"`
	Visitors    []Visitor   `json:"visitors"`
	LastVisitor string      `json:"lastVisitor"`
	Notice      string      `json:"notice"`
	FedSession  int64       `json:"fedSession"`
	NowMS       int64       `json:"nowMs"`
}

// Aquarium owns timer and persistence. No page or animation owns the clock.
type Aquarium struct {
	mu       sync.Mutex
	state    Snapshot
	path     string
	segment  time.Time
	lastTick time.Time
	now      func() time.Time
	onChange func(Snapshot)
	onDone   func(Snapshot)
	stop     chan struct{}
	done     chan struct{}
}

func newAquarium(path string) (*Aquarium, error) {
	a := &Aquarium{path: path, now: time.Now, stop: make(chan struct{}), done: make(chan struct{})}
	a.state = Snapshot{
		Preferences: Preferences{FocusMinutes: 25, BreakMinutes: 5, Sound: "waves", Volume: .35, ChimeEnabled: true},
		Session:     Session{Kind: "focus", Status: "idle", DurationMS: 25 * 60 * 1000},
		Records:     []Record{}, Visitors: []Visitor{},
	}
	data, err := os.ReadFile(path)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	if len(data) > 0 {
		if err := json.Unmarshal(data, &a.state); err != nil {
			return nil, errors.New("无法读取水族馆存档，请保留原文件并检查存档格式")
		}
		if err := validatePreferences(a.state.Preferences); err != nil {
			return nil, err
		}
		if !slices.Contains([]string{"focus", "break"}, a.state.Session.Kind) ||
			!slices.Contains([]string{"idle", "running", "paused", "complete"}, a.state.Session.Status) ||
			a.state.Session.DurationMS <= 0 || a.state.Session.DurationMS > 120*60*1000 ||
			a.state.Session.ElapsedMS < 0 || a.state.Completed < 0 || a.state.TotalSecs < 0 {
			return nil, errors.New("水族馆存档中的计时数据无效")
		}
		if a.state.Session.Status == "running" {
			a.state.Session.Status = "paused"
			a.state.Notice = "上次专注已暂停，准备好后再继续。"
		}
	}
	a.state.LastVisitor = ""
	a.state.Revision++
	return a, nil
}

func validatePreferences(p Preferences) error {
	if p.FocusMinutes < 1 || p.FocusMinutes > 120 || p.BreakMinutes < 1 || p.BreakMinutes > 30 {
		return errors.New("专注时长须为 1–120 分钟，休息时长须为 1–30 分钟")
	}
	if !slices.Contains([]string{"waves", "rain", "bubbles", "wind", "fire", "stream", "pink", "clock", "boil", "knock", "thunder", "cafe", "musicbox", "morning", "summer", "night", "forest", "deepsea", "desert", "traffic"}, p.Sound) {
		return errors.New("请先选择一种背景音")
	}
	if math.IsNaN(p.Volume) || math.IsInf(p.Volume, 0) || p.Volume < 0 || p.Volume > 1 {
		return errors.New("音量须在 0–100% 之间")
	}
	return nil
}

func (a *Aquarium) snapshotLocked() Snapshot {
	s := a.state
	s.Records = slices.Clone(s.Records)
	s.Visitors = slices.Clone(s.Visitors)
	if s.Records == nil {
		s.Records = []Record{}
	}
	if s.Visitors == nil {
		s.Visitors = []Visitor{}
	}
	now := a.now()
	s.NowMS = now.UnixMilli()
	if s.Session.Status == "running" {
		s.Session.ElapsedMS = min(s.Session.DurationMS, s.Session.ElapsedMS+max(0, now.Sub(a.segment).Milliseconds()))
	}
	s.TodaySecs, s.TodayRounds = 0, 0
	date := now.Format("2006-01-02")
	for _, r := range s.Records {
		if strings.HasPrefix(r.Date, date) {
			s.TodaySecs += r.Seconds
			if r.Completed {
				s.TodayRounds++
			}
		}
	}
	if s.Session.Kind == "focus" && slices.Contains([]string{"running", "paused"}, s.Session.Status) {
		s.TodaySecs += s.Session.ElapsedMS / 1000
	}
	return s
}

// Get returns a current, immutable snapshot.
func (a *Aquarium) Get() Snapshot {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.snapshotLocked()
}

func (a *Aquarium) saveLocked() error {
	if err := os.MkdirAll(filepath.Dir(a.path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(a.snapshotLocked(), "", "  ")
	if err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(a.path), ".aquarium-*.tmp")
	if err != nil {
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	if _, err = f.Write(data); err != nil {
		f.Close()
		return err
	}
	if err = f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return os.Rename(name, a.path)
}

func (a *Aquarium) change(fn func() error) (Snapshot, error) {
	a.mu.Lock()
	previous := a.snapshotLocked()
	previousSegment, previousTick := a.segment, a.lastTick
	if err := fn(); err != nil {
		a.mu.Unlock()
		return Snapshot{}, err
	}
	a.state.Revision++
	if err := a.saveLocked(); err != nil {
		a.state = previous
		a.segment, a.lastTick = previousSegment, previousTick
		// previous already includes running time, so start a fresh segment.
		if a.state.Session.Status == "running" {
			a.segment = a.now()
		}
		a.mu.Unlock()
		return Snapshot{}, errors.New("保存失败，请检查存档目录是否可写；本次操作未生效")
	}
	s := a.snapshotLocked()
	a.mu.Unlock()
	if a.onChange != nil {
		a.onChange(s)
	}
	return s, nil
}

// Start begins a fresh focus session or the break after a completed focus.
func (a *Aquarium) Start(kind, task string) (Snapshot, error) {
	return a.change(func() error {
		if kind != "focus" && kind != "break" {
			return errors.New("无效的计时类型")
		}
		if a.state.Session.Status == "running" || a.state.Session.Status == "paused" {
			return errors.New("请先完成或结束当前计时")
		}
		task = strings.TrimSpace(task)
		if len([]rune(task)) > 80 {
			return errors.New("任务名称最多 80 个字")
		}
		minutes := a.state.Preferences.FocusMinutes
		if kind == "break" {
			minutes = a.state.Preferences.BreakMinutes
			task = "让眼睛也休息一下"
		}
		now := a.now()
		a.state.Session = Session{
			ID: max(now.UnixMilli(), a.state.Session.ID+1), Kind: kind, Status: "running",
			Task: task, DurationMS: int64(minutes) * 60 * 1000, StartedAt: now.Format(time.RFC3339),
		}
		a.segment, a.lastTick = now, now
		a.state.Notice, a.state.LastVisitor = "", ""
		return nil
	})
}

func (a *Aquarium) captureLocked() {
	if a.state.Session.Status == "running" {
		now := a.now()
		a.state.Session.ElapsedMS = min(a.state.Session.DurationMS, a.state.Session.ElapsedMS+max(0, now.Sub(a.segment).Milliseconds()))
		a.segment = now
	}
}

// Pause preserves progress and stops the soundscape through the next event.
func (a *Aquarium) Pause() (Snapshot, error) {
	return a.change(func() error {
		if a.state.Session.Status != "running" {
			return errors.New("当前没有正在进行的计时")
		}
		a.captureLocked()
		a.state.Session.Status = "paused"
		return nil
	})
}

// Resume continues a paused session without counting the time away.
func (a *Aquarium) Resume() (Snapshot, error) {
	return a.change(func() error {
		if a.state.Session.Status != "paused" {
			return errors.New("当前没有暂停的计时")
		}
		a.state.Session.Status = "running"
		a.segment, a.lastTick = a.now(), a.now()
		a.state.Notice = ""
		return nil
	})
}

func (a *Aquarium) recordLocked(completed bool) {
	s := a.state.Session
	seconds := s.ElapsedMS / 1000
	a.state.TotalSecs += seconds
	a.state.Records = append([]Record{{ID: s.ID, Task: s.Task, Seconds: seconds, Completed: completed, Date: a.now().Format(time.RFC3339)}}, a.state.Records...)
	// Keep long-term totals while bounding the diary's size.
	if len(a.state.Records) > 1000 {
		a.state.Records = a.state.Records[:1000]
	}
}

// End keeps actual focus time but does not award a completed-round growth.
func (a *Aquarium) End() (Snapshot, error) {
	return a.change(func() error {
		if a.state.Session.Status != "running" && a.state.Session.Status != "paused" {
			return errors.New("当前没有可以结束的计时")
		}
		a.captureLocked()
		if a.state.Session.Kind == "focus" {
			a.recordLocked(false)
		}
		a.state.Session.Status = "idle"
		a.state.Session.ElapsedMS = 0
		a.state.Notice = "这段时间也算数。已有的水草与鱼儿都在，准备好再开始。"
		return nil
	})
}

// SetPreferences changes sound immediately; durations apply to the next timer.
func (a *Aquarium) SetPreferences(p Preferences) (Snapshot, error) {
	if err := validatePreferences(p); err != nil {
		return Snapshot{}, err
	}
	return a.change(func() error {
		a.state.Preferences = p
		if a.state.Session.Status == "idle" {
			minutes := p.FocusMinutes
			if a.state.Session.Kind == "break" {
				minutes = p.BreakMinutes
			}
			a.state.Session.DurationMS = int64(minutes) * 60 * 1000
		}
		return nil
	})
}

// Feed is a single optional interaction during each break.
func (a *Aquarium) Feed() (Snapshot, error) {
	return a.change(func() error {
		s := a.state.Session
		if s.Kind != "break" || s.Status != "running" {
			return errors.New("休息时再来喂鱼吧")
		}
		if a.state.FedSession == s.ID {
			return errors.New("这一轮已经喂过，鱼儿很满足了")
		}
		a.state.FedSession = s.ID
		a.state.Notice = "鱼儿吃饱啦，去看看窗外吧。"
		return nil
	})
}

var species = []Visitor{
	{Species: "clown", Name: "小丑鱼"},
	{Species: "tang", Name: "蓝吊鱼"},
	{Species: "angel", Name: "神仙鱼"},
	{Species: "puffer", Name: "小河豚"},
}

func (a *Aquarium) completeLocked() {
	s := &a.state.Session
	s.ElapsedMS, s.Status = s.DurationMS, "complete"
	if s.Kind == "break" {
		a.state.Notice = "休息结束，准备好再开始下一轮。"
		return
	}
	a.recordLocked(true)
	a.state.Completed++
	a.state.Notice = "专注完成，水草又长大了一点。"
	a.state.LastVisitor = ""
	// The first encounter is guaranteed; later rounds leave occasional surprises.
	if a.state.Completed == 1 || rand.IntN(3) == 0 {
		v := species[(a.state.Completed-1)%len(species)]
		v.Date, v.Visits = a.now().Format(time.RFC3339), 1
		i := slices.IndexFunc(a.state.Visitors, func(old Visitor) bool { return old.Species == v.Species })
		if i >= 0 {
			v.Visits += a.state.Visitors[i].Visits
			a.state.Visitors[i] = v
		} else {
			a.state.Visitors = append(a.state.Visitors, v)
		}
		a.state.LastVisitor = v.Name
		a.state.Notice += " " + v.Name + "来做客了，已留下图鉴记录。"
	}
}

func (a *Aquarium) tick() {
	a.mu.Lock()
	if a.state.Session.Status != "running" {
		a.mu.Unlock()
		return
	}
	now := a.now()
	// A long scheduling gap is treated as sleep: never award offline focus.
	if now.Sub(a.lastTick) > 5*time.Second {
		a.state.Session.ElapsedMS += max(0, a.lastTick.Sub(a.segment).Milliseconds())
		a.state.Session.ElapsedMS = min(a.state.Session.DurationMS, a.state.Session.ElapsedMS)
		a.state.Session.Status = "paused"
		a.state.Notice = "检测到电脑休眠或计时中断，已暂停。回来后再继续。"
	} else {
		a.captureLocked()
	}
	a.lastTick = now
	completed := a.state.Session.Status == "running" && a.state.Session.ElapsedMS >= a.state.Session.DurationMS
	if completed {
		a.completeLocked()
	}
	a.state.Revision++
	if completed || a.state.Session.Status == "paused" || a.state.Session.ElapsedMS/1000%30 == 0 {
		if err := a.saveLocked(); err != nil {
			a.state.Notice = "存档暂时写入失败，当前进度仍保留在内存中。"
		}
	}
	s := a.snapshotLocked()
	a.mu.Unlock()
	if a.onChange != nil {
		a.onChange(s)
	}
	if completed && a.onDone != nil {
		a.onDone(s)
	}
}

func (a *Aquarium) run() {
	defer close(a.done)
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			a.tick()
		case <-a.stop:
			return
		}
	}
}

func (a *Aquarium) shutdown() error {
	close(a.stop)
	<-a.done
	a.mu.Lock()
	defer a.mu.Unlock()
	a.captureLocked()
	if a.state.Session.Status == "running" {
		a.state.Session.Status = "paused"
	}
	return a.saveLocked()
}
