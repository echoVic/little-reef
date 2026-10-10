// The 小海底 mark: the focus ring with a fish inside. It is drawn in code so
// the menu bar, Dock, web page and packaged icons stay in sync.
package main

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"log"
	"math"
	"os"
	"path/filepath"
	"runtime"
)

// Mark colors; the accent matches web/style.css.
var (
	markInk   = color.NRGBA{R: 0xa8, G: 0xde, B: 0xba, A: 0xff}
	badgeTile = color.NRGBA{R: 0x10, G: 0x27, B: 0x30, A: 0xff}
)

// markShader reports whether the unit-square point (u, v) is inside a shape.
type markShader func(u, v float64) bool

func markCircle(cx, cy, r float64) markShader {
	return func(u, v float64) bool {
		dx, dy := u-cx, v-cy
		return dx*dx+dy*dy <= r*r
	}
}

func markEllipse(cx, cy, rx, ry float64) markShader {
	return func(u, v float64) bool {
		dx, dy := (u-cx)/rx, (v-cy)/ry
		return dx*dx+dy*dy <= 1
	}
}

func markRing(cx, cy, r, thickness float64) markShader {
	return func(u, v float64) bool {
		return math.Abs(math.Hypot(u-cx, v-cy)-r) <= thickness/2
	}
}

func markPoly(points [][2]float64) markShader {
	return func(u, v float64) bool {
		inside := false
		j := len(points) - 1
		for i := range points {
			xi, yi := points[i][0], points[i][1]
			xj, yj := points[j][0], points[j][1]
			if (yi > v) != (yj > v) && u < (xj-xi)*(v-yi)/(yj-yi)+xi {
				inside = !inside
			}
			j = i
		}
		return inside
	}
}

// markRoundedBox fills the square inset by margin, with Apple's icon corner radius.
func markRoundedBox(margin float64) markShader {
	half := 0.5 - margin
	radius := 0.2237 * (1 - 2*margin)
	return func(u, v float64) bool {
		qx := math.Abs(u-0.5) - (half - radius)
		qy := math.Abs(v-0.5) - (half - radius)
		return math.Hypot(math.Max(qx, 0), math.Max(qy, 0))+math.Min(math.Max(qx, qy), 0) <= radius
	}
}

func markNot(f markShader) markShader { return func(u, v float64) bool { return !f(u, v) } }

func markOr(fs ...markShader) markShader {
	return func(u, v float64) bool {
		for _, f := range fs {
			if f(u, v) {
				return true
			}
		}
		return false
	}
}

func markAnd(fs ...markShader) markShader {
	return func(u, v float64) bool {
		for _, f := range fs {
			if !f(u, v) {
				return false
			}
		}
		return true
	}
}

// markFish is the fish of the mark: body, tail, and the eye at sizes where
// it does not turn into noise.
func markFish(eye bool) markShader {
	fish := markOr(
		markEllipse(0.545, 0.50, 0.155, 0.105),                              // body
		markPoly([][2]float64{{0.375, 0.50}, {0.255, 0.39}, {0.255, 0.61}}), // tail
	)
	if eye {
		fish = markAnd(fish, markNot(markCircle(0.615, 0.462, 0.024)))
	}
	return fish
}

// markGlyph is the mark itself: the ring, and the fish swimming inside it.
func markGlyph(eye bool) markShader {
	return markOr(markRing(0.5, 0.5, 0.40, 0.075), markFish(eye))
}

// markMoved maps a shape through a move, tilt and scale around a pivot.
func markMoved(f markShader, dx, dy, angle, scale, pivotX, pivotY float64) markShader {
	cos, sin := math.Cos(angle), math.Sin(angle)
	return func(u, v float64) bool {
		x, y := u-dx-pivotX, v-dy-pivotY
		return f((x*cos+y*sin)/scale+pivotX, (-x*sin+y*cos)/scale+pivotY)
	}
}

// swimmingGlyph is the mark over one swim cycle: the ring holds still while
// the fish breathes and drifts, resting again at phase zero.
func swimmingGlyph(phase float64, eye bool) markShader {
	fish := markMoved(markFish(eye),
		0.010*math.Sin(2*phase),   // gentle sway
		0.034*math.Sin(phase),     // rise and sink
		0.10*math.Sin(phase),      // nose up while rising
		1+0.045*math.Sin(2*phase), // breathing
		0.545, 0.50)
	return markOr(markRing(0.5, 0.5, 0.40, 0.075), fish)
}

