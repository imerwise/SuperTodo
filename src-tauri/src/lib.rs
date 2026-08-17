use chrono::{Local, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

// ---------------------------------------------------------------------------
// Storage: one structured JSON file per day, todos/todo_YYYYMMDD.json, holding
// an array of tasks (text/description/tags/created + checked/carried/rolled).
// Day-files live in a todos/ subfolder, mirroring ideas/, so the storage root
// stays tidy (todos/, ideas/, tags.json).
//
// Older layouts are relocated into todos/ on first read: a pre-todos-folder
// top-level todo_*.json is moved as-is, and a legacy plain-text todo_*.txt
// (from either location) is migrated — inline "#tags" extracted into structured
// tags, the title cleaned, created set to the file's date — then written as JSON.
//
//   Legacy line format:
//     [ ] Task     -> not done      [x] Task -> done
//     [>] Task     -> rolled over to a later day (stays in the old file)
//     [ ] ↪ Task   -> carried over from a previous day
//
// The storage root is ~/Documents/SuperTodo/ (or the folder chosen in Settings).
// ---------------------------------------------------------------------------

const CARRY_MARK: char = '\u{21AA}'; // ↪

/// A compact unique id for a todo item / run: hex epoch-nanos plus a process
/// counter, so ids never collide within a run of the app and practically never
/// across restarts. No external crate needed.
pub(crate) fn new_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{:x}{:04x}", nanos, COUNTER.fetch_add(1, Ordering::Relaxed))
}

#[derive(Serialize, Deserialize, Clone)]
struct TodoItem {
    // Stable id, generated once in add_task and preserved through carry-over,
    // so an agent run can be attached to a task across edits and reorders.
    // Items that predate the field may carry "" until their day-file is next
    // written — write_day_items backfills them.
    #[serde(default)]
    id: String,
    checked: bool,
    carried: bool,
    // A [>] line: this task was unfinished and has been rolled over to a later
    // day. It stays in the old file as a record and is shown, read-only, as
    // "moved on". Preserving this flag through read/write is what keeps
    // carry-over idempotent — a rolled item is never carried again.
    rolled: bool,
    // The task title. Idea-style: no inline "#tags" — tags are stored explicitly
    // below and edited via the detail-view tag box.
    text: String,
    // The Markdown body, edited in the todo detail view. Empty for a bare task.
    #[serde(default)]
    description: String,
    // Original creation date (ISO "YYYY-MM-DD"). Set once when the task is first
    // added and *preserved* when the task carries over to a later day, so the
    // detail view always shows when the task was really created.
    #[serde(default)]
    created: String,
    // Structured tags, authoritative and persisted (like ideas). Edited via the
    // tag box; not parsed from `text`.
    #[serde(default)]
    tags: Vec<String>,
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

// --- idea types ------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone)]
struct IdeaData {
    #[serde(default)]
    id: String,
    slug: String,
    emoji: String,
    title: String,
    description: String,
    created: String, // ISO date "2026-08-04"
    // Structured tags, edited via the detail-view tag box. Authoritative store
    // is the ideas index (like emoji/created) — not parsed from title/body.
    #[serde(default)]
    tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
struct IdeaListEntry {
    #[serde(default)]
    id: String,
    slug: String,
    emoji: String,
    title: String,
    created: String,
    #[serde(default)]
    tags: Vec<String>,
}

// --- app config ------------------------------------------------------------
// The storage directory is user-configurable (Settings). The choice is persisted
// in a small config file that lives *outside* the data directory — in the OS app
// support folder — so it survives even when the data directory itself is changed.

const APP_IDENTIFIER: &str = "com.imerwise.supertodo";

#[derive(Serialize, Deserialize, Default)]
struct AppConfig {
    // Absolute path chosen by the user. Empty/None means "use the default".
    #[serde(default)]
    storage_dir: Option<String>,
    }

pub(crate) fn config_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home)
        .join("Library")
        .join("Application Support")
        .join(APP_IDENTIFIER)
}

fn config_path() -> PathBuf {
    config_dir().join("config.json")
}

pub(crate) fn read_config() -> AppConfig {
    fs::read_to_string(config_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub(crate) fn write_config(cfg: &AppConfig) {
    let dir = config_dir();
    let _ = fs::create_dir_all(&dir);
    if let Ok(json) = serde_json::to_string_pretty(cfg) {
        let _ = fs::write(config_path(), json);
    }
}

// --- paths -----------------------------------------------------------------

fn default_storage_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join("Documents").join("SuperTodo")
}

pub(crate) fn storage_dir() -> PathBuf {
    // SUPERTODO_DIR overrides everything — used for isolated testing so real
    // data is never touched. When set, it also wins over the user's Settings
    // choice; get_storage_info reports this so the UI can disable the controls.
    if let Ok(custom) = std::env::var("SUPERTODO_DIR") {
        if !custom.is_empty() {
            let dir = PathBuf::from(custom);
            let _ = fs::create_dir_all(&dir);
            return dir;
        }
    }
    // A folder chosen in Settings takes precedence over the built-in default.
    if let Some(custom) = read_config().storage_dir {
        if !custom.trim().is_empty() {
            let dir = PathBuf::from(custom.trim());
            let _ = fs::create_dir_all(&dir);
            return dir;
        }
    }
    let dir = default_storage_dir();
    let _ = fs::create_dir_all(&dir);
    dir
}

/// The todos subfolder (created on demand), where day-files live — mirroring the
/// ideas folder. Keeps the storage root tidy: just todos/, ideas/ and tags.json.
fn todos_dir(dir: &PathBuf) -> PathBuf {
    let todos = dir.join("todos");
    let _ = fs::create_dir_all(&todos);
    todos
}

/// The canonical structured day-file: <dir>/todos/todo_YYYYMMDD.json
fn json_file_for(dir: &PathBuf, date: NaiveDate) -> PathBuf {
    todos_dir(dir).join(format!("todo_{}.json", date.format("%Y%m%d")))
}

/// A pre-todos-folder JSON day-file at the storage root — a read-only source that
/// load_day_items relocates into the todos folder.
fn legacy_json_file_for(dir: &PathBuf, date: NaiveDate) -> PathBuf {
    dir.join(format!("todo_{}.json", date.format("%Y%m%d")))
}

/// Legacy plain-text day-files to migrate from, newest layout first: inside the
/// todos folder, then the old storage root.
fn txt_candidates(dir: &PathBuf, date: NaiveDate) -> [PathBuf; 2] {
    let name = format!("todo_{}.txt", date.format("%Y%m%d"));
    [todos_dir(dir).join(&name), dir.join(name)]
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

/// Extracts inline hashtags ("#work", "#big-idea") from arbitrary text. A tag is
/// `#` followed by one or more of [A-Za-z0-9_-]. Order-preserving, deduped
/// case-insensitively, returned without the leading `#`.
fn extract_tags(text: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let bytes = text.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'#' {
            let start = i + 1;
            let mut j = start;
            while j < bytes.len() {
                let c = bytes[j];
                if c.is_ascii_alphanumeric() || c == b'_' || c == b'-' {
                    j += 1;
                } else {
                    break;
                }
            }
            if j > start {
                let tag = &text[start..j];
                if !out.iter().any(|t| t.eq_ignore_ascii_case(tag)) {
                    out.push(tag.to_string());
                }
            }
            i = j;
        } else {
            i += 1;
        }
    }
    out
}

/// Removes inline "#tag" tokens (same char class as `extract_tags`) from text
/// and collapses the leftover whitespace. Used when migrating legacy tasks so a
/// stored title reads like an idea's — clean, with tags held separately.
fn strip_tags(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::new();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '#' {
            let start = i + 1;
            let mut j = start;
            while j < chars.len() {
                let c = chars[j];
                if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
                    j += 1;
                } else {
                    break;
                }
            }
            if j > start {
                i = j;
                continue;
            }
        }
        out.push(chars[i]);
        i += 1;
    }
    out.split_whitespace().collect::<Vec<&str>>().join(" ")
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
    let tags = extract_tags(rest);
    Some(TodoItem {
        id: String::new(), // backfilled on write
        checked,
        carried,
        rolled,
        text: rest.to_string(),
        description: String::new(),
        created: String::new(),
        tags,
    })
}

