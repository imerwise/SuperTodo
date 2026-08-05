use chrono::{Local, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
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
    // Hashtags found inline in `text` (e.g. "#work"). Derived on read, never
    // stored separately — `text` keeps the raw "#tag" so format_item round-trips
    // unchanged and carry-over is untouched.
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
    slug: String,
    emoji: String,
    title: String,
    created: String,
    #[serde(default)]
    tags: Vec<String>,
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
        checked,
        carried,
        rolled,
        text: rest.to_string(),
        tags,
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

// --- ideas helpers ---------------------------------------------------------

fn ideas_dir(dir: &PathBuf) -> PathBuf {
    let ideas = dir.join("ideas");
    let _ = fs::create_dir_all(&ideas);
    ideas
}

fn ideas_index_path(dir: &PathBuf) -> PathBuf {
    ideas_dir(dir).join("ideas_index.json")
}

fn idea_file_path(ideas: &PathBuf, slug: &str) -> PathBuf {
    ideas.join(format!("{}.md", slug))
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

    if let Ok(rd) = fs::read_dir(dir) {
        for entry in rd.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if let Some(digits) = name.strip_prefix("todo_").and_then(|s| s.strip_suffix(".txt")) {
                if let Ok(d) = NaiveDate::parse_from_str(digits, "%Y%m%d") {
                    let iso = d.format("%Y-%m-%d").to_string();
                    for item in read_items(&entry.path()) {
                        for t in &item.tags {
                            note(&mut first, t, &iso);
                        }
                    }
                }
            }
        }
    }

    for entry in read_ideas_index(dir) {
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

fn read_ideas_index(dir: &PathBuf) -> Vec<IdeaListEntry> {
    let path = ideas_index_path(dir);
    let mut entries: Vec<IdeaListEntry> = fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    eprintln!("[ideas] read_ideas_index: {} entries from {}", entries.len(), path.display());
    // Sort descending by created date (newest first), then by slug for stable
    // ordering within the same day.
    entries.sort_by(|a, b| b.created.cmp(&a.created).then(a.slug.cmp(&b.slug)));
    entries
}

fn write_ideas_index(dir: &PathBuf, entries: &[IdeaListEntry]) {
    let path = ideas_index_path(dir);
    eprintln!("[ideas] write_ideas_index: {} entries to {}", entries.len(), path.display());
    if let Ok(json) = serde_json::to_string_pretty(entries) {
        let _ = fs::write(&path, json);
    }
}

fn read_idea_md(ideas: &PathBuf, slug: &str) -> Option<IdeaData> {
    let path = idea_file_path(ideas, slug);
    eprintln!("[ideas] read_idea_md: slug={} path={}", slug, path.display());
    let content = fs::read_to_string(&path).ok()?;

    // First line starting with # is the title, rest is description body.
    let trimmed = content.trim();
    let (title, description) = if let Some(idx) = trimmed.find('\n') {
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
    };

    eprintln!("[ideas] read_idea_md: parsed title={:?} description_len={}",
        title, description.len());

    Some(IdeaData {
        slug: slug.to_string(),
        emoji: String::new(), // not stored in file anymore
        title,
        description,
        created: String::new(), // not stored in file anymore
        tags: Vec::new(),       // merged in from the index by get_idea
    })
}

fn write_idea_md(ideas: &PathBuf, idea: &IdeaData) {
    let path = idea_file_path(ideas, &idea.slug);
    let content = if idea.description.is_empty() {
        format!("# {}", idea.title)
    } else {
        format!("# {}\n\n{}", idea.title, idea.description)
    };
    let final_content = content.trim().to_string() + "\n";
    eprintln!("[ideas] write_idea_md: slug={} path={} title={:?} desc_len={} content_len={}",
        idea.slug, path.display(), idea.title, idea.description.len(), final_content.len());
    let _ = fs::write(&path, final_content);
}

/// Generate a unique slug by appending -N if the slug already exists in the index.
fn unique_slug(_dir: &PathBuf, base: &str, entries: &[IdeaListEntry]) -> String {
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
                        tags: item.tags.clone(),
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
        let tags = extract_tags(&text);
        items.push(TodoItem {
            checked: false,
            carried: false,
            rolled: false,
            text,
            tags,
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
                item.tags = extract_tags(&text);
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

// --- idea commands ---------------------------------------------------------

#[tauri::command]
fn get_ideas() -> Vec<IdeaListEntry> {
    eprintln!("[ideas] COMMAND get_ideas");
    let dir = storage_dir();
    let entries = read_ideas_index(&dir);
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
    let mut entries = read_ideas_index(&dir);
    let base = slugify(&title);
    let slug = unique_slug(&dir, &base, &entries);
    let created = Utc::now().format("%Y-%m-%d").to_string();
    eprintln!("[ideas] COMMAND add_idea: slug={} created={}", slug, created);

    let idea = IdeaData {
        slug: slug.clone(),
        emoji: String::from("💡"),
        title: title.clone(),
        description: String::new(),
        created: created.clone(),
        tags: Vec::new(),
    };
    write_idea_md(&ideas, &idea);

    let slug_copy = slug.clone();
    entries.push(IdeaListEntry {
        slug,
        emoji: String::from("💡"),
        title,
        created,
        tags: Vec::new(),
    });
    write_ideas_index(&dir, &entries);
    let result = read_ideas_index(&dir);
    eprintln!("[ideas] COMMAND add_idea: done, {} entries total", result.len());
    AddIdeaResult { entries: result, new_slug: slug_copy }
}

#[tauri::command]
fn get_idea(slug: String) -> Option<IdeaData> {
    eprintln!("[ideas] COMMAND get_idea: slug={}", slug);
    let dir = storage_dir();
    let ideas = ideas_dir(&dir);
    let mut result = read_idea_md(&ideas, &slug)?;
    // Merge in emoji and created from the index
    let entries = read_ideas_index(&dir);
    if let Some(entry) = entries.iter().find(|e| e.slug == slug) {
        result.emoji = entry.emoji.clone();
        result.created = entry.created.clone();
        result.tags = entry.tags.clone();
    }
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
    let mut entries = read_ideas_index(&dir);

    let entry_idx = entries.iter().position(|e| e.slug == slug);
    if entry_idx.is_none() {
        eprintln!("[ideas] COMMAND edit_idea: slug not found in index, returning {} entries", entries.len());
        return EditIdeaResult { entries, new_slug: None };
    }
    let idx = entry_idx.unwrap();

    let mut idea = match read_idea_md(&ideas, &slug) {
        Some(i) => i,
        None => {
            eprintln!("[ideas] COMMAND edit_idea: .md file not found, returning {} entries", entries.len());
            return EditIdeaResult { entries, new_slug: None };
        }
    };

    let mut slug_changed = false;
    let mut new_slug = None;

    if let Some(e) = emoji {
        if !e.is_empty() {
            idea.emoji = e.clone();
            entries[idx].emoji = e;
        }
    }
    if let Some(t) = title {
        if !t.is_empty() && t != idea.title {
            // Compute new slug, delete old file, update entry
            let base = slugify(&t);
            let slug_no_counter = unique_slug(&dir, &base, &entries);
            let old_path = idea_file_path(&ideas, &slug);
            let _ = fs::remove_file(&old_path);
            idea.title = t.clone();
            idea.slug = slug_no_counter.clone();
            entries[idx].slug = slug_no_counter.clone();
            entries[idx].title = t;
            new_slug = Some(slug_no_counter);
            slug_changed = true;
        }
    }
    if let Some(d) = description {
        idea.description = d;
    }
    if let Some(t) = tags {
        let clean = normalize_tags(&t);
        entries[idx].tags = clean.clone();
        idea.tags = clean;
    }

    write_idea_md(&ideas, &idea);
    if !slug_changed {
        write_ideas_index(&dir, &entries);
    } else {
        // Re-read and re-write to ensure proper sort
        let _ = write_ideas_index(&dir, &entries);
        entries = read_ideas_index(&dir);
    }
    eprintln!("[ideas] COMMAND edit_idea: done, {} entries, new_slug={:?}", entries.len(), new_slug);
    EditIdeaResult { entries, new_slug }
}

#[tauri::command]
fn delete_idea(slug: String) -> Vec<IdeaListEntry> {
    eprintln!("[ideas] COMMAND delete_idea: slug={}", slug);
    let dir = storage_dir();
    let ideas = ideas_dir(&dir);
    let mut entries = read_ideas_index(&dir);

    let path = idea_file_path(&ideas, &slug);
    eprintln!("[ideas] COMMAND delete_idea: removing file {}", path.display());
    let _ = fs::remove_file(&path);

    entries.retain(|e| e.slug != slug);
    write_ideas_index(&dir, &entries);
    eprintln!("[ideas] COMMAND delete_idea: done, {} entries remaining", entries.len());
    entries
}

// --- tag commands ----------------------------------------------------------

/// One todo that matched a tag query, carrying its source day so the UI can
/// show and navigate to it.
#[derive(Serialize)]
struct TaggedTodo {
    date: String, // YYYY-MM-DD
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

/// Tags in first-appearance order. The frontend assigns chip colors by this
/// order (looping over the palette) and sorts its own copy for menus.
#[tauri::command]
fn get_tags() -> Vec<String> {
    let dir = storage_dir();
    tags_in_creation_order(&dir)
}

/// Returns every todo (across all day files) and every idea whose tags include
/// `tag` (case-insensitive). Read-only: it never rewrites any file.
#[tauri::command]
fn get_tagged(tag: String) -> TaggedResult {
    let dir = storage_dir();
    let needle = tag.trim().trim_start_matches('#').trim().to_string();

    let mut todos: Vec<TaggedTodo> = Vec::new();
    if !needle.is_empty() {
        // Collect matching todos from every todo_YYYYMMDD.txt, newest day first.
        let mut dated: Vec<(NaiveDate, PathBuf)> = Vec::new();
        if let Ok(rd) = fs::read_dir(&dir) {
            for entry in rd.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if let Some(digits) = name
                    .strip_prefix("todo_")
                    .and_then(|s| s.strip_suffix(".txt"))
                {
                    if let Ok(date) = NaiveDate::parse_from_str(digits, "%Y%m%d") {
                        dated.push((date, entry.path()));
                    }
                }
            }
        }
        dated.sort_by_key(|(date, _)| std::cmp::Reverse(*date));
        for (date, path) in dated {
            for item in read_items(&path) {
                if item.tags.iter().any(|t| t.eq_ignore_ascii_case(&needle)) {
                    todos.push(TaggedTodo {
                        date: date.format("%Y-%m-%d").to_string(),
                        checked: item.checked,
                        rolled: item.rolled,
                        text: item.text,
                        tags: item.tags,
                    });
                }
            }
        }
    }

    let ideas: Vec<IdeaListEntry> = if needle.is_empty() {
        Vec::new()
    } else {
        read_ideas_index(&dir)
            .into_iter()
            .filter(|e| e.tags.iter().any(|t| t.eq_ignore_ascii_case(&needle)))
            .collect()
    };

    TaggedResult { tag: needle, todos, ideas }
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
            delete_task,
            get_ideas,
            add_idea,
            get_idea,
            edit_idea,
            delete_idea,
            get_tags,
            get_tagged
        ])
        .run(tauri::generate_context!())
        .expect("error while running SuperTodo");
}
