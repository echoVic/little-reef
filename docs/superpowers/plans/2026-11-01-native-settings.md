# Native settings implementation plan

**Goal:** Open a MyGo native settings window from 小海底 → 设置… (CmdOrCtrl+,), retaining existing settings and theme behavior.

**Architecture:** The application menu and tray open one reusable native settings window. Aquarium continues to own preferences, themes, persistence, and broadcasts. A window-local draft holds timer durations and chime; saving merges those fields into current preferences, preserving concurrent sound changes. Native settings use MyGo UI controls and native file dialogs, while browser mode retains SettingsDialog.

**Tech stack:** Go, MyGo v0.7.3 ui and menu APIs; existing React browser frontend.

**Scope and decisions:** This continues the existing uncommitted work in place. No commits or publication. Native settings follow the system appearance; aquarium skins continue to affect the aquarium. Theme changes apply immediately; timing changes require saving and apply to the next round. Reopening a closed settings window reads fresh preferences; opening an already open settings window preserves its draft.

## Tasks

- [x] Add headless tests for the native preferences draft, save/validation, immediate theme changes, exclusive automatic modes, and the application menu shortcut. Implement native view and its single-window lifecycle in `desktop_settings.go`, menu in `desktop_menu.go`.
- [x] Route the app menu, tray panel and main-window settings button to the same native entry point. Reuse backup/import logic with an explicit parent window and native confirmation. Keep browser settings working and remove the obsolete native-to-web settings request.
- [x] Regenerate bindings; run Go and frontend suites and production build. Review changes and verify actual application-menu placement, Cmd+, native controls, save behavior, theme dropdown and reopening with CUA. Preserve normal application data and window placement during preview.

## Verification focus

- Snapshot updates must not clobber unsaved duration/chime edits.
- Saving durations must preserve audio settings changed elsewhere.
- Invalid duration edits and failed writes must not report success.
- Theme/manual/automatic behavior and backup archive exclusion must remain intact.
- Settings must open from menu and tray even when the main aquarium window is hidden or compact; repeat opens reuse one window.

## Progress

- Verified the requested UI documentation and the exact installed v0.7.3 source. Existing tray panel already uses `ui.View`; settings currently use a web dialog and a frontend ACK request.

- Implemented native settings, application-menu shortcut, direct native entry points, atomic timer-draft save, native theme menu and archive sheets. Removed the desktop-to-web settings ACK path.
- Verified Go full suite, 80 frontend tests, generated bindings and production build. CUA verified the real menu, no-HTML native window, Cmd+, window reuse, draft preservation/reopen, theme modes, manual skin selection, saving and canceling native archive sheets.
- Review found and resolved import cancellation after closing settings; the window context is checked at the Aquarium commit boundary and successful import refreshes its draft. No remaining important review findings.
