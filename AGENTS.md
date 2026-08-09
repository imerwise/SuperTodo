# AGENTS.md

Tauri 2 desktop app (macOS). Two halves with no shared toolchain:
- `ui/` — vanilla JS/HTML/CSS, **no framework, no bundler, no npm deps**. Served as static files (`frontendDist: "../ui"` in `src-tauri/tauri.conf.json`). Talks to Rust via `window.__TAURI__.core.invoke`.
- `src-tauri/` — Rust binary. Entry: `src/main.rs` -> `lib.rs:run()`.

## Commands

- `npm run dev` — run the app (`tauri dev`; builds Rust, serves UI, launches window)
- `npm run build` — production bundle (`tauri build`)
- `cargo check` / `cargo clippy` / `cargo test` — Rust checks and unit tests (`mod storage_tests` in `lib.rs`); run from `src-tauri/`
- `npm run icons` — regenerate the icon set in `src-tauri/icons/` from `icon.png`
- `node scripts/make-icon.js` — regenerate the source `icon.png` (no deps; `icon.png` is gitignored)

No CI, no lint/typecheck config. Verify by running the app.

## IPC contract

All Tauri commands are defined in `src-tauri/src/lib.rs`, grouped by module:
- todos: `get_today`, `get_day`, `add_task`, `edit_task`, `reorder_task`, `toggle_task`, `delete_task` (return `DayData`)
- ideas: `get_ideas`, `add_idea`, `get_idea`, `edit_idea`, `delete_idea`
- tags: `get_tags`, `get_tagged`, `get_tagged_multi`, `get_tag_colors`
- projects: `get_projects`, `add_project`, `get_project`, `edit_project`, `delete_project`
- storage settings: `get_storage_info`, `set_storage_dir`, `reset_storage_dir`

**A new command must be registered in the `invoke_handler!` macro** (in `run()`) or `invoke()` from the UI rejects with "command not found".

## Storage layout

Storage root is `~/Documents/SuperTodo/` (or the user's Settings choice). Day-files are structured JSON at `todos/todo_YYYYMMDD.json` — an array of items `{ id, checked, carried, rolled, text, description, created, tags }`. Ideas are `ideas/ideas_index.json` + `ideas/<slug>.md`. Projects are `projects/projects_index.json` + `projects/<slug>.md` (notes). `tags.json` holds the persistent tag→color map. Legacy plain-text `todo_*.txt` files are migrated to JSON on first read (inline `#tags` lifted into structured tags).

## Carry-over — the critical invariant

`ensure_today()` runs on every open of today: it carries every unfinished task from the most recent previous day into today's file and marks the source item `rolled`. This is **idempotent** — rolled items are never carried again. The most fragile rules:

- **Never rewrite past-day files.** All mutating commands guard `d >= today()`. The one allowed past-day write is carry-over's own `rolled` marking. Past days are read-only in the UI too.
- **The `rolled` flag must round-trip through read/write.** Dropping it re-triggers carry-over and duplicates tasks.
- **`id` is stable**: generated in `add_task`, preserved through carry-over, backfilled by `write_day_items` for legacy items. It is how agent runs attach to a task across days — never regenerate it.

The storage directory is resolved in `storage_dir()` with this precedence: `SUPERTODO_DIR` env var → user's Settings choice (persisted in `~/Library/Application Support/com.imerwise.supertodo/config.json`) → default `~/Documents/SuperTodo`. Set `SUPERTODO_DIR` during any manual testing so real user data is never touched — it wins over the Settings choice.

## Projects module

A project links exactly one tag (unique across projects, enforced in `edit_project`) to a folder on disk plus Markdown notes. The slug is **immutable** (run records and git branch names reference it); renaming never re-slugs. Deleting a project removes only its metadata — never the folder. UI: `"projects"` mode (⌥P), list + detail; the detail shows items linked via the tag (through `get_tagged_multi`), and the tag-results view shows a Project jump-row when a project owns an active tag.

## Frontend notes

`ui/main.js` holds all view state in module-level `let`s (`mode`, `current`, `editingIndex`, `pendingDeleteIndex`, `selectedIndex`, `dragState`, `ideas`/`ideaDetailSlug`, `projects`/`projectDetailSlug`, tag-flow state, settings state). Re-render is a full-rebuild per view (`renderTodo`, `renderIdeas`, `renderProjects`, …). The app honors `prefers-reduced-motion` — guard any new animation behind `reduceMotion.matches` (see `applyFx`).

## Commit style

Imperative subject, capitalized, no conventional-commit prefix (e.g. `Fix past-day carry-over corruption; make past days read-only`).
