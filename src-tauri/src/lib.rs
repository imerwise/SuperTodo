use chrono::{Local, NaiveDate};
use serde::Serialize;
use std::fs;
use std::path::PathBuf;

// ---------------------------------------------------------------------------
// File format (one task per line):
//
//   [ ] Task to do          -> not done
//   [x] Task to do          -> done
//   [>] Task to do          -> was NOT done and has been rolled over to a
//                              later day (stays visible in the old file)
//   [ ] ↪ Task to do        -> the "↪" marks a task that was carried over
//                              from a previous day into this day's list
//
// Files live in ~/Documents/SuperTodo/todo_YYYYMMDD.txt
// ---------------------------------------------------------------------------

const CARRY_MARK: char = '\u{21AA}'; // ↪

#[derive(Serialize, Clone)]
struct TodoItem {
    checked: bool,
    carried: bool,
    // A [>] line: this task was unfinished and has been rolled over to a later
    // day. It stays in the old file as a record and is shown, read-only, as
    // "moved on". Preserving this flag through read/write is what keeps
    // carry-over idempotent — a rolled item is never carried again.
    rolled: bool,
    text: String,
}

#[derive(Serialize)]
struct DayData {
    date: String,    // 2026-08-03
    weekday: String, // Monday
    pretty: String,  // Monday, August 3, 2026
    is_today: bool,
    is_past: bool,
    exists: bool,
    items: Vec<TodoItem>,
}

// --- paths -----------------------------------------------------------------

fn storage_dir() -> PathBuf {
    // SUPERTODO_DIR overrides the location — used for isolated testing so real
    // data is never touched.
    if let Ok(custom) = std::env::var("SUPERTODO_DIR") {
        if !custom.is_empty() {
            let dir = PathBuf::from(custom);
            let _ = fs::create_dir_all(&dir);
            return dir;
        }
    }
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let dir = PathBuf::from(home).join("Documents").join("SuperTodo");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn file_for(dir: &PathBuf, date: NaiveDate) -> PathBuf {
    dir.join(format!("todo_{}.txt", date.format("%Y%m%d")))
}

// --- parsing / writing -----------------------------------------------------

/// Returns the raw status char of a line ('[?]'), or None if the line is not
/// a recognizable task line.
fn status_char(line: &str) -> Option<char> {
    let b = line.as_bytes();
    if b.len() >= 3 && b[0] == b'[' && b[2] == b']' {
        Some(b[1] as char)
    } else {
        None
    }
}

fn parse_item(line: &str) -> Option<TodoItem> {
    let status = status_char(line)?;
    let checked = status == 'x' || status == 'X';
    let rolled = status == '>';
    let mut rest = line[3..].trim();
    let mut carried = false;
    if let Some(r) = rest.strip_prefix(CARRY_MARK) {
        carried = true;
        rest = r.trim_start();
    }
    if rest.is_empty() {
        return None;
    }
    Some(TodoItem {
        checked,
        carried,
        rolled,
        text: rest.to_string(),
    })
}

fn format_item(item: &TodoItem) -> String {
    // A rolled-over task must round-trip back to [>] — writing it as [ ] would
    // make carry-over re-carry it and duplicate the task.
    let mark = if item.rolled {
        '>'
    } else if item.checked {
        'x'
    } else {
        ' '
    };
    if item.carried {
        format!("[{}] {} {}", mark, CARRY_MARK, item.text)
    } else {
        format!("[{}] {}", mark, item.text)
    }
}

fn read_items(path: &PathBuf) -> Vec<TodoItem> {
    let content = fs::read_to_string(path).unwrap_or_default();
    content.lines().filter_map(parse_item).collect()
}

fn write_items(path: &PathBuf, items: &[TodoItem]) {
    let mut out = String::new();
    for item in items {
        out.push_str(&format_item(item));
        out.push('\n');
    }
    let _ = fs::write(path, out);
}

// --- carry-over ------------------------------------------------------------

/// Finds the most recent existing todo file dated strictly before `today`.
fn find_prev_file(dir: &PathBuf, today: NaiveDate) -> Option<(PathBuf, NaiveDate)> {
    let mut best: Option<(PathBuf, NaiveDate)> = None;
    for entry in fs::read_dir(dir).ok()?.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let digits = name
            .strip_prefix("todo_")
            .and_then(|s| s.strip_suffix(".txt"));
        if let Some(d) = digits {
            if let Ok(date) = NaiveDate::parse_from_str(d, "%Y%m%d") {
                if date < today && best.as_ref().map_or(true, |(_, b)| date > *b) {
                    best = Some((entry.path(), date));
                }
            }
        }
    }
    best
}

