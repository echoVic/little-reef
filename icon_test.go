package main

import (
	"bytes"
	"image"
	"image/png"
	"math"
	"testing"
)

func TestTrayFramesSwim(t *testing.T) {
	frames := trayFrames()
	if len(frames) != 16 {
		t.Fatalf("frame count = %d, want 16", len(frames))
	}
	images := make([]image.Image, len(frames))
	for i, frame := range frames {
		img, err := png.Decode(bytes.NewReader(frame))
		if err != nil {
			t.Fatalf("frame %d: %v", i, err)
		}
		if b := img.Bounds(); b.Dx() != traySize || b.Dy() != traySize {
			t.Fatalf("frame %d: size = %dx%d, want %d", i, b.Dx(), b.Dy(), traySize)
		}
		images[i] = img
	}
	if !bytes.Equal(frames[0], trayIcon()) {
		t.Error("frame zero is not the resting icon")
	}
	alpha := func(img image.Image, x, y int) uint32 {
		_, _, _, a := img.At(x, y).RGBA()
		return a
	}
	// The ring holds still and the margins stay empty in every pose.
	for i, img := range images {
		if alpha(img, traySize/2, traySize/10) == 0 {
			t.Errorf("frame %d: the ring is missing", i)
		}
		if alpha(img, 0, 0) != 0 || alpha(img, traySize-1, traySize-1) != 0 {
			t.Errorf("frame %d: the corners are painted", i)
		}
	}
	// The fish swims inside the ring: its ink box moves between the resting
	// and quarter-cycle poses and stays clear of the ring.
	type box struct{ minX, minY, maxX, maxY int }
	fishBox := func(img image.Image) box {
		b := box{traySize, traySize, -1, -1}
		for y := 0; y < traySize; y++ {
			for x := 0; x < traySize; x++ {
				u, v := (float64(x)+0.5)/traySize, (float64(y)+0.5)/traySize
				if math.Hypot(u-0.5, v-0.5) > 0.35 || alpha(img, x, y) == 0 {
					continue
				}
				b.minX, b.minY = min(b.minX, x), min(b.minY, y)
				b.maxX, b.maxY = max(b.maxX, x), max(b.maxY, y)
			}
		}
		return b
	}
	rest, quarter := fishBox(images[0]), fishBox(images[4])
	if quarter.maxY == rest.maxY && quarter.minY == rest.minY {
		t.Error("the fish does not swim between the resting and quarter-cycle poses")
	}
	if rest.maxY-rest.minY < traySize/5 {
		t.Errorf("the fish ink box is %d pixels high, too small to be the fish", rest.maxY-rest.minY)
	}
	for i, img := range images {
		b := fishBox(img)
		for _, p := range [][2]int{{b.minX, b.minY}, {b.minX, b.maxY}, {b.maxX, b.minY}, {b.maxX, b.maxY}} {
			u, v := (float64(p[0])+0.5)/traySize, (float64(p[1])+0.5)/traySize
			if math.Hypot(u-0.5, v-0.5) >= 0.3625 {
				t.Errorf("frame %d: the fish reaches the ring at %v", i, p)
			}
		}
	}
}