/// Reads the structured tasks from a JSON day-file path. Empty/missing/invalid
/// yields an empty list.
fn read_items_json(path: &PathBuf) -> Vec<TodoItem> {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

/// Migrates a legacy plain-text day-file into structured tasks: inline "#tags"
/// become explicit tags, the title is cleaned of them, and `created` is set to
/// the file's own date (the best available original date).
fn migrate_txt_items(path: &PathBuf, iso_date: &str) -> Vec<TodoItem> {
    let content = fs::read_to_string(path).unwrap_or_default();
    content
        .lines()
        .filter_map(parse_item)
        .map(|mut item| {
            item.tags = extract_tags(&item.text);
            item.text = strip_tags(&item.text);
            item.description = String::new();
            item.created = iso_date.to_string();
            item
        })
        .filter(|item| !item.text.is_empty())
        .collect()
}

/// Whether any day-file exists for `date` — the canonical todos-folder JSON, a
/// legacy top-level JSON, or a legacy .txt in either location.
fn day_exists(dir: &PathBuf, date: NaiveDate) -> bool {
    json_file_for(dir, date).exists()
        || legacy_json_file_for(dir, date).exists()
        || txt_candidates(dir, date).iter().any(|p| p.exists())
}

/// Loads a day's tasks, relocating older layouts into the todos folder on first
/// touch: the canonical JSON is used as-is; a pre-todos-folder top-level JSON is
/// moved into todos/; a legacy .txt (either location) is migrated to JSON.
fn load_day_items(dir: &PathBuf, date: NaiveDate) -> Vec<TodoItem> {
    let json_path = json_file_for(dir, date);
    if json_path.exists() {
        return read_items_json(&json_path);
    }
    // Relocate a top-level JSON from before the todos folder existed.
    let legacy_json = legacy_json_file_for(dir, date);
    if legacy_json.exists() {
        let items = read_items_json(&legacy_json);
        write_day_items(dir, date, &items);
        let _ = fs::remove_file(&legacy_json);
        return items;
    }
    // Migrate a plain-text day-file (todos folder or storage root) into JSON.
    for txt in txt_candidates(dir, date) {
        if txt.exists() {
            let iso = date.format("%Y-%m-%d").to_string();
            let items = migrate_txt_items(&txt, &iso);
            write_day_items(dir, date, &items);
            return items;
        }
    }
    Vec::new()
}

/// Writes a day's tasks to its JSON file, backfilling ids on items that
/// predate the id field. Backfill never extends writes to past days: this is
/// only called for past files by carry-over's own (already guarded) write.
fn write_day_items(dir: &PathBuf, date: NaiveDate, items: &[TodoItem]) {
    let mut items = items.to_vec();
    for item in items.iter_mut() {
        if item.id.is_empty() {
            item.id = new_id();
        }
    }
    let path = json_file_for(dir, date);
    if let Ok(json) = serde_json::to_string_pretty(&items) {
        let _ = fs::write(&path, json);
    }
}

/// Every date that has a day-file, deduped — scanning both the todos folder
/// (canonical) and the storage root (legacy layouts still awaiting relocation).
fn all_todo_dates(dir: &PathBuf) -> Vec<NaiveDate> {
    use std::collections::BTreeSet;
    let mut dates: BTreeSet<NaiveDate> = BTreeSet::new();
    for scan in [todos_dir(dir), dir.clone()] {
        if let Ok(rd) = fs::read_dir(&scan) {
            for entry in rd.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                let digits = name
                    .strip_prefix("todo_")
                    .and_then(|s| s.strip_suffix(".json").or_else(|| s.strip_suffix(".txt")));
                if let Some(d) = digits {
                    if let Ok(date) = NaiveDate::parse_from_str(d, "%Y%m%d") {
                        dates.insert(date);
                    }
                }
            }
        }
    }
    dates.into_iter().collect()
}

// --- ideas helpers ---------------------------------------------------------

fn ideas_dir(dir: &PathBuf) -> PathBuf {
    let ideas = dir.join("ideas");
    let _ = fs::create_dir_all(&ideas);
    ideas
}

fn idea_file_path(ideas: &PathBuf, slug: &str) -> PathBuf {
    ideas.join(format!("{}.json", slug))
}

/// Reads every per-idea JSON file from disk and returns a sorted list.
/// Single source of truth — no separate index file.
fn read_all_ideas(dir: &PathBuf) -> Vec<IdeaListEntry> {
    let ideas = ideas_dir(dir);
    let mut entries: Vec<IdeaListEntry> = Vec::new();
    if let Ok(rd) = fs::read_dir(&ideas) {
        for entry in rd.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }
            let Some(data) = read_idea_json(&ideas, path.file_stem().and_then(|s| s.to_str()).unwrap_or_default()) else {
                continue;
            };
            entries.push(IdeaListEntry {
                id: data.id,
                slug: data.slug,
                emoji: data.emoji,
                title: data.title,
                created: data.created,
                tags: data.tags,
            });
        }
    }
    entries.sort_by(|a, b| b.created.cmp(&a.created).then(a.slug.cmp(&b.slug)));
    eprintln!("[ideas] read_all_ideas: {} entries", entries.len());
    entries
}

// --- global tag vocabulary -------------------------------------------------
// The shared hashtag list is *derived on demand*, never persisted: it is exactly
// the set of tags currently in use across all todos and ideas. This makes orphan
// tags structurally impossible — a tag exists iff something still carries it —
// and stays correct even when the plain-text files are hand-edited or a task is
// carried over into a new day file.

/// Returns every in-use tag ordered by **first appearance** — the earliest date
/// (todo day-file date or idea `created` date) on which the tag shows up, with an
/// alphabetical tie-break within a day. This order is what drives the looping
/// chip-color assignment: it is stable as tags are added (a new tag lands at the
/// end) and is derived purely from the files, so it needs no persisted state.
fn tags_in_creation_order(dir: &PathBuf) -> Vec<String> {
    use std::collections::HashMap;
    // lowercased tag -> (earliest ISO date, first-seen display form)
    let mut first: HashMap<String, (String, String)> = HashMap::new();

    fn note(first: &mut HashMap<String, (String, String)>, tag: &str, date: &str) {
        if tag.is_empty() {
            return;
        }
        let key = tag.to_lowercase();
        let replace = match first.get(&key) {
            Some((d, _)) => date < d.as_str(),
            None => true,
        };
        if replace {
            first.insert(key, (date.to_string(), tag.to_string()));
        }
    }

    for date in all_todo_dates(dir) {
        let file_iso = date.format("%Y-%m-%d").to_string();
        for item in load_day_items(dir, date) {
            // Prefer the task's own creation date; fall back to the day-file's
            // date for anything migrated/older without one.
            let iso = if item.created.is_empty() {
                file_iso.clone()
            } else {
                item.created.clone()
            };
            for t in &item.tags {
                note(&mut first, t, &iso);
            }
        }
    }

    for entry in read_all_ideas(dir) {
        // Ideas with no recorded date sort last but stay included.
        let iso = if entry.created.is_empty() {
            "9999-12-31".to_string()
        } else {
            entry.created.clone()
        };
        for t in &entry.tags {
            note(&mut first, t, &iso);
        }
    }

    let mut items: Vec<(String, String)> = first.into_values().collect(); // (date, display)
    items.sort_by(|a, b| {
        a.0.cmp(&b.0)
            .then_with(|| a.1.to_lowercase().cmp(&b.1.to_lowercase()))
    });
    items.into_iter().map(|(_, name)| name).collect()
}

