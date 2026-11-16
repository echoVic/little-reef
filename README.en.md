# Little Reef · 小海底

[简体中文](README.md) | English

Grow a small reef with your focus time. Every completed focus round makes the plants a little taller, and now and then a fish, shrimp or crab comes to visit. A quiet desktop focus timer with an aquarium, a visitor collection and 20 background sounds.

## Download

It needs macOS 12 or later and an Apple silicon Mac. Download the latest `little-reef-<version>-macos-arm64.dmg` from [Releases](https://github.com/echoVic/little-reef/releases) and drag Little Reef into Applications.

Windows and Linux have no installers yet; [build from source](#build-from-source).

## Features

- **Focus and breaks**: 25 minutes of focus and 5 of rest by default, adjustable in Settings with new lengths taking effect from the next round. Start, pause, resume and end early, with an optional task name; Space starts or pauses.
- **The aquarium**: each completed round grows the plants, adding one more every three rounds. The first round always brings a clownfish; after that each round has a one-in-three chance of a visitor — 4 fish, 6 shrimp, 5 crabs. Unseen species come first, and once all 15 have visited, old friends return. The collection is kept for good.
- **Feeding**: feed the fish once per break; food sinks and the shrimp and crabs pick up what's left. Leaving or stopping never kills a fish or removes decorations.
- **Sound**: 20 background sounds, all public-domain recordings except the synthesized pink noise, each with its own volume and switch. The completion chime has its own switch; when muted, the text and system notification still appear.
- **Desktop and menu bar**: a desktop widget, hiding into the menu bar and a `CmdOrCtrl+Shift+A` global shortcut; the menu-bar fish swims during focus and stops when paused, and clicking it opens a quick panel. With Reduce Motion on, the animation stops while timing and sound keep working.
- **Themes**: 10 reef skins, switchable by the hour (06:00 Macaron, 10:00 Cel-shaded, 17:00 Rivers and Mountains, 20:00 Deep Sea) or shuffled from all skins every 30 minutes.
- **Records**: the "This Time" panel shows focus time and rounds for the week, month and all time, days together, collection progress and the current growth stage. It only counts forward: no streaks and no goals.
- **Settings and backup**: four tabs — General, Appearance, Shortcuts, Backup & Restore. Shortcuts can be recorded, disabled or reset, and conflicts are reported. Backup exports the whole save as versioned JSON; import validates it first and leaves the current save untouched on failure.

## Save and timing

- Timing runs in the Go backend; hiding the window or the menu bar doesn't affect it.
- If the Mac sleeps, or the app is suspended for more than five seconds, timing pauses and the sleep time doesn't count.
- The save is written every 30 seconds and immediately on a normal quit or an important action; quitting pauses the current round, and the next launch stays silent.
- Ending early records the time already spent but adds no growth, and completing a break adds none either.
- The save is `aquarium.json` in `~/Library/Application Support/小海底` on macOS; `-data-dir` points elsewhere. The diary keeps the latest 1,000 entries and the interface shows the latest 30.

## Build from source

You need Go 1.27.3 or later and Node.js 22+.

```sh
cd web
npm ci --registry=https://registry.npmjs.org/
npm run typecheck && npm test && npm run build   # writes web/dist
cd ..

CGO_ENABLED=0 go test ./...
CGO_ENABLED=0 go run .                            # desktop app
CGO_ENABLED=0 go run . -web 127.0.0.1:4173        # browser mode, loopback only
CGO_ENABLED=0 go tool mygo build -sign=- -skip-notarize .   # macOS app and dmg in build/darwin-arm64
```

The Go binary embeds `web/dist`, themes, sounds and the species table with `//go:embed`; without a built `web/dist` the app exits with a clear error. To change the recordings run `build-sounds.sh`; to change the icon run `go run . -export-icons`.

## Tests

The frontend runs `npm run typecheck`, `npm test` and `npm run build` inside `web/`; the Go side runs `CGO_ENABLED=0 go test ./...`. They cover timing, save rollback, visitor order, total sound size, Reduce Motion and shortcut validation.

## Credits and license

Built on [MyGo](https://github.com/egoist/mygo); third-party notices are in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt). The source is [MIT](LICENSE); the recordings in `web/public/sounds` are public domain, with sources listed in the same notices file.
