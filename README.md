# SuperTodo

A minimal, file-based macOS desktop app for daily todo lists and ideas. Built with [Tauri 2](https://v2.tauri.app).

Tasks are plain-text files — one per day. Ideas are individual Markdown files with frontmatter. No database, no cloud, no lock-in.

## Features

- **Todo list** — per-day tasks with checkboxes, carry-over, reorder by drag or keyboard
- **Ideas module** — freeform ideas stored as `.md` files with emoji, title, and markdown description
- **Keyboard-driven** — full navigation with arrows, space, enter, delete
- **Option menu** — hold `⌥` to see available commands (`T` Today/Todo, `I` Ideas)
- **Split view** — past days are read-only; future days accept tasks; carry-over is automatic and idempotent

## Keyboard shortcuts

| Key | Action |
|---|---|
| `↑` `↓` | Move selection |
| `←` `→` | Previous / next day |
| `⇧←` `⇧→` | Jump week |
| `Space` | Toggle done |
| `Enter` | Edit task / open idea |
| `Delete` `⌫` | Delete (with confirmation) |
| `⇧↑` `⇧↓` | Reorder task |
| `⌥T` | Go to today (todo) / back to todo (ideas) |
| `⌥I` | Open ideas |
| `Esc` | Back from idea detail / cancel |

## Quick start

```bash
npm install
npm run dev
```

This builds the Rust backend, serves the UI, and launches the app window. Requires Rust (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)).

## Production build

```bash
npm run build
```

The bundled app lands in `src-tauri/target/release/bundle/`.

## Development

```bash
# Rust checks (run from src-tauri/)
cargo check
cargo clippy
cargo build

# Regenerate icons from icon.png
npm run icons
```

## Storage

| Data | Location | Format |
|---|---|---|
| Tasks | `~/Documents/SuperTodo/todo_YYYYMMDD.txt` | One task per line `[ ]`, `[x]`, `[>]` |
| Ideas | `~/Documents/SuperTodo/ideas/<slug>.md` | Markdown with YAML frontmatter |

Set `SUPERTODO_DIR` to an alternate path for testing without touching real data.

## Architecture

- `ui/` — vanilla JS/HTML/CSS, no framework, no bundler
- `src-tauri/` — Rust binary, all data logic via Tauri commands

The two halves communicate through `window.__TAURI__.core.invoke`. Every Tauri command must be registered in `invoke_handler!` in `src-tauri/src/lib.rs`.