fn slugify(title: &str) -> String {
    let slug: String = title
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == ' ' {
                c
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join("-");
    let result = if slug.is_empty() { "untitled".to_string() } else { slug };
    eprintln!("[ideas] slugify: {:?} -> {}", title, result);
    result
}

fn read_idea_json(ideas: &PathBuf, slug: &str) -> Option<IdeaData> {
    let path = idea_file_path(ideas, slug);
    eprintln!("[ideas] read_idea_json: slug={} path={}", slug, path.display());
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
}

fn write_idea_json(ideas: &PathBuf, idea: &IdeaData) {
    let path = idea_file_path(ideas, &idea.slug);
    eprintln!("[ideas] write_idea_json: slug={} path={} title={:?} desc_len={}",
        idea.slug, path.display(), idea.title, idea.description.len());
    if let Ok(json) = serde_json::to_string_pretty(idea) {
        let _ = fs::write(&path, json);
    }
}

/// Parses the title and description body from a Markdown idea file.
/// Kept as a migration helper for converting legacy .md files.
fn parse_idea_md_content(content: &str) -> (String, String) {
    let trimmed = content.trim();
    if let Some(idx) = trimmed.find('\n') {
        let first_line = trimmed[..idx].trim();
        let rest = trimmed[idx..].trim().to_string();
        if first_line.starts_with("# ") {
            (first_line[2..].trim().to_string(), rest)
        } else {
            (first_line.to_string(), rest)
        }
    } else {
        if trimmed.starts_with("# ") {
            (trimmed[2..].trim().to_string(), String::new())
        } else {
            (trimmed.to_string(), String::new())
        }
    }
}

/// Generate a unique slug by appending -N if the slug already exists.
fn unique_slug(dir: &PathBuf, base: &str) -> String {
    let entries = read_all_ideas(dir);
    eprintln!("[ideas] unique_slug: base={} existing_entries={}", base, entries.len());
    let mut slug = base.to_string();
    let mut counter = 1;
    while entries.iter().any(|e| e.slug == slug) {
        slug = format!("{}-{}", base, counter);
        counter += 1;
    }
    eprintln!("[ideas] unique_slug: result={}", slug);
    slug
}

// --- carry-over ------------------------------------------------------------

/// The most recent day (JSON or legacy .txt) dated strictly before `today`.
fn find_prev_day(dir: &PathBuf, today: NaiveDate) -> Option<NaiveDate> {
    all_todo_dates(dir)
        .into_iter()
        .filter(|d| *d < today)
        .max()
}

/// Ensures today's file is up to date. Carries over every unfinished task from
/// the most recent previous day, appending them to today's list and marking
/// those tasks in the previous day's file as rolled-over ([>]).
///
/// This is idempotent and safe to run on every open: once a task has been
/// carried, its source line becomes [>] and is never carried again. It also
/// works when today's file already exists (e.g. it was pre-created by adding a
/// future task) — carried items are merged in rather than overwriting.
fn ensure_today(dir: &PathBuf, today: NaiveDate) {
    let existed = day_exists(dir, today);
    let mut items = if existed {
        load_day_items(dir, today)
    } else {
        Vec::new()
    };
    let mut carried_any = false;

    if let Some(prev_date) = find_prev_day(dir, today) {
        let mut prev_items = load_day_items(dir, prev_date);
        let mut prev_changed = false;

        for src in prev_items.iter_mut() {
            // Unfinished and not already rolled -> carry it into today, keeping
            // the original created date, description and tags. Mark the source
            // as rolled so it is never carried again (idempotent on re-open).
            if !src.checked && !src.rolled {
                items.push(TodoItem {
                    id: src.id.clone(), // the task keeps its identity across days
                    checked: false,
                    carried: true,
                    rolled: false,
                    text: src.text.clone(),
                    description: src.description.clone(),
                    created: src.created.clone(),
                    tags: src.tags.clone(),
                });
                src.rolled = true;
                prev_changed = true;
                carried_any = true;
            }
        }

        if prev_changed {
            write_day_items(dir, prev_date, &prev_items);
        }
    }

    if !existed || carried_any {
        write_day_items(dir, today, &items);
    }
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
    if is_today {
        ensure_today(&dir, date);
    }
    let exists = day_exists(&dir, date);
    DayData {
        date: date.format("%Y-%m-%d").to_string(),
        weekday: date.format("%A").to_string(),
        pretty: date.format("%B %-d, %Y").to_string(),
        is_today,
        is_past,
        exists,
        items: if exists { load_day_items(&dir, date) } else { Vec::new() },
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
    let raw = text.trim().to_string();
    // Tasks may only be added to today or a future day, never to the past.
    if !raw.is_empty() && d >= today() {
        let dir = storage_dir();
        // For today, ensure carry-over first; other days just get their file.
        if d == today() {
            ensure_today(&dir, d);
        }
        let mut items = load_day_items(&dir, d);
        // Idea-style: the title stands alone. As a convenience any inline "#tags"
        // typed in the composer are lifted into structured tags and stripped from
        // the title — but typing "#" is not required; tags are normally added in
        // the detail view.
        let tags = extract_tags(&raw);
        let stripped = strip_tags(&raw);
        // If the composer held only "#tags", keep the raw text as the title
        // rather than storing an empty one.
        let text = if stripped.is_empty() { raw } else { stripped };
        items.push(TodoItem {
            id: new_id(),
            checked: false,
            carried: false,
            rolled: false,
            text,
            description: String::new(),
            created: today().format("%Y-%m-%d").to_string(),
            tags,
        });
        write_day_items(&dir, d, &items);
    }
    build_day(d)
}

/// Edits a task's title, description and/or tags — each field independent and
/// optional, mirroring `edit_idea`. Allowed only on today or a future day.
#[tauri::command]
fn edit_task(
    date: String,
    index: usize,
    text: Option<String>,
    description: Option<String>,
    tags: Option<Vec<String>>,
) -> DayData {
    let d = parse_iso(&date);
    let dir = storage_dir();
    if d >= today() && day_exists(&dir, d) {
        let mut items = load_day_items(&dir, d);
        if let Some(item) = items.get_mut(index) {
            let mut changed = false;
            if let Some(t) = text {
                let t = t.trim().to_string();
                if !t.is_empty() {
                    // Convenience: lift any inline "#tags" out of the new title
                    // and merge them into the structured tags (explicit tags set
                    // via `tags` still win when provided).
                    let extracted = extract_tags(&t);
                    let stripped = strip_tags(&t);
                    item.text = if stripped.is_empty() { t } else { stripped };
                    if !extracted.is_empty() {
                        let mut merged = item.tags.clone();
                        for e in extracted {
                            if !merged.iter().any(|x| x.eq_ignore_ascii_case(&e)) {
                                merged.push(e);
                            }
                        }
                        item.tags = normalize_tags(&merged);
                    }
                    changed = true;
                }
            }
            if let Some(desc) = description {
                item.description = desc;
                changed = true;
            }
            if let Some(tg) = tags {
                item.tags = normalize_tags(&tg);
                changed = true;
            }
            if changed {
                write_day_items(&dir, d, &items);
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
        if day_exists(&dir, d) {
            let items = load_day_items(&dir, d);
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
                    write_day_items(&dir, d, &reordered);
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
        if day_exists(&dir, d) {
            let mut items = load_day_items(&dir, d);
            if let Some(item) = items.get_mut(index) {
                // A rolled-over task lives on in a later day; it isn't toggled.
                if !item.rolled {
                    item.checked = !item.checked;
                    write_day_items(&dir, d, &items);
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
        if day_exists(&dir, d) {
            let mut items = load_day_items(&dir, d);
            if index < items.len() {
                items.remove(index);
                write_day_items(&dir, d, &items);
            }
        }
    }
    build_day(d)
}

// --- idea commands ---------------------------------------------------------

#[tauri::command]
fn get_ideas() -> Vec<IdeaListEntry> {
    eprintln!("[ideas] COMMAND get_ideas");
    let dir = storage_dir();
    let entries = read_all_ideas(&dir);
    eprintln!("[ideas] COMMAND get_ideas: returning {} entries", entries.len());
    entries
}

#[derive(Serialize)]
struct AddIdeaResult {
    entries: Vec<IdeaListEntry>,
    new_slug: String,
}

#[tauri::command]
fn add_idea(title: String) -> AddIdeaResult {
    eprintln!("[ideas] COMMAND add_idea: title={:?}", title);
    let title = title.trim().to_string();
    if title.is_empty() {
        eprintln!("[ideas] COMMAND add_idea: empty title, returning existing ideas");
        let entries = get_ideas();
        return AddIdeaResult { entries, new_slug: String::new() };
    }
    let dir = storage_dir();
    let ideas = ideas_dir(&dir);
    eprintln!("[ideas] COMMAND add_idea: ideas_dir={}", ideas.display());
    let base = slugify(&title);
    let slug = unique_slug(&dir, &base);
    let created = Utc::now().format("%Y-%m-%d").to_string();
    eprintln!("[ideas] COMMAND add_idea: slug={} created={}", slug, created);

    let idea_id = new_id();
    let idea = IdeaData {
        id: idea_id,
        slug: slug.clone(),
        emoji: String::from("💡"),
        title: title.clone(),
        description: String::new(),
        created: created.clone(),
        tags: Vec::new(),
    };
    write_idea_json(&ideas, &idea);

    let slug_copy = slug;
    let entries = read_all_ideas(&dir);
    eprintln!("[ideas] COMMAND add_idea: done, {} entries total", entries.len());
    AddIdeaResult { entries, new_slug: slug_copy }
}

#[tauri::command]
fn get_idea(slug: String) -> Option<IdeaData> {
    eprintln!("[ideas] COMMAND get_idea: slug={}", slug);
    let dir = storage_dir();
    let ideas = ideas_dir(&dir);
    let result = read_idea_json(&ideas, &slug)?;
    eprintln!("[ideas] COMMAND get_idea: result={:?}", (&result.title, &result.emoji, result.description.len()));
    Some(result)
}

#[derive(Serialize)]
struct EditIdeaResult {
    entries: Vec<IdeaListEntry>,
    new_slug: Option<String>,
}

/// Cleans a caller-supplied tag list: strips any leading '#', trims, drops
/// empties, and dedupes case-insensitively (first-seen form kept).
fn normalize_tags(tags: &[String]) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for t in tags {
        let t = t.trim().trim_start_matches('#').trim();
        if t.is_empty() {
            continue;
        }
        if !out.iter().any(|e: &String| e.eq_ignore_ascii_case(t)) {
            out.push(t.to_string());
        }
    }
    out
}

#[tauri::command]
fn edit_idea(slug: String, emoji: Option<String>, title: Option<String>, description: Option<String>, tags: Option<Vec<String>>) -> EditIdeaResult {
    eprintln!("[ideas] COMMAND edit_idea: slug={} emoji={:?} title={:?} description_len={:?} tags={:?}", slug, emoji, title, description.as_ref().map(|d| d.len()), tags);
    let dir = storage_dir();
    let ideas = ideas_dir(&dir);

    let mut idea = match read_idea_json(&ideas, &slug) {
        Some(i) => i,
        None => {
            let entries = read_all_ideas(&dir);
            eprintln!("[ideas] COMMAND edit_idea: .json file not found, returning {} entries", entries.len());
            return EditIdeaResult { entries, new_slug: None };
        }
    };

    let mut new_slug = None;

    if let Some(e) = emoji {
        if !e.is_empty() {
            idea.emoji = e;
        }
    }
    if let Some(t) = title {
        if !t.is_empty() && t != idea.title {
            let base = slugify(&t);
            let slug_no_counter = unique_slug(&dir, &base);
            let old_path = idea_file_path(&ideas, &slug);
            let _ = fs::remove_file(&old_path);
            idea.title = t;
            idea.slug = slug_no_counter.clone();
            new_slug = Some(slug_no_counter);
        }
    }
    if let Some(d) = description {
        idea.description = d;
    }
    if let Some(t) = tags {
        idea.tags = normalize_tags(&t);
    }

    write_idea_json(&ideas, &idea);
    let entries = read_all_ideas(&dir);
    eprintln!("[ideas] COMMAND edit_idea: done, {} entries, new_slug={:?}", entries.len(), new_slug);
    EditIdeaResult { entries, new_slug }
}

#[tauri::command]
fn delete_idea(slug: String) -> Vec<IdeaListEntry> {
    eprintln!("[ideas] COMMAND delete_idea: slug={}", slug);
    let dir = storage_dir();
    let ideas = ideas_dir(&dir);

    let path = idea_file_path(&ideas, &slug);
    eprintln!("[ideas] COMMAND delete_idea: removing file {}", path.display());
    let _ = fs::remove_file(&path);

    let entries = read_all_ideas(&dir);
    eprintln!("[ideas] COMMAND delete_idea: done, {} entries remaining", entries.len());
    entries
}

// --- tag commands ----------------------------------------------------------

/// One todo that matched a tag query, carrying its source day so the UI can
/// show and navigate to it.
#[derive(Serialize)]
struct TaggedTodo {
    date: String,  // YYYY-MM-DD
    index: usize,  // position within its day, so the UI can open its detail
    id: String,    // stable task id (may be "" for never-rewritten legacy items)
    checked: bool,
    rolled: bool,
    text: String,
    tags: Vec<String>,
}

#[derive(Serialize)]
struct TaggedResult {
    tag: String,
    todos: Vec<TaggedTodo>,
    ideas: Vec<IdeaListEntry>,
}

/// The in-use tag vocabulary (deduped), for autocomplete and the Tags view.
/// Derived on demand, so orphaned tags never appear as suggestions.
#[tauri::command]
fn get_tags() -> Vec<String> {
    let dir = storage_dir();
    tags_in_creation_order(&dir)
}

// --- persistent chip colors (tags.json) ------------------------------------
// tags.json is a flat { "tag": color } map. A tag keeps its stored color for as
// long as it is used; when it is no longer referenced anywhere it is pruned. A
// new tag takes the first available color — the lowest-numbered palette slot not
// currently used by another live tag — so pruning frees a color for reuse. Once
// all ten are in use, the least-used slot (lowest number on a tie) is chosen.

type TagColorMap = std::collections::HashMap<String, u8>; // lowercased tag -> 1..10

fn tags_colors_path(dir: &PathBuf) -> PathBuf {
    dir.join("tags.json")
}

fn read_tag_colors(dir: &PathBuf) -> TagColorMap {
    let s = fs::read_to_string(tags_colors_path(dir)).unwrap_or_default();
    // Current flat format.
    if let Ok(m) = serde_json::from_str::<TagColorMap>(&s) {
        return m;
    }
    // Legacy { next, map } object from an earlier build — keep the colors.
    #[derive(Deserialize)]
    struct Legacy {
        #[serde(default)]
        map: TagColorMap,
    }
    if let Ok(l) = serde_json::from_str::<Legacy>(&s) {
        return l.map;
    }
    // Anything else (e.g. the oldest array format) starts empty.
    TagColorMap::new()
}

fn write_tag_colors(dir: &PathBuf, map: &TagColorMap) {
    if let Ok(json) = serde_json::to_string_pretty(map) {
        let _ = fs::write(tags_colors_path(dir), json);
    }
}

/// The lowest-numbered palette color (1..=10) least used by the current map.
fn first_available_color(map: &TagColorMap) -> u8 {
    let mut counts = [0u32; 11]; // index 1..=10
    for &c in map.values() {
        if (1..=10).contains(&c) {
            counts[c as usize] += 1;
        }
    }
    let mut best = 1u8;
    for c in 2..=10u8 {
        if counts[c as usize] < counts[best as usize] {
            best = c;
        }
    }
    best
}

/// The tag -> color map (keys lowercased), reconciled against what's actually in
/// use: orphaned tags are pruned, and any in-use tag without a color is assigned
/// the first available color. Existing tags' colors are never changed.
#[tauri::command]
fn get_tag_colors() -> TagColorMap {
    use std::collections::HashSet;
    let dir = storage_dir();
    let mut map = read_tag_colors(&dir);

    let in_use = tags_in_creation_order(&dir); // display forms, creation order
    let in_use_lower: HashSet<String> = in_use.iter().map(|t| t.to_lowercase()).collect();

    let mut changed = false;
    let before = map.len();
    map.retain(|k, _| in_use_lower.contains(k));
    if map.len() != before {
        changed = true;
    }
    for t in &in_use {
        let key = t.to_lowercase();
        if !map.contains_key(&key) {
            let color = first_available_color(&map);
            map.insert(key, color);
            changed = true;
        }
    }

    if changed {
        write_tag_colors(&dir, &map);
    }
    map
}

/// Returns every todo (across all day files) and every idea whose tags include
/// `tag` (case-insensitive). Read-only: it never rewrites any file.
#[tauri::command]
fn get_tagged(tag: String) -> TaggedResult {
    get_tagged_multi(vec![tag], false)
}

/// Returns every todo (across all day files) and every idea matching a set of
/// tags (case-insensitive). With `match_all` an item must carry *every* tag;
/// otherwise carrying *any* one of them is enough. Read-only: never rewrites a
/// file. `result.tag` is the matched tags joined with ", " for display.
#[tauri::command]
fn get_tagged_multi(tags: Vec<String>, match_all: bool) -> TaggedResult {
    let dir = storage_dir();
    let needles: Vec<String> = tags
        .into_iter()
        .map(|t| t.trim().trim_start_matches('#').trim().to_string())
        .filter(|t| !t.is_empty())
        .collect();

    // Whether an item's tags satisfy the query under the current match mode.
    let matches = |item_tags: &[String]| -> bool {
        if needles.is_empty() {
            return false;
        }
        let has = |n: &String| item_tags.iter().any(|t| t.eq_ignore_ascii_case(n));
        if match_all {
            needles.iter().all(has)
        } else {
            needles.iter().any(has)
        }
    };

    let mut todos: Vec<TaggedTodo> = Vec::new();
    if !needles.is_empty() {
        use std::collections::HashSet;
        // Deduplicate by id: a carried-over task appears in multiple day-files
        // with the same id. Since we iterate newest-first, the first occurrence
        // of each id is the most recent one; we keep it and skip the rest.
        // Items with empty id (legacy) are never deduplicated.
        let mut seen: HashSet<String> = HashSet::new();
        let mut dates = all_todo_dates(&dir);
        dates.sort_by_key(|date| std::cmp::Reverse(*date));
        for date in dates {
            for (index, item) in load_day_items(&dir, date).into_iter().enumerate() {
                if matches(&item.tags) {
                    if !item.id.is_empty() && !seen.insert(item.id.clone()) {
                        continue;
                    }
                    todos.push(TaggedTodo {
                        date: date.format("%Y-%m-%d").to_string(),
                        index,
                        id: item.id.clone(),
                        checked: item.checked,
                        rolled: item.rolled,
                        text: item.text,
                        tags: item.tags,
                    });
                }
            }
        }
    }

    let ideas: Vec<IdeaListEntry> = if needles.is_empty() {
        Vec::new()
    } else {
        read_all_ideas(&dir)
            .into_iter()
            .filter(|e| matches(&e.tags))
            .collect()
    };

    TaggedResult { tag: needles.join(", "), todos, ideas }
}

// --- projects ---------------------------------------------------------------
// A project links exactly one tag to a folder on disk (typically a code
// repository) plus free-form Markdown notes. It is what agent runs work on:
// dispatching an agent on a tagged todo/idea runs it in the owning project's
// folder. Metadata lives in projects/projects_index.json; the notes body in
// projects/<slug>.md. The slug is immutable once created — run records and
// git branch names reference it. Deleting a project only removes its metadata;
// the folder on disk is never touched.

#[derive(Serialize, Deserialize, Clone, Debug)]
struct ProjectListEntry {
    #[serde(default)]
    id: String,
    slug: String,
    name: String,
    // The single owning tag, without a leading '#'. "" until the user sets one.
    tag: String,
    // Absolute path of the project folder. "" until the user picks one.
    path: String,
    created: String, // ISO date "2026-08-06"
}

#[derive(Serialize)]
struct ProjectData {
    #[serde(default)]
    id: String,
    slug: String,
    name: String,
    tag: String,
    path: String,
    created: String,
    // The Markdown notes body (projects/<slug>.md), edited in the detail view.
    notes: String,
}

fn projects_dir(dir: &PathBuf) -> PathBuf {
    let projects = dir.join("projects");
    let _ = fs::create_dir_all(&projects);
    projects
}

fn projects_index_path(dir: &PathBuf) -> PathBuf {
    projects_dir(dir).join("projects_index.json")
}

fn project_notes_path(dir: &PathBuf, slug: &str) -> PathBuf {
    projects_dir(dir).join(format!("{}.md", slug))
}

/// The project index, sorted alphabetically by name (case-insensitive) with a
/// slug tie-break — a stable, small set, so no date ordering is needed.
pub(crate) fn read_projects_index(dir: &PathBuf) -> Vec<ProjectListEntry> {
    let mut entries: Vec<ProjectListEntry> =
        fs::read_to_string(projects_index_path(dir))
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
    entries.sort_by(|a, b| {
        a.name
            .to_lowercase()
            .cmp(&b.name.to_lowercase())
            .then(a.slug.cmp(&b.slug))
    });
    entries
}

fn write_projects_index(dir: &PathBuf, entries: &[ProjectListEntry]) {
    if let Ok(json) = serde_json::to_string_pretty(entries) {
        let _ = fs::write(projects_index_path(dir), json);
    }
}

/// Cleans and validates a project tag: trims, strips leading '#', and requires
/// the same charset as any tag ([A-Za-z0-9_-]+). Returns Err on bad input.
fn normalize_project_tag(tag: &str) -> Result<String, String> {
    let t = tag.trim().trim_start_matches('#').trim().to_string();
    if t.is_empty() {
        return Ok(t); // clearing the tag is allowed (project just unlinks)
    }
    if !t
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err(format!("Invalid tag \"{t}\" — letters, digits, _ and - only."));
    }
    Ok(t)
}

#[tauri::command]
fn get_projects() -> Vec<ProjectListEntry> {
    read_projects_index(&storage_dir())
}

#[derive(Serialize)]
struct AddProjectResult {
    entries: Vec<ProjectListEntry>,
    new_slug: String,
}

#[tauri::command]
fn add_project(name: String) -> AddProjectResult {
    let name = name.trim().to_string();
    let dir = storage_dir();
    let mut entries = read_projects_index(&dir);
    if name.is_empty() {
        return AddProjectResult { entries, new_slug: String::new() };
    }
    // Unique slug, mirroring unique_slug for ideas (which is typed to ideas).
    let base = slugify(&name);
    let mut slug = base.clone();
    let mut counter = 1;
    while entries.iter().any(|e| e.slug == slug) {
        slug = format!("{}-{}", base, counter);
        counter += 1;
    }
    let created = today().format("%Y-%m-%d").to_string();
    entries.push(ProjectListEntry {
        id: new_id(),
        slug: slug.clone(),
        name,
        tag: String::new(),
        path: String::new(),
        created,
    });
    write_projects_index(&dir, &entries);
    AddProjectResult {
        entries: read_projects_index(&dir),
        new_slug: slug,
    }
}

#[tauri::command]
fn get_project(slug: String) -> Option<ProjectData> {
    let dir = storage_dir();
    let entry = read_projects_index(&dir)
        .into_iter()
        .find(|e| e.slug == slug)?;
    let notes = fs::read_to_string(project_notes_path(&dir, &slug)).unwrap_or_default();
    Some(ProjectData {
        id: entry.id,
        slug: entry.slug,
        name: entry.name,
        tag: entry.tag,
        path: entry.path,
        created: entry.created,
        notes: notes.trim_end().to_string(),
    })
}

#[derive(Serialize, Debug)]
struct EditProjectResult {
    entries: Vec<ProjectListEntry>,
}

/// Edits a project's name, tag, folder path and/or notes — each field
/// independent and optional. The tag must stay unique across projects
/// (case-insensitive): one project per tag, so a tagged item maps to at most
/// one project. The folder path, when given, must be an existing directory.
#[tauri::command]
fn edit_project(
    slug: String,
    name: Option<String>,
    tag: Option<String>,
    path: Option<String>,
    notes: Option<String>,
) -> Result<EditProjectResult, String> {
    let dir = storage_dir();
    let mut entries = read_projects_index(&dir);
    let Some(idx) = entries.iter().position(|e| e.slug == slug) else {
        return Err("Project not found.".into());
    };

    if let Some(n) = name {
        let n = n.trim().to_string();
        if !n.is_empty() {
            entries[idx].name = n; // slug is immutable — rename never re-slugs
        }
    }
    if let Some(t) = tag {
        let t = normalize_project_tag(&t)?;
        if !t.is_empty() {
            if let Some(other) = entries
                .iter()
                .find(|e| e.slug != slug && e.tag.eq_ignore_ascii_case(&t))
            {
                return Err(format!(
                    "#{} is already linked to \"{}\".",
                    t, other.name
                ));
            }
        }
        entries[idx].tag = t;
    }
    if let Some(p) = path {
        let p = p.trim().to_string();
        if !p.is_empty() && !PathBuf::from(&p).is_dir() {
            return Err(format!("That folder doesn't exist: {p}"));
        }
        entries[idx].path = p;
    }
    if let Some(n) = notes {
        let body = if n.trim().is_empty() {
            String::new()
        } else {
            n.trim_end().to_string() + "\n"
        };
        let notes_path = project_notes_path(&dir, &slug);
        if body.is_empty() {
            let _ = fs::remove_file(&notes_path);
        } else {
            let _ = fs::write(&notes_path, body);
        }
    }

    write_projects_index(&dir, &entries);
    Ok(EditProjectResult {
        entries: read_projects_index(&dir),
    })
}

/// Deletes a project's metadata (index entry + notes file). The linked folder
/// on disk is deliberately left untouched.
#[tauri::command]
fn delete_project(slug: String) -> Vec<ProjectListEntry> {
    let dir = storage_dir();
    let mut entries = read_projects_index(&dir);
    entries.retain(|e| e.slug != slug);
    write_projects_index(&dir, &entries);
    let _ = fs::remove_file(project_notes_path(&dir, &slug));
    read_projects_index(&dir)
}

// --- storage-location settings ---------------------------------------------

#[derive(Serialize)]
struct StorageInfo {
    // The directory currently in use (absolute).
    path: String,
    // The folder the user picked in Settings, or "" when on the default.
    custom: String,
    // The built-in default location, shown as a hint / reset target.
    default_path: String,
    // True when SUPERTODO_DIR is forcing the location; Settings can't change it.
    env_override: bool,
}

fn build_storage_info() -> StorageInfo {
    let env_override = std::env::var("SUPERTODO_DIR")
        .map(|v| !v.is_empty())
        .unwrap_or(false);
    let custom = read_config().storage_dir.unwrap_or_default().trim().to_string();
    StorageInfo {
        path: storage_dir().to_string_lossy().to_string(),
        custom,
        default_path: default_storage_dir().to_string_lossy().to_string(),
        env_override,
    }
}

#[tauri::command]
fn get_storage_info() -> StorageInfo {
    build_storage_info()
}

/// Points storage at `path`, creating it if needed. Existing files are left where
/// they are — only the location for reading and creating files changes. Returns
/// an error string (rejecting the JS promise) if the folder can't be used.
#[tauri::command]
fn set_storage_dir(path: String) -> Result<StorageInfo, String> {
    if std::env::var("SUPERTODO_DIR")
        .map(|v| !v.is_empty())
        .unwrap_or(false)
    {
        return Err("SUPERTODO_DIR is set; the storage folder can't be changed here.".into());
    }
    let trimmed = path.trim().to_string();
    if trimmed.is_empty() {
        return Err("Please choose a folder.".into());
    }
    let dir = PathBuf::from(&trimmed);
    fs::create_dir_all(&dir).map_err(|e| format!("Couldn't create that folder: {e}"))?;
    // Probe writability so a bad choice fails here, not silently later.
    let probe = dir.join(".supertodo_write_test");
    fs::write(&probe, b"ok").map_err(|e| format!("That folder isn't writable: {e}"))?;
    let _ = fs::remove_file(&probe);

    let mut cfg = read_config();
    cfg.storage_dir = Some(trimmed);
    write_config(&cfg);
    Ok(build_storage_info())
}

/// Clears the custom folder, reverting to the default location.
#[tauri::command]
fn reset_storage_dir() -> StorageInfo {
    let mut cfg = read_config();
    cfg.storage_dir = None;
    write_config(&cfg);
    build_storage_info()
}

#[cfg(test)]
mod storage_tests {
    use super::*;
    use std::sync::Mutex;

    // These tests mutate process-global env vars (HOME / SUPERTODO_DIR); serialize
    // them so a parallel test runner can't interleave the mutations.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    // Drives the storage-location commands end to end against an isolated HOME so
    // real data/config is never touched. Verifies: default when unset, that
    // set_storage_dir persists a config file and redirects storage_dir(), and
    // that reset reverts to the default.
    #[test]
    fn set_and_reset_storage_dir() {
        let _env = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let tmp = std::env::temp_dir().join(format!("supertodo_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("HOME", &tmp);
        std::env::remove_var("SUPERTODO_DIR");

        // Default location when nothing is configured.
        let info = reset_storage_dir();
        let default = tmp.join("Documents").join("SuperTodo");
        assert_eq!(info.path, default.to_string_lossy());
        assert_eq!(info.custom, "");
        assert!(!info.env_override);
        assert_eq!(storage_dir(), default);

        // Point storage at a custom folder.
        let custom = tmp.join("my custom todos");
        let info = set_storage_dir(custom.to_string_lossy().to_string()).unwrap();
        assert_eq!(info.custom, custom.to_string_lossy());
        assert_eq!(storage_dir(), custom);
        // The choice is persisted in the app-support config, not the data dir.
        assert!(config_path().exists());
        assert!(!custom.join("config.json").exists());

        // Empty input is rejected.
        assert!(set_storage_dir("   ".into()).is_err());

        // Reset reverts to the default.
        let info = reset_storage_dir();
        assert_eq!(info.custom, "");
        assert_eq!(storage_dir(), default);

        let _ = fs::remove_dir_all(&tmp);
    }

    // Exercises the todo data-model changes end to end against an isolated
    // storage dir: legacy .txt migration (tags lifted, title cleaned, created
    // set to the file date), carry-over preserving the original created date,
    // and edit_task updating description/tags without touching created.
    #[test]
    fn todo_migration_carryover_and_edit() {
        let _env = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let tmp = std::env::temp_dir().join(format!("supertodo_todo_{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("SUPERTODO_DIR", &tmp);

        // --- migration from a legacy top-level .txt into the todos folder ---
        let old = NaiveDate::from_ymd_opt(2020, 1, 1).unwrap();
        let legacy_txt = tmp.join("todo_20200101.txt"); // old storage-root layout
        fs::write(&legacy_txt, "[ ] Buy milk #home\n[x] Old done\n").unwrap();
        let items = load_day_items(&tmp, old);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].text, "Buy milk"); // inline tag stripped from title
        assert_eq!(items[0].tags, vec!["home".to_string()]);
        assert_eq!(items[0].created, "2020-01-01"); // created = file date
        assert_eq!(items[0].description, "");
        assert!(!items[0].checked);
        assert!(items[1].checked);
        // The canonical JSON now lives under todos/; the .txt stays as a source.
        assert!(json_file_for(&tmp, old).exists());
        assert!(json_file_for(&tmp, old).starts_with(tmp.join("todos")));
        assert!(legacy_txt.exists());

        // --- carry-over preserves the original created date ---
        let later = NaiveDate::from_ymd_opt(2020, 1, 5).unwrap();
        ensure_today(&tmp, later);
        let carried = load_day_items(&tmp, later);
        assert_eq!(carried.len(), 1); // only the unfinished task carried
        assert_eq!(carried[0].text, "Buy milk");
        assert!(carried[0].carried);
        assert_eq!(carried[0].created, "2020-01-01"); // NOT reset to the new day
        assert_eq!(carried[0].tags, vec!["home".to_string()]);
        // The source task is now rolled, so re-running never carries it twice.
        assert!(load_day_items(&tmp, old)[0].rolled);
        ensure_today(&tmp, later);
        assert_eq!(load_day_items(&tmp, later).len(), 1);

        // --- add_task sets created=today; edit_task edits desc/tags ---
        let today_iso = today().format("%Y-%m-%d").to_string();
        add_task(today_iso.clone(), "Write report #work".into());
        let day = load_day_items(&tmp, today());
        let idx = day.iter().position(|t| t.text == "Write report").unwrap();
        assert_eq!(day[idx].tags, vec!["work".to_string()]); // inline tag lifted
        assert_eq!(day[idx].created, today_iso);

        edit_task(
            today_iso.clone(),
            idx,
            None,
            Some("Details here".into()),
            Some(vec!["work".into(), "urgent".into()]),
        );
        let day = load_day_items(&tmp, today());
        assert_eq!(day[idx].description, "Details here");
        assert_eq!(day[idx].tags, vec!["work".to_string(), "urgent".to_string()]);
        assert_eq!(day[idx].created, today_iso); // edits never touch created

        let _ = fs::remove_dir_all(&tmp);
        std::env::remove_var("SUPERTODO_DIR");
    }

    // A pre-todos-folder JSON day-file at the storage root is relocated into the
    // todos folder (content preserved) and the top-level copy removed.
    #[test]
    fn todo_relocates_top_level_json() {
        let _env = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let tmp = std::env::temp_dir().join(format!("supertodo_reloc_{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("SUPERTODO_DIR", &tmp);

        let date = NaiveDate::from_ymd_opt(2021, 3, 4).unwrap();
        let top = tmp.join("todo_20210304.json");
        let item = TodoItem {
            id: "test-id".into(),
            checked: false,
            carried: false,
            rolled: false,
            text: "Keep me".into(),
            description: "body".into(),
            created: "2021-03-04".into(),
            tags: vec!["x".into()],
        };
        fs::write(&top, serde_json::to_string(&[item]).unwrap()).unwrap();

        let items = load_day_items(&tmp, date);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].text, "Keep me");
        assert_eq!(items[0].description, "body");
        assert_eq!(items[0].created, "2021-03-04");
        // Now under todos/, and the top-level copy is gone.
        assert!(json_file_for(&tmp, date).starts_with(tmp.join("todos")));
        assert!(json_file_for(&tmp, date).exists());
        assert!(!top.exists());

        let _ = fs::remove_dir_all(&tmp);
        std::env::remove_var("SUPERTODO_DIR");
    }

    // Project CRUD end to end: add creates an index entry with a unique slug;
    // edit sets tag/path/notes (notes round-tripping through <slug>.md); a tag
    // already owned by another project is rejected (case-insensitive); a rename
    // keeps the slug stable; delete removes metadata but never the folder.
    #[test]
    fn project_crud_and_tag_uniqueness() {
        let _env = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let tmp = std::env::temp_dir().join(format!("supertodo_proj_{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("SUPERTODO_DIR", &tmp);

        let folder = tmp.join("myrepo");
        fs::create_dir_all(&folder).unwrap();

        let res = add_project("  My Repo  ".into());
        assert_eq!(res.entries.len(), 1);
        assert_eq!(res.new_slug, "my-repo");
        assert_eq!(res.entries[0].tag, "");
        // A duplicate name gets a distinct slug.
        let res2 = add_project("My Repo".into());
        assert_eq!(res2.new_slug, "my-repo-1");

        // Edit: set tag, path, notes.
        edit_project(
            res.new_slug.clone(),
            None,
            Some("#work".into()),
            Some(folder.to_string_lossy().to_string()),
            Some("# Notes\nhello".into()),
        )
        .unwrap();
        let p = get_project(res.new_slug.clone()).unwrap();
        assert_eq!(p.tag, "work"); // leading '#' stripped
        assert_eq!(p.path, folder.to_string_lossy());
        assert_eq!(p.notes, "# Notes\nhello"); // read back trimmed

        // Tag conflict with the other project (case-insensitive) is rejected.
        let err = edit_project(res2.new_slug.clone(), None, Some("WORK".into()), None, None)
            .unwrap_err();
        assert!(err.contains("already linked"));
        // Invalid tag charset and nonexistent folder are rejected.
        assert!(
            edit_project(res.new_slug.clone(), None, Some("bad tag!".into()), None, None).is_err()
        );
        assert!(
            edit_project(res.new_slug.clone(), None, None, Some("/no/such/dir".into()), None)
                .is_err()
        );

        // A rename keeps the slug stable.
        edit_project(res.new_slug.clone(), Some("Renamed".into()), None, None, None).unwrap();
        let p = get_project(res.new_slug.clone()).unwrap();
        assert_eq!(p.name, "Renamed");
        assert_eq!(p.slug, "my-repo");

        // The notes file lives under projects/; delete removes metadata only.
        assert!(project_notes_path(&tmp, "my-repo").exists());
        let left = delete_project(res.new_slug.clone());
        assert_eq!(left.len(), 1);
        assert!(!project_notes_path(&tmp, "my-repo").exists());
        assert!(folder.exists()); // the linked folder is never touched

        let _ = fs::remove_dir_all(&tmp);
        std::env::remove_var("SUPERTODO_DIR");
    }

    // add_task assigns a stable id; carry-over keeps it; a legacy task with no
    // id gets one backfilled the first time its day-file is written.
    #[test]
    fn todo_ids_are_stable() {
        let _env = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let tmp = std::env::temp_dir().join(format!("supertodo_ids_{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("SUPERTODO_DIR", &tmp);

        let today_iso = today().format("%Y-%m-%d").to_string();
        add_task(today_iso.clone(), "Task A".into());
        add_task(today_iso.clone(), "Task B".into());
        let items = load_day_items(&tmp, today());
        assert_eq!(items.len(), 2);
        let id_a = items[0].id.clone();
        let id_b = items[1].id.clone();
        assert!(!id_a.is_empty() && !id_b.is_empty() && id_a != id_b);

        // A toggle rewrites the day-file; ids survive.
        toggle_task(today_iso.clone(), 1);
        let items = load_day_items(&tmp, today());
        assert_eq!(items[0].id, id_a);
        assert_eq!(items[1].id, id_b);

        // Carry-over preserves the id of the unfinished task.
        let later = today() + chrono::Duration::days(1);
        ensure_today(&tmp, later);
        let carried = load_day_items(&tmp, later);
        assert_eq!(carried.len(), 1); // only the unchecked task carries
        assert_eq!(carried[0].id, id_a);
        assert!(carried[0].carried);

        // Legacy .txt migration: ids are backfilled on the carry-over write of
        // the source (past) file — the one past-day write that is allowed.
        let old = NaiveDate::from_ymd_opt(2020, 2, 2).unwrap();
        fs::write(tmp.join("todo_20200202.txt"), "[ ] Ancient\n").unwrap();
        let before = load_day_items(&tmp, old);
        assert_eq!(before[0].id, ""); // not backfilled by a read
        let after_old = NaiveDate::from_ymd_opt(2020, 2, 3).unwrap();
        ensure_today(&tmp, after_old);
        assert!(!load_day_items(&tmp, old)[0].id.is_empty());
        assert!(!load_day_items(&tmp, after_old)[0].id.is_empty());

        let _ = fs::remove_dir_all(&tmp);
        std::env::remove_var("SUPERTODO_DIR");
    }

    // Converts legacy .md ideas to .json, cleans up the old ideas_index.json,
    // and removes the .md files. Verifies idempotency on a second run and
    // handles orphan .md (no matching JSON).
    #[test]
    fn idea_md_to_json_migration() {
        let _env = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let tmp = std::env::temp_dir().join(format!("supertodo_idea_mig_{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("SUPERTODO_DIR", &tmp);

        let ideas = ideas_dir(&tmp);

        // Write a legacy ideas_index.json (simulates pre-migration state)
        fs::write(
            ideas.join("ideas_index.json"),
            r#"[
                {"id":"","slug":"test-idea","emoji":"🎯","title":"Test Idea","created":"2026-01-15","tags":["demo"]}
            ]"#,
        )
        .unwrap();

        // Write a legacy .md file matching the index entry
        fs::write(ideas.join("test-idea.md"), "# Test Idea\n\nBody text here\n").unwrap();

        // Write an orphan .md (no matching entry in the old index)
        fs::write(ideas.join("orphan.md"), "# Orphan\n\nNo index entry\n").unwrap();

        // Write a .md that already has a .json sibling (should be skipped)
        fs::write(ideas.join("already-json.md"), "# Already JSON\n").unwrap();
        fs::write(
            ideas.join("already-json.json"),
            r#"{"id":"x","slug":"already-json","emoji":"💡","title":"Already JSON","description":"","created":"2026-03-01","tags":[]}"#,
        )
        .unwrap();

        // Run migration
        migrate_ideas(&tmp);

        // --- old index file should be deleted ---
        assert!(!ideas.join("ideas_index.json").exists(), "old index should be deleted");

        // --- test-idea: json exists with correct fields from old index ---
        let json_path = ideas.join("test-idea.json");
        assert!(json_path.exists(), "test-idea.json should exist");
        let idea: IdeaData =
            serde_json::from_str(&fs::read_to_string(&json_path).unwrap()).unwrap();
        assert_eq!(idea.slug, "test-idea");
        assert_eq!(idea.title, "Test Idea");
        assert_eq!(idea.description, "Body text here");
        assert_eq!(idea.emoji, "🎯"); // from old index
        assert_eq!(idea.created, "2026-01-15"); // from old index
        assert_eq!(idea.tags, vec!["demo"]); // from old index
        assert!(!idea.id.is_empty(), "id should be filled");
        assert!(!ideas.join("test-idea.md").exists(), ".md should be deleted");

        // --- orphan: json exists with defaults ---
        let orphan_json = ideas.join("orphan.json");
        assert!(orphan_json.exists(), "orphan.json should exist");
        let orphan: IdeaData =
            serde_json::from_str(&fs::read_to_string(&orphan_json).unwrap()).unwrap();
        assert_eq!(orphan.slug, "orphan");
        assert_eq!(orphan.title, "Orphan");
        assert_eq!(orphan.description, "No index entry");
        assert_eq!(orphan.emoji, "💡"); // default
        assert!(orphan.tags.is_empty());
        assert!(!orphan.id.is_empty());
        assert!(!ideas.join("orphan.md").exists(), "orphan .md should be deleted");

        // --- already-json: untouched ---
        assert!(ideas.join("already-json.json").exists(), "existing .json should survive");
        assert!(ideas.join("already-json.md").exists(), ".md with .json sibling should stay");

        // --- read_all_ideas returns all entries correctly ---
        let all = read_all_ideas(&tmp);
        assert_eq!(all.len(), 3);
        for entry in &all {
            assert!(!entry.id.is_empty(), "entry {} should have id", entry.slug);
        }

        // --- idempotent: second run changes nothing ---
        migrate_ideas(&tmp);
        assert!(!ideas.join("ideas_index.json").exists(), "index still gone after second run");
        let all2 = read_all_ideas(&tmp);
        assert_eq!(all2.len(), all.len());

        let _ = fs::remove_dir_all(&tmp);
        std::env::remove_var("SUPERTODO_DIR");
    }

    // Backfills empty todo ids in existing day-files, preserving all other
    // fields (especially rolled). Idempotent on a second run.
    #[test]
    fn todo_id_backfill_migration() {
        let _env = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let tmp = std::env::temp_dir().join(format!("supertodo_todo_backfill_{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("SUPERTODO_DIR", &tmp);

        // Write a day-file with some empty ids and some filled
        let date = NaiveDate::from_ymd_opt(2023, 5, 10).unwrap();
        let items = vec![
            TodoItem {
                id: String::new(), // empty — needs backfill
                checked: false,
                carried: true,
                rolled: false,
                text: "Task with no id".into(),
                description: "desc".into(),
                created: "2023-05-09".into(),
                tags: vec!["x".into()],
            },
            TodoItem {
                id: "already-has-id".into(), // already filled
                checked: true,
                carried: false,
                rolled: true,
                text: "Done task".into(),
                description: String::new(),
                created: "2023-05-08".into(),
                tags: vec![],
            },
        ];
        write_day_items(&tmp, date, &items);

        // Verify the first item has an id after write (write_day_items backfills)
        // but let's force an empty one by writing directly
        let mut raw_items = items.clone();
        raw_items[0].id = String::new();
        let path = json_file_for(&tmp, date);
        fs::write(&path, serde_json::to_string_pretty(&raw_items).unwrap()).unwrap();

        // Run backfill
        backfill_todo_ids(&tmp);

        let loaded = read_items_json(&path);
        assert_eq!(loaded.len(), 2);
        // First item now has an id
        assert!(!loaded[0].id.is_empty(), "empty id should be backfilled");
        // Second item keeps its id
        assert_eq!(loaded[1].id, "already-has-id");
        // All other fields preserved
        assert_eq!(loaded[0].text, "Task with no id");
        assert_eq!(loaded[0].description, "desc");
        assert_eq!(loaded[0].created, "2023-05-09");
        assert_eq!(loaded[0].tags, vec!["x"]);
        assert!(loaded[0].carried);
        assert!(!loaded[0].rolled);
        assert!(loaded[1].checked);
        assert!(loaded[1].rolled);

        // Idempotent: second run doesn't change ids
        let ids_before: Vec<String> = loaded.iter().map(|i| i.id.clone()).collect();
        backfill_todo_ids(&tmp);
        let loaded2 = read_items_json(&path);
        let ids_after: Vec<String> = loaded2.iter().map(|i| i.id.clone()).collect();
        assert_eq!(ids_before, ids_after);

        let _ = fs::remove_dir_all(&tmp);
        std::env::remove_var("SUPERTODO_DIR");
    }

    // Backfills empty project ids in the project index.
    #[test]
    fn project_id_backfill_migration() {
        let _env = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let tmp = std::env::temp_dir().join(format!("supertodo_proj_backfill_{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("SUPERTODO_DIR", &tmp);

        // Write an index with no ids
        let entries = vec![
            ProjectListEntry {
                id: String::new(),
                slug: "project-a".into(),
                name: "Project A".into(),
                tag: "proj-a".into(),
                path: "/tmp/a".into(),
                created: "2026-01-01".into(),
            },
            ProjectListEntry {
                id: String::new(),
                slug: "project-b".into(),
                name: "Project B".into(),
                tag: "".into(),
                path: "".into(),
                created: "2026-02-01".into(),
            },
        ];
        write_projects_index(&tmp, &entries);

        // Run backfill
        backfill_project_ids(&tmp);

        let updated = read_projects_index(&tmp);
        assert_eq!(updated.len(), 2);
        assert!(!updated[0].id.is_empty(), "project-a should have id");
        assert!(!updated[1].id.is_empty(), "project-b should have id");
        assert_ne!(updated[0].id, updated[1].id, "ids should be unique");
        // Other fields untouched
        assert_eq!(updated[0].slug, "project-a");
        assert_eq!(updated[0].name, "Project A");

        // Idempotent
        let ids_before: Vec<String> = updated.iter().map(|e| e.id.clone()).collect();
        backfill_project_ids(&tmp);
        let ids_after: Vec<String> =
            read_projects_index(&tmp).iter().map(|e| e.id.clone()).collect();
        assert_eq!(ids_before, ids_after);

        let _ = fs::remove_dir_all(&tmp);
        std::env::remove_var("SUPERTODO_DIR");
    }
}

// --- storage migration ------------------------------------------------------
// One-time startup migrations: converts legacy formats to the current layout
// and backfills ids that predate the id fields. All steps are idempotent.

/// Converts legacy `ideas/<slug>.md` files to `<slug>.json` and deletes the .md.
/// Also cleans up the old `ideas_index.json` if it still exists.
fn migrate_ideas(dir: &PathBuf) {
    let ideas = ideas_dir(dir);

    // Read the old index into memory before deleting it, so .md files can
    // still look up emoji/created/tags from it.
    let old_index_path = ideas.join("ideas_index.json");
    let old_index: Vec<IdeaListEntry> = fs::read_to_string(&old_index_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    // Delete the old index file — no longer used.
    if old_index_path.exists() {
        eprintln!("[ideas] removing legacy ideas_index.json");
        let _ = fs::remove_file(&old_index_path);
    }

    if let Ok(rd) = fs::read_dir(&ideas) {
        for entry in rd.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("md") {
                continue;
            }
            let Some(stem) = path.file_stem().and_then(|s| s.to_str()).map(|s| s.to_string()) else {
                continue;
            };
            if stem.is_empty() {
                continue;
            }

            let json_path = ideas.join(format!("{}.json", stem));
            if json_path.exists() {
                continue;
            }

            let content = match fs::read_to_string(&path) {
                Ok(c) => c,
                Err(_) => continue,
            };
            let (title, description) = parse_idea_md_content(&content);

            let old_entry = old_index.iter().find(|e| e.slug == stem);

            let (emoji, created, tags) = if let Some(e) = old_entry {
                (e.emoji.clone(), e.created.clone(), e.tags.clone())
            } else {
                let birth = path.metadata()
                    .ok()
                    .and_then(|m| m.created().ok())
                    .map(|t| -> String {
                        let dt: chrono::DateTime<Utc> = t.into();
                        dt.format("%Y-%m-%d").to_string()
                    })
                    .unwrap_or_default();
                (String::from("💡"), birth, Vec::new())
            };

            let idea = IdeaData {
                id: new_id(),
                slug: stem,
                emoji,
                title,
                description,
                created,
                tags,
            };
            write_idea_json(&ideas, &idea);
            let _ = fs::remove_file(&path);
        }
    }
}

/// Backfills empty todo ids in every day-file. This is the one deliberate
/// exception to the "never rewrite past-day files" invariant — a full-fidelity
/// rewrite that preserves every field (checked, carried, rolled, text,
/// description, created, tags) while adding ids where they are missing.
fn backfill_todo_ids(dir: &PathBuf) {
    for date in all_todo_dates(dir) {
        let path = json_file_for(dir, date);
        if !path.exists() {
            continue;
        }
        let items = read_items_json(&path);
        if items.iter().any(|i| i.id.is_empty()) {
            write_day_items(dir, date, &items);
        }
    }
}

/// Backfills empty project ids in the project index.
fn backfill_project_ids(dir: &PathBuf) {
    let mut entries = read_projects_index(dir);
    let mut changed = false;
    for entry in entries.iter_mut() {
        if entry.id.is_empty() {
            entry.id = new_id();
            changed = true;
        }
    }
    if changed {
        write_projects_index(dir, &entries);
    }
}

/// Runs all one-time startup migrations.
fn migrate_storage(dir: &PathBuf) {
    migrate_ideas(dir);
    backfill_todo_ids(dir);
    backfill_project_ids(dir);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    migrate_storage(&storage_dir());
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_today,
            get_day,
            add_task,
            edit_task,
            reorder_task,
            toggle_task,
            delete_task,
            get_ideas,
            add_idea,
            get_idea,
            edit_idea,
            delete_idea,
            get_tags,
            get_tagged,
            get_tagged_multi,
            get_tag_colors,
            get_projects,
            add_project,
            get_project,
            edit_project,
            delete_project,
            get_storage_info,
            set_storage_dir,
            reset_storage_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running SuperTodo");
}
