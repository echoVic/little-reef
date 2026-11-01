# Configurable shortcuts

**Goal:** Make the app-owned shortcuts editable in native settings, with immediate menu updates, persistence, conflict detection, and restore defaults.

**Decisions:** Keep existing defaults for timer primary/end, show aquarium, compact mode, settings, and the one global wake shortcut. Plain Space remains a separate opt-in checkbox for the aquarium page and ignores modifiers, editing controls and dialogs. Native recording temporarily suspends app menu accelerators and the owned global registration; release the recorded key before restoring them. Escape cancels, Delete/Backspace disables, and blur/close safely ends recording. Standard system/editing combinations and duplicates are rejected. A failed global registration or file write preserves the previously active bindings.

**Architecture:** A dedicated shortcut settings file beside theme settings, outside the aquarium archive. A controller owns configuration, global registration and rollback; native menu items read the same configuration. A native settings tab owns its draft and recording state. A typed change event and initial read synchronize the page's plain-Space preference.

## Tasks

- [x] Implement and test normalization, duplicate/reserved detection, persistence, global registration rollback, and recording suspend/resume.
- [x] Add native recorder/settings tab, update menus and startup/shutdown registration, and synchronize the Space option to the page.
- [x] Run Go/frontend suites and build; review; verify recording, menu actions, restart persistence and defaults with an isolated native preview.

## Verification

Go suite and 89 frontend tests pass; bindings generation and frontend production build pass. Independent review covered shortcut configuration, rollback and recording lifecycle. A regression test reproduced macOS missing Command-keyup events; a modifier-release fallback fixes recording completion and is restricted to macOS Command chords. A second regression preserves ordinary key-up handling for other chords.

The frontend suite still reports React `act(...)` warnings in hook and Radix interaction tests; no test failed. The final embedded desktop binary builds successfully.

In an isolated macOS preview, recorded Command-Shift-P, saved it, verified the old Command-Enter stopped working and the new key started/paused the timer, then restarted and verified persistence. Disabled Space and verified it stayed disabled after restart. Restored defaults and verified Command-Enter and Space worked again while Command-Shift-P no longer did. Recording Command-Q showed a conflict without quitting; Escape restored shortcuts. Preview data stayed in a temporary directory and the preview was quit after testing. Windows/Linux native interactions remain unverified.