/// Ensures today's file is up to date. Carries over every unfinished task from
/// the most recent previous day, appending them to today's list and marking
/// those tasks in the previous day's file as rolled-over ([>]).
///
/// This is idempotent and safe to run on every open: once a task has been
/// carried, its source line becomes [>] and is never carried again. It also
/// works when today's file already exists (e.g. it was pre-created by adding a
/// future task) — carried items are merged in rather than overwriting.
fn ensure_today(dir: &PathBuf, today: NaiveDate) -> PathBuf {
    let path = file_for(dir, today);
    let existed = path.exists();
    let mut items = if existed {
        read_items(&path)
    } else {
        Vec::new()
    };
    let mut carried_any = false;

    if let Some((prev_path, _)) = find_prev_file(dir, today) {
        let content = fs::read_to_string(&prev_path).unwrap_or_default();
        let mut new_lines: Vec<String> = Vec::new();
        let mut prev_changed = false;

        for line in content.lines() {
            match (status_char(line), parse_item(line)) {
                (Some(status), Some(item)) if !item.checked && status != '>' => {
                    // Unfinished -> carry it into today, mark old line as moved.
                    items.push(TodoItem {
                        checked: false,
                        carried: true,
                        rolled: false,
                        text: item.text.clone(),
                    });
                    let mark = if item.carried {
                        format!("{} ", CARRY_MARK)
                    } else {
                        String::new()
                    };
                    new_lines.push(format!("[>] {}{}", mark, item.text));
                    prev_changed = true;
                    carried_any = true;
                }
                _ => new_lines.push(line.trim_end().to_string()),
            }
        }

        if prev_changed {
            let mut updated = new_lines.join("\n");
            updated.push('\n');
            let _ = fs::write(&prev_path, updated);
        }
    }

    if !existed || carried_any {
        write_items(&path, &items);
    }
    path
}

fn today() -> NaiveDate {
    Local::now().date_naive()
}

fn parse_iso(date: &str) -> NaiveDate {
    NaiveDate::parse_from_str(date, "%Y-%m-%d").unwrap_or_else(|_| today())
}

/// Builds the view for a given date. The file for `today` is created (with
/// carry-over) on demand; other dates are never created just by viewing them —
/// so future days stay empty until they actually arrive and carry-over runs.
fn build_day(date: NaiveDate) -> DayData {
    let dir = storage_dir();
    let today = today();
    let is_today = date == today;
    let is_past = date < today;
    let path = if is_today {
        ensure_today(&dir, date)
    } else {
        file_for(&dir, date)
    };
    let exists = path.exists();
    DayData {
        date: date.format("%Y-%m-%d").to_string(),
        weekday: date.format("%A").to_string(),
        pretty: date.format("%B %-d, %Y").to_string(),
        is_today,
        is_past,
        exists,
        items: if exists { read_items(&path) } else { Vec::new() },
    }
}

// --- commands --------------------------------------------------------------

#[tauri::command]
fn get_today() -> DayData {
    build_day(today())
}

#[tauri::command]
fn get_day(date: String) -> DayData {
    build_day(parse_iso(&date))
}

#[tauri::command]
fn add_task(date: String, text: String) -> DayData {
    let d = parse_iso(&date);
    let text = text.trim().to_string();
    // Tasks may only be added to today or a future day, never to the past.
    if !text.is_empty() && d >= today() {
        let dir = storage_dir();
        // For today, ensure carry-over first; other days just get their file.
        let path = if d == today() {
            ensure_today(&dir, d)
        } else {
            file_for(&dir, d)
        };
        let mut items = read_items(&path);
        items.push(TodoItem {
            checked: false,
            carried: false,
            rolled: false,
            text,
        });
        write_items(&path, &items);
    }
    build_day(d)
}

#[tauri::command]
fn edit_task(date: String, index: usize, text: String) -> DayData {
    let d = parse_iso(&date);
    let text = text.trim().to_string();
    // Text edits are allowed only on today or a future day.
    if !text.is_empty() && d >= today() {
        let dir = storage_dir();
        let path = file_for(&dir, d);
        if path.exists() {
            let mut items = read_items(&path);
            if let Some(item) = items.get_mut(index) {
                item.text = text;
                write_items(&path, &items);
            }
        }
    }
    build_day(d)
}

#[tauri::command]
fn reorder_task(date: String, order: Vec<usize>) -> DayData {
    let d = parse_iso(&date);
    // Reordering is allowed only on today or a future day.
    if d >= today() {
        let dir = storage_dir();
        let path = file_for(&dir, d);
        if path.exists() {
            let items = read_items(&path);
            // `order` must be a permutation of 0..items.len().
            if order.len() == items.len() {
                let mut seen = vec![false; items.len()];
                let valid = order.iter().all(|&i| {
                    if i < items.len() && !seen[i] {
                        seen[i] = true;
                        true
                    } else {
                        false
                    }
                });
                if valid {
                    let reordered: Vec<TodoItem> =
                        order.iter().map(|&i| items[i].clone()).collect();
                    write_items(&path, &reordered);
                }
            }
        }
    }
    build_day(d)
}

#[tauri::command]
fn toggle_task(date: String, index: usize) -> DayData {
    let d = parse_iso(&date);
    // Past days are review-only: toggling there is disallowed. Rewriting a past
    // file is the one thing that used to strip [>] markers and re-trigger
    // carry-over, duplicating tasks — so it must never happen.
    if d >= today() {
        let dir = storage_dir();
        let path = file_for(&dir, d);
        if path.exists() {
            let mut items = read_items(&path);
            if let Some(item) = items.get_mut(index) {
                // A rolled-over task lives on in a later day; it isn't toggled.
                if !item.rolled {
                    item.checked = !item.checked;
                    write_items(&path, &items);
                }
            }
        }
    }
    build_day(d)
}

#[tauri::command]
fn delete_task(date: String, index: usize) -> DayData {
    let d = parse_iso(&date);
    // Deletion is allowed only on today or a future day (past is review-only).
    if d >= today() {
        let dir = storage_dir();
        let path = file_for(&dir, d);
        if path.exists() {
            let mut items = read_items(&path);
            if index < items.len() {
                items.remove(index);
                write_items(&path, &items);
            }
        }
    }
    build_day(d)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_today,
            get_day,
            add_task,
            edit_task,
            reorder_task,
            toggle_task,
            delete_task
        ])
        .run(tauri::generate_context!())
        .expect("error while running SuperTodo");
}
