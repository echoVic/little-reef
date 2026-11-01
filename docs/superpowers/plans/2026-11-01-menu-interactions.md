# Menu interaction improvements

**Goal:** Improve both the application menu and the menu-bar fish's native quick panel, using the same timer actions and accurate window/audio state.

**Scope:** Continue the existing uncommitted work in place. Keep the existing native settings window, aquarium persistence, and browser interface. No publication or installation.

**Decisions:** After a focus completes, the primary action starts a break; after a break it starts focus. Timer, audio and layout requests have separate pending states. Opening the aquarium/settings always remains available. All native compact-mode entrances broadcast the layout change; compact mode is explicit state and the last ordinary window bounds are restored. Ending a round asks for confirmation tied to its session ID. The quick panel shows descriptive sound controls and volume percentage; menus show live action availability and the current compact-mode checkmark.

## Tasks

- [x] Capture the existing quick panel and add failing tests for completed-round actions, independent request states, session-bound confirmation and window bounds restoration.
- [x] Implement common native timer/menu commands and an updated quick panel; synchronize compact mode across the app menu, right-click menu and web window. Preserve sound coalescing and native settings access.
- [x] Run Go and frontend suites/build, obtain independent review, and verify real application menu and native panel actions with isolated preview data.

## Verification

- Go full suite passes, including session transition actions, timer/audio/layout request isolation, stale end confirmation, full-bounds restoration, descriptive audio state and footer bounds at 320x420.
- Frontend: 87 tests pass; production build passes. Regressions cover native compact startup/reload, stale initial/local mode replies, delayed native/main sound enable versus pause, and successful audio requests leaving no 10-second cancellation timer.
- Isolated native preview verified app menu start/pause/continue, Cmd+Enter, shared quick-panel native controls (hosted in a preview-only native window for reliable CUA targeting), sound controls and volume 51 percent, panel-to-main compact transition, Cmd+R compact recovery, window-menu mode exit, and end confirmation cancel/reopen/commit. Production flyout uses the same tested view.
- Review findings resolved: removed inert window-role leaf, synchronized compact state on load, guarded stale local mode replies, reconciled both audio entry points with current session state, and cleared losing audio timeouts. No remaining important review findings.
