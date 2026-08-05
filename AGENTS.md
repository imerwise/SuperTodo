# AGENTS.md

Tauri 2 desktop app (macOS). Two halves with no shared toolchain:
- `ui/` — vanilla JS/HTML/CSS, **no framework, no bundler, no npm deps**. Served as static files (`frontendDist: "../ui"` in `src-tauri/tauri.conf.json`). Talks to Rust via `window.__TAURI__.core.invoke`.
- `src-tauri/` — Rust binary. Entry: `src/main.rs` -> `lib.rs:run()`.

## Commands

- `npm run dev` — run the app (`tauri dev`; builds Rust, serves UI, launches window)
- `npm run build` — production bundle (`tauri build`)
- `cargo check` / `cargo clippy` / `cargo build` — Rust checks; run from `src-tauri/` (not in package.json scripts)
- `npm run icons` — regenerate the icon set in `src-tauri/icons/` from `icon.png`
- `node scripts/make-icon.js` — regenerate the source `icon.png` (no deps; `icon.png` is gitignored)

No test suite, no CI, no lint/typecheck config. Verify by running the app.

## IPC contract

All seven Tauri commands are defined in `src-tauri/src/lib.rs` and return `DayData`:
`get_today`, `get_day`, `add_task`, `edit_task`, `reorder_task`, `toggle_task`, `delete_task`.
**A new command must be registered in the `invoke_handler!` macro** (`lib.rs:376`) or `invoke()` from the UI rejects with "command not found".

## Storage & carry-over — the critical invariant

Tasks are plain-text files at `~/Documents/SuperTodo/todo_YYYYMMDD.txt`, one task per line. Status markers: `[ ]` open, `[x]` done, `[>]` rolled-over (moved to a later day), `↪` prefix = carried in from a previous day.

`ensure_today()` (`lib.rs:160`) runs on every open of today: it carries every unfinished task from the most recent previous file into today's file and rewrites the source line as `[>]`. This is **idempotent** — `[>]` lines are never carried again. This logic is the single most fragile part of the codebase:

- **Never rewrite past-day files.** All mutating commands already guard `d >= today()` (see `toggle_task`/`delete_task`, `lib.rs:331-370`). Removing a guard re-triggers carry-over on the next open and duplicates tasks. Past days are intentionally read-only in the UI too.
- **The `[>]` marker must round-trip through `format_item`/`parse_item`.** Writing a rolled task back as `[ ]` makes it re-carry and duplicate.

The storage directory is resolved in `storage_dir()` with this precedence: `SUPERTODO_DIR` env var → user's Settings choice (persisted in `~/Library/Application Support/com.imerwise.supertodo/config.json`) → default `~/Documents/SuperTodo`. Set `SUPERTODO_DIR` during any manual testing so real user data is never touched — it wins over the Settings choice.

## Frontend notes

`ui/main.js` holds all view state in module-level `let`s (`current`, `editingIndex`, `pendingDeleteIndex`, `selectedIndex`, `dragState`). Re-render is a full-rebuild via `render(data, fx)`; `fx` is a one-shot animation hint (`add` / `toggle` / `day`). The app honors `prefers-reduced-motion` — guard any new animation behind `reduceMotion.matches` (see `applyFx`).

## Commit style

Imperative subject, capitalized, no conventional-commit prefix (e.g. `Fix past-day carry-over corruption; make past days read-only`).