// markPaint covers pixels of img with ink, anti-aliased by supersampling.
func markPaint(img *image.NRGBA, size int, f markShader, ink color.NRGBA) {
	const samples = 4
	scale := 1 / float64(size)
	for py := 0; py < size; py++ {
		for px := 0; px < size; px++ {
			// Whole-pixel fast paths first: solid interiors and empty space.
			x0, y0 := float64(px)*scale, float64(py)*scale
			x1, y1 := x0+scale, y0+scale
			inside := f(x0, y0) && f(x0, y1) && f(x1, y0) && f(x1, y1) && f((x0+x1)/2, (y0+y1)/2)
			if !inside && !(f(x0, y0) || f(x0, y1) || f(x1, y0) || f(x1, y1) || f((x0+x1)/2, (y0+y1)/2)) {
				continue
			}
			hits := 0
			for sy := 0; sy < samples; sy++ {
				for sx := 0; sx < samples; sx++ {
					u := x0 + (float64(sx)+0.5)*scale/samples
					v := y0 + (float64(sy)+0.5)*scale/samples
					if f(u, v) {
						hits++
					}
				}
			}
			if hits == 0 {
				continue
			}
			coverage := float64(hits) / (samples * samples)
			img.SetNRGBA(px, py, markBlend(img.NRGBAAt(px, py), ink, coverage))
		}
	}
}

func markBlend(dst, src color.NRGBA, coverage float64) color.NRGBA {
	alpha := coverage * float64(src.A) / 255
	out := alpha + float64(dst.A)/255*(1-alpha)
	if out <= 0 {
		return color.NRGBA{}
	}
	mix := func(d, s uint8) uint8 {
		v := (float64(s)*alpha + float64(d)*float64(dst.A)/255*(1-alpha)) / out
		return uint8(math.Round(v))
	}
	return color.NRGBA{mix(dst.R, src.R), mix(dst.G, src.G), mix(dst.B, src.B), uint8(math.Round(out * 255))}
}

func markRender(size int, draw func(img *image.NRGBA, size int)) []byte {
	img := image.NewNRGBA(image.Rect(0, 0, size, size))
	draw(img, size)
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		log.Fatal(err)
	}
	return buf.Bytes()
}

// markPNG renders the bare mark on transparency.
func markPNG(size int, ink color.NRGBA) []byte {
	return markRender(size, func(img *image.NRGBA, size int) {
		markPaint(img, size, markGlyph(size >= 24), ink)
	})
}

// markBadgePNG renders the mark on a rounded tile, as the app icon.
func markBadgePNG(size int) []byte {
	const scale, inset = 0.84, 0.08
	return markRender(size, func(img *image.NRGBA, size int) {
		markPaint(img, size, markRoundedBox(0.045), badgeTile)
		glyph := markGlyph(float64(size)*scale >= 24)
		markPaint(img, size, func(u, v float64) bool { return glyph((u-inset)/scale, (v-inset)/scale) }, markInk)
	})
}

// traySize is the menu bar mark's pixel size: four times the 18 points a
// status item is tall, so the system has enough resolution on Retina.
const traySize = 72

// trayInk is the menu bar color: a template image on macOS, so the system
// draws it in the right color, and the accent mark elsewhere.
func trayInk() color.NRGBA {
	if runtime.GOOS == "darwin" {
		return color.NRGBA{A: 0xff}
	}
	return markInk
}

// trayIcon is the resting menu bar mark.
func trayIcon() []byte {
	return markPNG(traySize, trayInk())
}

// trayFrames renders one swim cycle of the menu bar mark. Frame zero is the
// resting pose, byte for byte the idle icon, so the fish settles when the
// animation stops.
func trayFrames() [][]byte {
	const count = 16
	frames := make([][]byte, count)
	for i := range frames {
		phase := 2 * math.Pi * float64(i) / count
		frames[i] = markRender(traySize, func(img *image.NRGBA, size int) {
			markPaint(img, size, swimmingGlyph(phase, size >= 24), trayInk())
		})
	}
	return frames
}

// exportIconAssets rewrites the icon files the web page and packaging use.
func exportIconAssets() error {
	files := []struct {
		path string
		data []byte
	}{
		{filepath.Join("assets", "icon.png"), markBadgePNG(1024)},
		{filepath.Join("web", "favicon.png"), markBadgePNG(128)},
		{filepath.Join("web", "mark.png"), markPNG(128, markInk)},
	}
	for _, file := range files {
		if err := os.MkdirAll(filepath.Dir(file.path), 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(file.path, file.data, 0o644); err != nil {
			return err
		}
		log.Printf("已写入 %s（%d 字节）", file.path, len(file.data))
	}
	return nil
}
