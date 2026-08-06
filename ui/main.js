const { invoke } = window.__TAURI__.core;

const weekdayEl = document.getElementById("weekday");
const dateEl = document.getElementById("date");
const modeIndicatorEl = document.getElementById("modeIndicator");
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const inputEl = document.getElementById("input");
const composerEl = document.getElementById("composer");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const todayBtn = document.getElementById("todayBtn");
const statusEl = document.getElementById("statusbar");

// Respect the OS "reduce motion" setting — when set, every juice effect is
// skipped and actions apply instantly.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const CHECK_SVG =
  '<svg viewBox="0 0 24 24"><polyline points="4 12 10 18 20 6" /></svg>';
const PENCIL_SVG =
  '<svg viewBox="0 0 24 24"><path d="M4 20h4L18.5 9.5l-4-4L4 16v4z" /><path d="M14.5 5.5l4 4" /></svg>';
const TRASH_SVG =
  '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M6.5 7l1 13h9l1-13" /></svg>';
const BACK_SVG =
  '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>';

// --- emoji data (categorized, for the full picker) ---
const EMOJI_CATEGORIES = [
  {
    name: "Smileys",
    emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🫢","🫣","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","🫥","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐","😕","😟","🙁","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖","😺","😸","😹","😻","😼","😽","🙀","😿","😾"],
  },
  {
    name: "Gestures",
    emojis: ["👋","🤚","🖐","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦵","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👅","👄"],
  },
  {
    name: "Objects",
    emojis: ["👓","🕶","👔","👕","👖","🧣","🧤","🧥","🧦","👗","👘","🥻","🩱","🩲","🩳","👙","👚","🪭","👛","👜","👝","🎒","🩴","👞","👟","🥾","🥿","👠","👡","🩰","👢","👑","👒","🎩","🎓","🧢","🪖","⛑","💄","💍","💼","🩸","🔬","🔭","📡","🪀","🪁","🔮","🕹","🧸","🪅","🪩","🪆","🖼","🧿","🪬","🪧","📿","💎","📯","🎯","🎮","🃏","🎴","🀄","🎲","🧩","♟","🎭","🎨","🧵","🪡","🧶","🪢"],
  },
  {
    name: "Nature",
    emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜","🪰","🪲","🪳","🦟","🦗","🕷","🕸","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🪸","🐊"],
  },
  {
    name: "Food",
    emojis: ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🫘","🥐","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🦴","🌭","🍔","🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜"],
  },
  {
    name: "Activity",
    emojis: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🏑","🥍","🏏","🪃","🥅","⛳","🪁","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸","🥌","🎿","⛷","🏂","🪂","🏋️","🤼","🤸","⛹️","🤺","🤾","🏌️","🏇","🧘","🏄","🏊","🤽","🚣","🧗","🚵","🚴"],
  },
  {
    name: "Travel",
    emojis: ["🚗","🚕","🚙","🚌","🚎","🏎","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🏍","🛵","🛺","🚲","🛴","🛹","🚏","🛣","🛤","⛽","🛑","🚨","🚥","🚦","🛰","🚀","🛸","🚁","🛶","⛵","🚤","🛥","🛳","⛴","🚢","✈️","🛩","🛫","🛬","🪂","💺","🗺","🧭","🏔","⛰","🌋","🗻","🏕","🏖","🏜","🏝","🏞","🏟","🏛","🏗","🧱","🪨","🪵","🏘","🏚","🏠","🏡","🏢","🏣","🏤","🏥","🏦","🏨","🏩","🏪","🏫","🏬","🏭","🏯","🏰","💒","🗼","🗽","⛪","🕌","🛕","🕍","⛩","🕋","⛲","🌄","🌅","🌆","🌇","🌉"],
  },
  {
    name: "Symbols",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮","✝","☪","🕉","☸","✡","🔯","🕎","☯","☦","🛐","⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔","⚛","🉑","☢","☣","📴","📳","🆚","🉐","㊙","㊗","🆘","🛑","⛔","📛","🚫","💢","♨","🚷","🚯","🚳","🚱","🔞","📵","🚭","❗","❕","❓","❔","‼","⁉","💯","🔱","⚜","🔰","♻","✅","💹","❇","✳","❎","🌐","💠","ⓜ","🆗","🆙","🆒","🆕","🆓","🆖"],
  },
];

// --- option-menu commands ------------------------------------------------
// Each entry defines a command shown in the Option (⌥) menu.
//   key:    single letter pressed while ⌥ is held
//   label:  display name in the hint bar
//   action: function to execute
//   modes:  which modes ("todo", "ideas") this command appears in
const COMMANDS = [
  { key: "H", label: "Today", action: goToday, modes: ["todo"], hideOnToday: true },
  { key: "I", label: "Ideas", action: () => switchMode("ideas"), modes: ["todo"] },
  { key: "H", label: "Todo", action: () => switchMode("todo"), modes: ["ideas"] },
  { key: "T", label: "Tags", action: openTagList, modes: ["todo", "ideas"] },
  { key: "S", label: "Settings", action: openSettings, modes: ["todo", "ideas"] },
];

// View state.
let mode = "todo"; // "todo" | "ideas"
let previousMode = "todo"; // the mode active before the current one (for Esc-back)
let current = null; // YYYY-MM-DD of the viewed day
let viewIsPast = false; // whether the viewed day is before today
let lastData = null; // most recent DayData (for re-render on edit)
let editingIndex = null; // index currently being edited inline, or null
let cancelEdit = false; // set when an edit is aborted via Escape
let dragState = null; // active pointer-drag state, or null
let selectedIndex = null; // keyboard-highlighted row, or null
let pendingDeleteIndex = null; // row showing inline delete confirmation, or null

// Tag state.
let tagCache = []; // all known tags (from get_tags), for autocomplete
let activeTag = null; // truthy when the results view is open (display label)
let activeTags = []; // the tag names currently driving the results view
let tagMatchAll = false; // results view: false = match ANY (OR), true = match ALL (AND)
let selectedTags = []; // Tags view: the tags checked for multi-select
let tagResultRows = []; // results view: one entry per selectable row, in DOM order
let tagListView = false; // when true, the app shows the browsable Tags view
let filterCameFromList = false; // whether the active results were opened from the Tags view
let tagFilterReturn = null; // { mode, current } to restore when the whole tag flow exits

// Settings state.
let settingsView = false; // when true, the app shows the Settings view
let settingsReturn = null; // { mode, current } to restore when Settings is closed
const SETTINGS_KEY = "supertodo.settings";
let settings = {
  // Default on first launch: input order. Users can switch to alphabetical in Settings.
  sortTagsAlpha: false, // sort tag chips alphabetically (vs. input order) on rows
};
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) settings = Object.assign(settings, JSON.parse(raw));
  } catch (e) {
    console.log("[ui] loadSettings failed", e);
  }
}
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.log("[ui] saveSettings failed", e);
  }
}

// Where files are stored. Unlike the localStorage settings above, this lives in
// the Rust backend (it decides where files are read/written), so it's fetched on
// demand and cached here for the Settings view.
// { path, custom, default_path, env_override } | null
let storageInfo = null;

// Settings keyboard navigation: a cursor over the actionable rows. Each entry is
// { el, onEnter, disabled }; ↑↓ move the cursor and Enter runs the row's action
// (toggle a toggle, or trigger a button — e.g. open the folder dialog).
let settingsIndex = 0;
let settingsRows = [];

// Idea state.
let ideas = []; // list of IdeaListEntry
let ideaDetailSlug = null; // slug of idea being viewed in detail, or null
let ideaDetailSourceIndex = null; // index in ideas[] when entering detail, for re-selecting on back
let ideaDetailDirty = false; // whether detail has unsaved changes
let todoDetailIndex = null; // index of the todo shown in its detail view, or null
let emojiPickerTarget = null; // { slug, callback } for the active picker

// --- date helpers (local, no timezone drift) ---
function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const p = (v) => String(v).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

// --- hashtags -------------------------------------------------------------

// Number of chip colors; tag N (by creation order) uses color ((N-1) % this) + 1.
const TAG_COLORS = 10;

// lowercased tag -> color slot (1..TAG_COLORS), keyed by creation order.
let tagColor = {};

// Refresh the cached tag vocabulary (in-use tags, for autocomplete/menus) and the
// color map (from the persistent creation-order ledger). Cheap; called at startup
// and after any mutation that may introduce or remove a tag.
async function refreshTags() {
  try {
    const [inUse, colors] = await Promise.all([
      invoke("get_tags"), // in-use tags (suggestions)
      invoke("get_tag_colors"), // persistent per-tag colors (from tags.json)
    ]);
    tagCache = inUse;
    tagColor = colors || {}; // { lowercased-tag: color 1..10 }
  } catch (e) {
    console.log("[ui] refreshTags failed", e);
  }
}

// The color slot for a tag. Falls back to a deterministic slot for a tag not yet
// in the cache (e.g. rendered in the instant before a refresh completes), so a
// chip is never left uncolored and the fallback stays stable per tag.
function colorForTag(tag) {
  const key = tag.toLowerCase();
  if (tagColor[key]) return tagColor[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i)) % TAG_COLORS;
  return h + 1;
}

// Tags sorted alphabetically — used for menus/pickers (the cache itself is kept
// in creation order for color assignment).
function sortedTags() {
  return [...tagCache].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
}

// The task text with its "#tag" tokens removed and whitespace tidied — what we
// show on the task line, since the tags are rendered separately as chips below.
function stripTags(text) {
  return text
    .replace(/#[A-Za-z0-9_-]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Tag names sorted alphabetically (case-insensitive) — the order chips are shown
// in on rows.
function sortTagsAlpha(tags) {
  return [...tags].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

// Append a row of tag chips to `container` — alphabetical or in input order per
// the Settings toggle. No-op for empty tags.
function appendTagChips(container, tags) {
  if (!tags || !tags.length) return;
  const row = document.createElement("span");
  row.className = "todo-tags";
  const ordered = settings.sortTagsAlpha ? sortTagsAlpha(tags) : tags;
  ordered.forEach((t) => row.appendChild(makeTagChip(t)));
  container.appendChild(row);
}

// Populate a todo `.label` span: the (tag-stripped) task text, then a chip row
// underneath for `tags`. XSS-safe — text via textContent, chips via createElement.
function fillTodoLabel(label, text, tags) {
  const textSpan = document.createElement("span");
  textSpan.className = "label-text";
  const stripped = stripTags(text);
  // Fall back to the raw text for a task that is nothing but tags.
  textSpan.textContent = stripped || text;
  label.appendChild(textSpan);

  appendTagChips(label, tags);
}

// A clickable chip that opens the global filter for `tag`. The chip shows the
// bare tag name (no leading '#') — its pill styling is what marks it as a tag.
function makeTagChip(tag) {
  const chip = document.createElement("span");
  chip.className = "tag-chip tag-c" + colorForTag(tag);
  chip.textContent = tag;
  chip.dataset.tag = tag;
  chip.title = "Filter by " + tag;
  chip.addEventListener("click", (e) => {
    e.stopPropagation();
    openTagFilter(tag);
  });
  return chip;
}

// Attach "#"-triggered tag autocomplete to a text <input> or <textarea>. When
// the caret sits inside a "#partial" token, a dropdown of matching known tags
// is shown; selecting one (click / Enter / Tab) completes the token. Keyboard
// handling is in the capture phase so it wins over the field's own Enter/Escape
// handlers while the menu is open.
function attachTagAutocomplete(input) {
  let menu = null;
  let items = [];
  let active = -1;
  let range = null; // [tokenStart, caret] of the "#partial" being completed

  function close() {
    if (menu) {
      menu.remove();
      menu = null;
    }
    items = [];
    active = -1;
    range = null;
  }

  function currentToken() {
    const caret = input.selectionStart;
    if (caret === null || caret !== input.selectionEnd) return null;
    const before = input.value.slice(0, caret);
    const m = before.match(/#([A-Za-z0-9_-]*)$/);
    if (!m) return null;
    return { partial: m[1], start: caret - m[1].length - 1, caret };
  }

  function update() {
    const tok = currentToken();
    if (!tok) {
      close();
      return;
    }
    const p = tok.partial.toLowerCase();
    const matches = sortedTags()
      .filter((t) => t.toLowerCase().startsWith(p) && t.toLowerCase() !== p)
      .slice(0, 8);
    if (matches.length === 0) {
      close();
      return;
    }
    items = matches;
    range = [tok.start, tok.caret];
    active = 0;
    draw();
  }

  function draw() {
    if (!menu) {
      menu = document.createElement("div");
      menu.className = "tag-autocomplete";
      document.body.appendChild(menu);
    }
    menu.innerHTML = "";
    items.forEach((t, i) => {
      const opt = document.createElement("div");
      opt.className = "tag-option" + (i === active ? " active" : "");
      opt.textContent = t;
      // mousedown (not click) so selection happens before the input blurs.
      opt.addEventListener("mousedown", (e) => {
        e.preventDefault();
        choose(i);
      });
      menu.appendChild(opt);
    });
    const r = input.getBoundingClientRect();
    menu.style.left = r.left + "px";
    menu.style.top = r.bottom + 2 + "px";
    menu.style.minWidth = r.width + "px";
  }

  function choose(i) {
    if (!range || !items[i]) return;
    const [start, caret] = range;
    const v = input.value;
    const insert = "#" + items[i] + " ";
    input.value = v.slice(0, start) + insert + v.slice(caret);
    const pos = start + insert.length;
    input.setSelectionRange(pos, pos);
    close();
    input.dispatchEvent(new Event("input"));
    input.focus();
  }

  input.addEventListener("input", update);
  input.addEventListener("blur", () => setTimeout(close, 120));
  input.addEventListener(
    "keydown",
    (e) => {
      if (!menu) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        active = (active + 1) % items.length;
        draw();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        active = (active - 1 + items.length) % items.length;
        draw();
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        choose(active);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    },
    true // capture: run before the field's own keydown handler
  );
}

function render(data, fx = null) {
  // The tag/settings views own the screen; ignore stray day/idea renders.
  if (activeTag || tagListView || settingsView) return;
  if (mode === "ideas") {
    renderIdeas(data);
  } else {
    renderTodo(data, fx);
  }
}

// `fx` is an optional one-shot animation hint describing the single thing that
// just changed, applied to the freshly-built DOM below:
//   { kind: "add" }                          -> new (last) row springs in
//   { kind: "toggle", index, nowChecked }    -> that row's check pulses / settles
//   { kind: "day", dir: -1 | 1 }             -> the list slides in from dir
function renderTodo(data, fx = null) {
  lastData = data;
  current = data.date;
  viewIsPast = data.is_past;
  todoDetailIndex = null; // rendering the list means we're out of the detail view

  weekdayEl.textContent = data.weekday;
  dateEl.textContent = data.pretty;

  todayBtn.hidden = data.is_today;
  // Past days are review-only: no adding or editing, but you can still tick
  // items done / not-done.
  composerEl.style.display = data.is_past ? "none" : "flex";

  listEl.innerHTML = "";

  if (data.items.length === 0) {
    editingIndex = null;
    selectedIndex = null;
    emptyEl.hidden = false;
    emptyEl.textContent = data.is_today
      ? "Nothing here yet — add your first task below."
      : "No todos for this day.";
    applyFx(fx); // day slide still plays even with nothing in the list
    updateHints();
    return;
  }
  emptyEl.hidden = true;

  // Cursor is always on a row when there are any: default to the first row,
  // and keep the highlight in range if the list shrank.
  if (selectedIndex === null) {
    selectedIndex = 0;
  } else if (selectedIndex >= data.items.length) {
    selectedIndex = data.items.length - 1;
  }

  // Drop a stale pending-delete if its row no longer exists.
  if (pendingDeleteIndex !== null && pendingDeleteIndex >= data.items.length) {
    pendingDeleteIndex = null;
  }

  data.items.forEach((item, index) => {
    const li = document.createElement("li");
    li.className =
      "todo-item" +
      (item.checked ? " done" : "") +
      (item.rolled ? " rolled" : "") +
      (data.is_past ? " past" : "");
    li.dataset.index = index;
    if (index === selectedIndex) li.classList.add("selected");
    // Rows can be dragged to reorder — but not on past days, not while an
    // inline edit is open, and not while a delete confirmation is showing.
    if (!data.is_past && editingIndex === null && pendingDeleteIndex === null) {
      li.classList.add("reorderable");
      li.addEventListener("pointerdown", onRowPointerDown);
    }

    const check = document.createElement("button");
    check.className = "check";
    check.innerHTML = CHECK_SVG;
    // Past days are review-only: the checkbox is shown but inert.
    if (data.is_past || item.rolled) {
      check.classList.add("readonly");
      check.disabled = true;
    } else {
      check.title = item.checked ? "Mark not done" : "Mark done";
      check.addEventListener("click", () => toggle(index));
    }
    li.appendChild(check);

    {
      const label = document.createElement("span");
      label.className = "label";
      fillTodoLabel(label, item.text, item.tags);
      // Clicking the task text opens its detail view (title / description /
      // tags), the way clicking an idea does. Past days are review-only.
      if (!data.is_past) {
        label.classList.add("clickable");
        label.addEventListener("click", () => renderTodoDetail(index));
      }
      li.appendChild(label);

      if (item.rolled) {
        // Rolled over to a later day — shown here only as a record.
        const badge = document.createElement("span");
        badge.className = "badge moved";
        badge.textContent = "moved on";
        li.appendChild(badge);
      } else if (item.carried) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = "carried over";
        li.appendChild(badge);
      }

      if (!data.is_past && pendingDeleteIndex === index) {
        // Inline delete confirmation — slides in from the right. Confirm with
        // the Delete button / key, cancel with Cancel / Esc.
        li.classList.add("pending-delete");
        const rc = document.createElement("div");
        rc.className = "row-confirm";

        const text = document.createElement("span");
        text.className = "row-confirm-text";
        text.textContent = "Delete?";

        const cancel = document.createElement("button");
        cancel.className = "rc-btn rc-cancel";
        cancel.textContent = "No";
        cancel.addEventListener("click", cancelPendingDelete);

        const confirm = document.createElement("button");
        confirm.className = "rc-btn rc-delete";
        confirm.textContent = "Yes";
        confirm.addEventListener("click", confirmPendingDelete);

        rc.append(text, cancel, confirm);
        li.appendChild(rc);
      } else if (!data.is_past) {
        // Edit + delete are only offered on today / future days.
        const actions = document.createElement("div");
        actions.className = "actions";

        const edit = document.createElement("button");
        edit.className = "icon-btn";
        edit.title = "Open task";
        edit.innerHTML = PENCIL_SVG;
        edit.addEventListener("click", () => renderTodoDetail(index));

        const del = document.createElement("button");
        del.className = "icon-btn danger";
        del.title = "Delete task";
        del.innerHTML = TRASH_SVG;
        del.addEventListener("click", () => requestDelete(index));

        actions.appendChild(edit);
        actions.appendChild(del);
        li.appendChild(actions);
      }
    }

    listEl.appendChild(li);
  });

  applyFx(fx);
  updateHints();
}

// --- todo detail view -----------------------------------------------------

// A full-screen detail for one task, mirroring the idea detail: an editable
// title, its created date, a tag box, and a Markdown description. Opened from
// the day list (Enter / click / pencil). Each field persists on blur via
// edit_task; Esc saves and returns to the day list.
function renderTodoDetail(index) {
  if (!lastData || !lastData.items || !lastData.items[index]) return;
  const date = lastData.date;
  const item = lastData.items[index];
  todoDetailIndex = index;
  pendingDeleteIndex = null;
  editingIndex = null;

  weekdayEl.textContent = lastData.weekday;
  dateEl.textContent = lastData.pretty;
  modeIndicatorEl.hidden = true;
  todayBtn.hidden = true;
  composerEl.style.display = "none";
  listEl.innerHTML = "";
  emptyEl.hidden = true;

  const detail = document.createElement("div");
  detail.className = "idea-detail todo-detail";

  // Title (no emoji for todos).
  const topRow = document.createElement("div");
  topRow.className = "detail-top";

  const titleInput = document.createElement("input");
  titleInput.className = "detail-title-input";
  titleInput.type = "text";
  titleInput.value = item.text;
  titleInput.addEventListener("blur", () => {
    const t = titleInput.value.trim();
    if (t && t !== item.text) {
      // Todos don't re-slug, so there's no need to rebuild the view (which would
      // steal focus); just persist and keep the local copy in sync.
      invoke("edit_task", { date, index, text: t }).then((data) => {
        lastData = data;
        item.text = t;
      });
    }
  });
  titleInput.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      titleInput.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      saveAndGoBackTodo(date, index, titleInput, textarea, item);
    }
  });
  topRow.appendChild(titleInput);
  detail.appendChild(topRow);

  // Created date.
  const createdLine = document.createElement("div");
  createdLine.className = "detail-created";
  createdLine.textContent = item.created ? `Created: ${item.created}` : "";
  detail.appendChild(createdLine);

  // Tags — the shared token box, persisting via edit_task.
  detail.appendChild(buildTodoTagBox(date, index, item));

  // Description.
  const descLabel = document.createElement("div");
  descLabel.className = "detail-desc-label";
  descLabel.textContent = "Description (Markdown)";
  detail.appendChild(descLabel);

  const textarea = document.createElement("textarea");
  textarea.className = "detail-textarea";
  textarea.value = item.description || "";
  textarea.spellcheck = false;
  textarea.addEventListener("blur", () => {
    if (textarea.value !== (item.description || "")) {
      invoke("edit_task", { date, index, description: textarea.value }).then(
        (data) => {
          lastData = data;
          item.description = textarea.value;
        }
      );
    }
  });
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      saveAndGoBackTodo(date, index, titleInput, textarea, item);
    }
  });
  detail.appendChild(textarea);

  listEl.appendChild(detail);
  titleInput.focus();
  updateHints();
}

// Persist any pending title/description edits, then return to the day list.
async function saveAndGoBackTodo(date, index, titleInput, textarea, item) {
  const newTitle = titleInput.value.trim();
  const newDesc = textarea.value;
  if (newTitle && newTitle !== item.text) {
    lastData = await invoke("edit_task", { date, index, text: newTitle });
  }
  if (newDesc !== (item.description || "")) {
    lastData = await invoke("edit_task", { date, index, description: newDesc });
  }
  closeTodoDetail(index);
}

// Leave the todo detail and re-render the day list, keeping the row selected.
function closeTodoDetail(index) {
  todoDetailIndex = null;
  if (typeof index === "number") selectedIndex = index;
  renderTodo(lastData);
}

// --- idea list view -------------------------------------------------------

function renderIdeas(data) {
  console.log("[ui] renderIdeas: data.length=", data.length, "ideaDetailSlug=", ideaDetailSlug);
  ideas = data;
  ideaDetailSlug = null;
  editingIndex = null;

  // Show ideas header
  weekdayEl.textContent = "";
  dateEl.textContent = "Ideas";
  modeIndicatorEl.hidden = true;
  todayBtn.hidden = true;
  composerEl.style.display = "flex";

  const n = ideas.length;
  listEl.innerHTML = "";

  if (n === 0) {
    console.log("[ui] renderIdeas: empty list");
    selectedIndex = null;
    emptyEl.hidden = false;
    emptyEl.textContent = "No ideas yet — add your first idea below.";
    updateHints();
    return;
  }
  emptyEl.hidden = true;

  if (selectedIndex === null) {
    selectedIndex = 0;
  } else if (selectedIndex >= n) {
    selectedIndex = n - 1;
  }
  console.log("[ui] renderIdeas: selectedIndex=", selectedIndex, "total=", n);

  ideas.forEach((idea, index) => {
    console.log("[ui] renderIdeas: row", index, "slug=", idea.slug, "title=", idea.title, "emoji=", idea.emoji, "created=", idea.created);
    const li = document.createElement("li");
    li.className = "todo-item idea-row";
    li.dataset.index = index;
    if (index === selectedIndex) li.classList.add("selected");
    li.addEventListener("click", (e) => {
      if (pendingDeleteIndex !== null) return;
      if (e.target.closest("button")) return;
      console.log("[ui] click: idea index=", index, "slug=", idea.slug);
      renderIdeaDetail(idea.slug);
    });

    const emojiSpan = document.createElement("span");
    emojiSpan.className = "idea-emoji";
    emojiSpan.textContent = idea.emoji;
    li.appendChild(emojiSpan);

    const label = document.createElement("span");
    label.className = "label";
    const textSpan = document.createElement("span");
    textSpan.className = "label-text";
    textSpan.textContent = idea.title;
    label.appendChild(textSpan);
    const dateSpan = document.createElement("span");
    dateSpan.className = "idea-date-sub";
    dateSpan.textContent = `Created on ${idea.created}`;
    label.appendChild(dateSpan);

    appendTagChips(label, idea.tags);

    li.appendChild(label);

    if (pendingDeleteIndex === index) {
      li.classList.add("pending-delete");
      const rc = document.createElement("div");
      rc.className = "row-confirm";

      const text = document.createElement("span");
      text.className = "row-confirm-text";
      text.textContent = "Delete?";

      const cancel = document.createElement("button");
      cancel.className = "rc-btn rc-cancel";
      cancel.textContent = "No";
      cancel.addEventListener("click", cancelPendingDelete);

      const confirm = document.createElement("button");
      confirm.className = "rc-btn rc-delete";
      confirm.textContent = "Yes";
      confirm.addEventListener("click", () => deleteIdea(index));

      rc.append(text, cancel, confirm);
      li.appendChild(rc);
    } else {
      const actions = document.createElement("div");
      actions.className = "actions";

      const del = document.createElement("button");
      del.className = "icon-btn danger";
      del.title = "Delete idea";
      del.innerHTML = TRASH_SVG;
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        requestDeleteIdea(index);
      });

      actions.appendChild(del);
      li.appendChild(actions);
    }

    listEl.appendChild(li);
  });

  updateHints();
}

// --- idea detail view -----------------------------------------------------

function renderIdeaDetail(slug) {
  console.log("[ui] renderIdeaDetail: slug=", slug);
  ideaDetailSlug = slug;
  ideaDetailSourceIndex = selectedIndex;
  ideaDetailDirty = false;
  pendingDeleteIndex = null;
  editingIndex = null;

  invoke("get_idea", { slug }).then((idea) => {
    console.log("[ui] renderIdeaDetail: got idea=", idea);
    if (!idea) {
      console.log("[ui] renderIdeaDetail: idea is null/undefined, switching to ideas list");
      switchMode("ideas");
      return;
    }
    console.log("[ui] renderIdeaDetail: title=", idea.title, "emoji=", idea.emoji, "description_len=", idea.description.length);

    weekdayEl.textContent = "";
    dateEl.textContent = "Ideas";
    modeIndicatorEl.hidden = true;
    todayBtn.hidden = true;
    composerEl.style.display = "none";
    listEl.innerHTML = "";
    emptyEl.hidden = true;

    const detail = document.createElement("div");
    detail.className = "idea-detail";

    // Emoji + title row
    const topRow = document.createElement("div");
    topRow.className = "detail-top";

    const emojiBtn = document.createElement("button");
    emojiBtn.className = "idea-emoji idea-emoji-btn";
    emojiBtn.textContent = idea.emoji;
    emojiBtn.title = "Change emoji";
    emojiBtn.addEventListener("click", () => {
      showEmojiPicker(idea.slug, idea.emoji, async (newEmoji) => {
        await editIdea(idea.slug, newEmoji, null, null);
        renderIdeaDetail(idea.slug);
      });
    });
    topRow.appendChild(emojiBtn);

    const titleInput = document.createElement("input");
    titleInput.className = "detail-title-input";
    titleInput.type = "text";
    titleInput.value = idea.title;
    titleInput.addEventListener("input", () => {
      ideaDetailDirty = true;
    });
    titleInput.addEventListener("blur", () => {
      const t = titleInput.value.trim();
      if (t && t !== idea.title) {
        editIdea(idea.slug, null, t, null).then((res) => {
          renderIdeaDetail(res.newSlug || idea.slug);
        });
      }
    });
    titleInput.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        titleInput.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        saveAndGoBack(idea.slug, titleInput, textarea, idea);
      }
    });
    topRow.appendChild(titleInput);

    detail.appendChild(topRow);

    // Created date
    const createdLine = document.createElement("div");
    createdLine.className = "detail-created";
    createdLine.textContent = `Created: ${idea.created}`;
    detail.appendChild(createdLine);

    // Tags — a token box: removable chips + an autocompleting add input.
    detail.appendChild(buildIdeaTagBox(idea));

    // Description textarea
    const descLabel = document.createElement("div");
    descLabel.className = "detail-desc-label";
    descLabel.textContent = "Description (Markdown)";
    detail.appendChild(descLabel);

    const textarea = document.createElement("textarea");
    textarea.className = "detail-textarea";
    textarea.value = idea.description;
    textarea.spellcheck = false;
    textarea.addEventListener("input", () => {
      ideaDetailDirty = true;
    });
    textarea.addEventListener("blur", () => {
      if (textarea.value !== idea.description) {
        editIdea(idea.slug, null, null, textarea.value);
      }
    });
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        saveAndGoBack(idea.slug, titleInput, textarea, idea);
      }
    });
    detail.appendChild(textarea);

    listEl.appendChild(detail);
    textarea.focus();
    updateHints();
  });
}

// A reusable token box: removable tag chips plus an add-input with autocomplete
// over the shared vocabulary. `initialTags` seeds it; `onSave(tags)` is awaited
// after every add/remove to persist the change, so tags survive even if the
// detail view is closed without touching anything else. Used by both ideas and
// todos — only the persistence callback differs.
function buildTagBox(initialTags, onSave) {
  const wrap = document.createElement("div");
  wrap.className = "detail-tags";

  const label = document.createElement("div");
  label.className = "detail-desc-label";
  label.textContent = "Tags";
  wrap.appendChild(label);

  const box = document.createElement("div");
  box.className = "tag-box";
  wrap.appendChild(box);

  let tags = (initialTags || []).slice();

  const input = document.createElement("input");
  input.className = "tag-box-input";
  input.type = "text";
  input.placeholder = "Add tag…";
  input.autocomplete = "off";
  input.spellcheck = false;

  // Persist, then refresh the color map so a newly added tag's chip gets its
  // real ledger color immediately (not the fallback) on the redraw that follows.
  async function save() {
    await onSave(tags.slice());
    await refreshTags();
  }

  async function addTag(raw) {
    const t = (raw || "").trim().replace(/^#+/, "").trim();
    if (!t || !/^[A-Za-z0-9_-]+$/.test(t)) return;
    if (tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    tags.push(t);
    await save();
    redraw();
    input.focus();
  }

  async function removeTag(t) {
    tags = tags.filter((x) => x !== t);
    await save();
    redraw();
    input.focus();
  }

  function redraw() {
    box.innerHTML = "";
    tags.forEach((t) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip removable tag-c" + colorForTag(t);
      const txt = document.createElement("span");
      txt.className = "tag-chip-text";
      txt.textContent = t;
      // Clicking the chip body opens the global filter for this tag.
      txt.addEventListener("click", () => openTagFilter(t));
      chip.appendChild(txt);
      const x = document.createElement("button");
      x.className = "tag-x";
      x.textContent = "×";
      x.title = "Remove tag";
      x.addEventListener("click", (e) => {
        e.stopPropagation();
        removeTag(t);
      });
      chip.appendChild(x);
      box.appendChild(chip);
    });
    box.appendChild(input);
  }

  // Autocomplete dropdown (bare tag names — no '#' needed to search).
  let menu = null;
  let mItems = [];
  let mActive = -1;
  function closeMenu() {
    if (menu) {
      menu.remove();
      menu = null;
    }
    mItems = [];
    mActive = -1;
  }
  function updateMenu() {
    const p = input.value.trim().replace(/^#+/, "").toLowerCase();
    if (!p) {
      closeMenu();
      return;
    }
    const matches = sortedTags()
      .filter(
        (t) =>
          t.toLowerCase().startsWith(p) &&
          !tags.some((x) => x.toLowerCase() === t.toLowerCase())
      )
      .slice(0, 8);
    if (matches.length === 0) {
      closeMenu();
      return;
    }
    mItems = matches;
    mActive = 0;
    drawMenu();
  }
  function drawMenu() {
    if (!menu) {
      menu = document.createElement("div");
      menu.className = "tag-autocomplete";
      document.body.appendChild(menu);
    }
    menu.innerHTML = "";
    mItems.forEach((t, i) => {
      const opt = document.createElement("div");
      opt.className = "tag-option" + (i === mActive ? " active" : "");
      opt.textContent = t;
      opt.addEventListener("mousedown", (e) => {
        e.preventDefault();
        input.value = "";
        addTag(t);
        closeMenu();
      });
      menu.appendChild(opt);
    });
    const r = input.getBoundingClientRect();
    menu.style.left = r.left + "px";
    menu.style.top = r.bottom + 2 + "px";
    menu.style.minWidth = "140px";
  }

  input.addEventListener("input", updateMenu);
  input.addEventListener("blur", () => setTimeout(closeMenu, 120));
  input.addEventListener("keydown", (e) => {
    if (menu) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        mActive = (mActive + 1) % mItems.length;
        drawMenu();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        mActive = (mActive - 1 + mItems.length) % mItems.length;
        drawMenu();
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        input.value = "";
        addTag(mItems[mActive]);
        closeMenu();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      addTag(input.value);
      input.value = "";
    } else if (e.key === "Backspace" && input.value === "" && tags.length) {
      e.stopPropagation();
      removeTag(tags[tags.length - 1]);
    }
    // Escape with no menu is left to bubble so the detail view can exit.
  });

  redraw();
  return wrap;
}

// An idea's tag box: persists via editIdea.
function buildIdeaTagBox(idea) {
  return buildTagBox(idea.tags, async (tags) => {
    idea.tags = tags;
    await editIdea(idea.slug, null, null, null, tags);
  });
}

// A todo's tag box: persists via edit_task for the given day + row.
function buildTodoTagBox(date, index, item) {
  return buildTagBox(item.tags, async (tags) => {
    item.tags = tags;
    lastData = await invoke("edit_task", { date, index, tags });
  });
}

// --- emoji picker ---------------------------------------------------------

function showEmojiPicker(slug, currentEmoji, callback) {
  console.log("[ui] showEmojiPicker: slug=", slug, "currentEmoji=", currentEmoji);
  hideEmojiPicker();

  emojiPickerTarget = { slug, callback };

  const overlay = document.createElement("div");
  overlay.className = "emoji-picker-overlay";
  overlay.addEventListener("click", hideEmojiPicker);

  const picker = document.createElement("div");
  picker.className = "emoji-picker";
  picker.addEventListener("click", (e) => e.stopPropagation());

  // Category tabs
  const tabBar = document.createElement("div");
  tabBar.className = "emoji-tabs";
  let activeCategory = 0;

  const pageContainer = document.createElement("div");
  pageContainer.className = "emoji-page";

  function renderCategory(idx) {
    pageContainer.innerHTML = "";
    tabBar.querySelectorAll(".emoji-tab").forEach((t, i) => {
      t.classList.toggle("active", i === idx);
    });
    const cat = EMOJI_CATEGORIES[idx];
    const grid = document.createElement("div");
    grid.className = "emoji-grid";
    cat.emojis.forEach((e) => {
      const btn = document.createElement("button");
      btn.className = "emoji-cell" + (e === currentEmoji ? " selected" : "");
      btn.textContent = e;
      btn.addEventListener("click", () => {
        callback(e);
        hideEmojiPicker();
        // Refresh the detail view if open
        if (ideaDetailSlug) renderIdeaDetail(ideaDetailSlug);
      });
      grid.appendChild(btn);
    });
    pageContainer.appendChild(grid);
  }

  EMOJI_CATEGORIES.forEach((cat, i) => {
    const tab = document.createElement("button");
    tab.className = "emoji-tab" + (i === 0 ? " active" : "");
    tab.textContent = cat.name;
    tab.addEventListener("click", () => {
      activeCategory = i;
      renderCategory(i);
    });
    tabBar.appendChild(tab);
  });

  picker.appendChild(tabBar);
  picker.appendChild(pageContainer);
  overlay.appendChild(picker);
  document.body.appendChild(overlay);

  renderCategory(0);
}

function hideEmojiPicker() {
  console.log("[ui] hideEmojiPicker");
  const overlay = document.querySelector(".emoji-picker-overlay");
  if (overlay) overlay.remove();
  emojiPickerTarget = null;
}

// --- idea actions ---------------------------------------------------------

async function addIdea(text) {
  console.log("[ui] addIdea: called with text=", text);
  if (!text) {
    console.log("[ui] addIdea: empty text, returning");
    return;
  }
  console.log("[ui] addIdea: invoking add_idea with title=", text);
  const result = await invoke("add_idea", { title: text });
  ideas = result.entries;
  // Find the exact index of the new idea in the sorted list
  const newIndex = ideas.findIndex(e => e.slug === result.new_slug);
  selectedIndex = newIndex >= 0 ? newIndex : 0;
  console.log("[ui] addIdea: got", ideas.length, "ideas, new_slug=", result.new_slug, "newIndex=", selectedIndex);
  renderIdeaDetail(result.new_slug);
  console.log("[ui] addIdea: done");
}

async function editIdea(slug, emoji, title, description, tags = null) {
  console.log("[ui] editIdea: slug=", slug, "emoji=", emoji, "title=", title, "description_len=", description && description.length, "tags=", tags);
  const args = { slug };
  if (emoji !== null) args.emoji = emoji;
  if (title !== null) args.title = title;
  if (description !== null) args.description = description;
  if (tags !== null) args.tags = tags;
  const result = await invoke("edit_idea", args);
  ideas = result.entries;
  refreshTags();
  console.log("[ui] editIdea: done,", ideas.length, "ideas, new_slug=", result.new_slug);
  return { ideas: result.entries, newSlug: result.new_slug };
}

async function deleteIdea(index) {
  console.log("[ui] deleteIdea: index=", index, "ideas.length=", ideas.length);
  const idea = ideas[index];
  if (!idea) {
    console.log("[ui] deleteIdea: no idea at index", index);
    return;
  }
  console.log("[ui] deleteIdea: deleting slug=", idea.slug, "title=", idea.title);
  ideas = await invoke("delete_idea", { slug: idea.slug });
  console.log("[ui] deleteIdea: done,", ideas.length, "ideas remaining");
  pendingDeleteIndex = null;
  selectedIndex = null;
  renderIdeas(ideas);
}

function requestDeleteIdea(index) {
  console.log("[ui] requestDeleteIdea: index=", index);
  selectedIndex = index;
  pendingDeleteIndex = index;
  renderIdeas(ideas);
}

async function saveAndGoBack(slug, titleInput, textarea, originalIdea) {
  const newTitle = titleInput.value.trim();
  const newDesc = textarea.value;
  const promises = [];
  if (newTitle && newTitle !== originalIdea.title) {
    promises.push(editIdea(slug, null, newTitle, null));
  }
  if (newDesc !== originalIdea.description) {
    promises.push(editIdea(slug, null, null, newDesc));
  }
  await Promise.all(promises);
  switchMode("ideas");
}

// --- mode switching -------------------------------------------------------

async function switchMode(newMode) {
  console.log("[ui] switchMode: from", mode, "to", newMode);
  // Remember where we came from so Esc can return to the previous module.
  if (newMode !== mode) previousMode = mode;
  hideEmojiPicker();
  editingIndex = null;
  pendingDeleteIndex = null;
  selectedIndex = null;
  ideaDetailSlug = null;
  todoDetailIndex = null;
  inputEl.blur();

  // If coming back from idea detail, re-select the source idea
  const restoreIdeaIndex = newMode === "ideas" && ideaDetailSourceIndex !== null
    ? ideaDetailSourceIndex : null;
  const detailSlug = ideaDetailSlug;
  ideaDetailSourceIndex = null;
  ideaDetailSlug = null;

  mode = newMode;

  if (mode === "ideas") {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    modeIndicatorEl.hidden = true;
    weekdayEl.textContent = "";
    inputEl.placeholder = "Add an idea…";
    console.log("[ui] switchMode: fetching ideas...");
    ideas = await invoke("get_ideas");
    console.log("[ui] switchMode: got", ideas.length, "ideas", ideas);
    if (restoreIdeaIndex !== null && restoreIdeaIndex < ideas.length) {
      selectedIndex = restoreIdeaIndex;
    } else if (detailSlug) {
      const found = ideas.findIndex(e => e.slug === detailSlug);
      if (found >= 0) selectedIndex = found;
    }
    renderIdeas(ideas);
  } else {
    prevBtn.style.display = "";
    nextBtn.style.display = "";
    modeIndicatorEl.hidden = true;
    inputEl.placeholder = "Add a task…";
    inputEl.blur();
    renderTodo(await invoke("get_today"));
  }
  console.log("[ui] switchMode: done, mode=", mode);
}


// Kick off the one-shot animation for whatever just changed. Row-level classes
// land on a freshly-built element so they always replay; the list-level day
// slide is force-restarted with a reflow so rapid navigation re-animates.
function applyFx(fx) {
  if (!fx || reduceMotion.matches) return;
  if (fx.kind === "add") {
    const row = listEl.lastElementChild;
    if (row) row.classList.add("fx-enter");
  } else if (fx.kind === "toggle") {
    const row = listEl.querySelector(`.todo-item[data-index="${fx.index}"]`);
    if (row) row.classList.add(fx.nowChecked ? "fx-check" : "fx-uncheck");
  } else if (fx.kind === "day") {
    const cls = fx.dir < 0 ? "fx-day-prev" : "fx-day-next";
    listEl.classList.remove("fx-day-prev", "fx-day-next");
    void listEl.offsetWidth;
    listEl.classList.add(cls);
  }
}

// A small burst of accent-colored particles from `anchor`'s center — the reward
// for clearing the last open task of the day. Particles live on <body> so a
// re-render can't wipe them mid-flight, and remove themselves when done.
function celebrate(anchor) {
  if (reduceMotion.matches || !anchor) return;
  const r = anchor.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const N = 10;
  for (let i = 0; i < N; i++) {
    const dot = document.createElement("div");
    dot.className = "burst-dot";
    const angle = (Math.PI * 2 * i) / N + Math.random() * 0.5;
    const dist = 26 + Math.random() * 24;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 12; // bias the spray upward
    document.body.appendChild(dot);
    dot
      .animate(
        [
          { transform: `translate(${cx}px, ${cy}px) scale(1)`, opacity: 1 },
          {
            transform: `translate(${cx + dx}px, ${cy + dy}px) scale(0.3)`,
            opacity: 0,
          },
        ],
        {
          duration: 520 + Math.random() * 240,
          easing: "cubic-bezier(0.2, 0.6, 0.3, 1)",
        }
      )
      .addEventListener("finish", () => dot.remove());
  }
}

// Collapse + slide a row out before the list closes the gap behind it.
function animateRowOut(row) {
  return new Promise((resolve) => {
    const h = row.offsetHeight;
    row.style.height = h + "px";
    row.style.overflow = "hidden";
    void row.offsetWidth; // lock the start height before transitioning
    row.style.transition =
      "height 0.2s ease, opacity 0.18s ease, transform 0.18s ease, " +
      "padding 0.2s ease, margin 0.2s ease";
    row.style.height = "0px";
    row.style.paddingTop = "0";
    row.style.paddingBottom = "0";
    row.style.marginTop = "0";
    row.style.opacity = "0";
    row.style.transform = "translateX(14px)";
    setTimeout(resolve, 200);
  });
}

// --- keyboard selection ---
function applySelection() {
  listEl.querySelectorAll(".todo-item").forEach((row) => {
    const on = Number(row.dataset.index) === selectedIndex;
    row.classList.toggle("selected", on);
    if (on) row.scrollIntoView({ block: "nearest" });
  });
}

// --- contextual key hints (status bar) ---

let optionMenuActive = false;

function showOptionMenu() {
  optionMenuActive = true;
  const cmds = COMMANDS.filter(c => {
    if (!c.modes.includes(mode)) return false;
    if (c.hideOnToday && lastData && lastData.is_today) return false;
    return true;
  });
  const html = cmds.length
    ? cmds.map(c => `<span class="k">${c.key}</span> ${c.label}`).join("  ·  ")
    : 'No command available';
  updateHints(html);
}

function hideOptionMenu() {
  optionMenuActive = false;
  updateHints();
}

function hintHTML(pairs) {
  return pairs
    .map(([k, l]) => `<span class="k">${k}</span> ${l}`)
    .join("  ·  ");
}

function updateHints(force = null) {
  if (force !== null) {
    statusEl.innerHTML = `<span class="statusbar-track">${force}</span>`;
    measureHintTicker();
    return;
  }

  // Settings view hints
  if (settingsView) {
    statusEl.innerHTML = `<span class="statusbar-track">${hintHTML([
      ["↑↓", "Move"],
      ["⏎", "Select"],
      ["Esc", "Back"],
    ])}</span>`;
    measureHintTicker();
    return;
  }

  // Tags view hints
  if (tagListView) {
    const pairs = [
      ["↑↓", "Move"],
      ["Space", "Select"],
      ["⏎", selectedTags.length ? `Show ${selectedTags.length}` : "Filter"],
      ["Esc", selectedTags.length ? "Clear" : "Back"],
    ];
    statusEl.innerHTML = `<span class="statusbar-track">${hintHTML(pairs)}</span>`;
    measureHintTicker();
    return;
  }

  // Tag results view hints
  if (activeTag) {
    const pairs = [];
    if (tagResultRows.length) pairs.push(["↑↓", "Move"], ["⏎", "Open"]);
    if (activeTags.length > 1) pairs.push(["Tab", tagMatchAll ? "Any" : "All"]);
    pairs.push(["Esc", filterCameFromList ? "Back to tags" : "Clear filter"]);
    statusEl.innerHTML = `<span class="statusbar-track">${hintHTML(pairs)}</span>`;
    measureHintTicker();
    return;
  }

  // Idea detail view hints
  if (mode === "ideas" && ideaDetailSlug) {
    statusEl.innerHTML = `<span class="statusbar-track">${hintHTML([["Esc", "Back"]])}</span>`;
    measureHintTicker();
    return;
  }

  // Todo detail view hints
  if (mode === "todo" && todoDetailIndex !== null) {
    statusEl.innerHTML = `<span class="statusbar-track">${hintHTML([["Esc", "Back"]])}</span>`;
    measureHintTicker();
    return;
  }

  // Idea list view hints
  if (mode === "ideas") {
    const n = ideas.length;
    if (pendingDeleteIndex !== null) {
      statusEl.innerHTML = `<span class="statusbar-track">${hintHTML([["⌫", "Delete"], ["Esc", "Cancel"]])}</span>`;
      measureHintTicker();
      return;
    }
    if (document.activeElement === inputEl) {
      statusEl.innerHTML = `<span class="statusbar-track">${hintHTML([["⏎", "Add"], ["Esc", "Clear"]])}</span>`;
      measureHintTicker();
      return;
    }
    if (n === 0) {
      statusEl.innerHTML = `<span class="statusbar-track">${hintHTML([["Type", "to add"], ["Esc", "Back"], ["⌥", "Commands"]])}</span>`;
    } else {
      statusEl.innerHTML = `<span class="statusbar-track">${hintHTML([
        ["↑↓", "Move"],
        ["⏎", "Open"],
        ["⌫", "Delete"],
        ["Esc", "Back"],
        ["⌥", "Commands"],
      ])}</span>`;
    }
    measureHintTicker();
    return;
  }

  // Todo mode hints (original logic)
  let pairs;
  if (pendingDeleteIndex !== null) {
    pairs = [["⌫", "Delete"], ["Esc", "Cancel"]];
  } else if (editingIndex !== null) {
    pairs = [["⏎", "Save"], ["Esc", "Cancel"]];
  } else if (document.activeElement === inputEl) {
    pairs = [["⏎", "Add"], ["Esc", "Clear"]];
  } else {
    const n = lastData ? lastData.items.length : 0;
    if (n === 0) {
      const base = viewIsPast
        ? [["←→", "Day"], ["⇧←→", "Week"]]
        : [["Type", "to add"], ["←→", "Day"], ["⇧←→", "Week"]];
      pairs = base.concat([["⌥", "Commands"]]);
    } else if (viewIsPast) {
      pairs = [
        ["↑↓", "Move"],
        ["←→", "Day"],
        ["⇧←→", "Week"],
        ["⌥", "Commands"],
      ];
    } else {
      pairs = [
        ["↑↓", "Move"],
        ["Space", "Done"],
        ["⏎", "Edit"],
        ["⇧↑↓", "Reorder"],
        ["⌫", "Delete"],
        ["←→", "Day"],
        ["⇧←→", "Week"],
        ["⌥", "Commands"],
      ];
    }
  }
  statusEl.innerHTML = `<span class="statusbar-track">${hintHTML(pairs)}</span>`;
  measureHintTicker();
}

// If the hints are wider than the bar, drive a slow ping-pong scroll (with a
// short pause at each end via the flat keyframe segments); otherwise the track
// stays centered and still. Re-measured on every hint change and on resize.
function measureHintTicker() {
  const track = statusEl.firstElementChild;
  if (!track) return;
  // Reset so the natural (unscrolled) width is what we measure.
  track.classList.remove("scrolling");
  statusEl.classList.remove("overflowing");
  track.style.removeProperty("--hint-shift");
  track.style.removeProperty("--hint-duration");

  const cs = getComputedStyle(statusEl);
  const avail =
    statusEl.clientWidth -
    parseFloat(cs.paddingLeft) -
    parseFloat(cs.paddingRight);
  const overflow = track.scrollWidth - avail;
  if (overflow <= 1) return;

  const distance = overflow + 2; // a hair of breathing room at the far end
  const pxPerSecond = 35; // slow, readable
  const oneWaySeconds = distance / pxPerSecond;
  // The moving portion of each cycle spans ~38% of the keyframe (12%→50%),
  // so the full cycle is oneWay / 0.38, floored so short overflows aren't zippy.
  const duration = Math.max(7, oneWaySeconds / 0.38);

  track.style.setProperty("--hint-shift", `-${distance}px`);
  track.style.setProperty("--hint-duration", `${duration.toFixed(1)}s`);
  statusEl.classList.add("overflowing");
  track.classList.add("scrolling");
}

window.addEventListener("resize", measureHintTicker);

// Move the highlighted row up (-1) or down (+1), wrapping at the ends. The
// cursor follows the moved task to its new position.
async function moveRow(dir) {
  if (viewIsPast || editingIndex !== null || selectedIndex === null) return;
  const n = lastData ? lastData.items.length : 0;
  if (n < 2) return;
  const from = selectedIndex;
  let to = from + dir;
  if (to < 0) to = n - 1; // wrap top -> bottom
  else if (to > n - 1) to = 0; // wrap bottom -> top
  const order = Array.from({ length: n }, (_, i) => i);
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  selectedIndex = to;

  // FLIP: remember where every row sits, re-render into the new order, then let
  // each row glide from its old position to its new one. `order[newPos]` is the
  // old index (== old DOM position) of whatever now sits at newPos.
  const beforeTops = [...listEl.children].map(
    (c) => c.getBoundingClientRect().top
  );
  render(await invoke("reorder_task", { date: current, order }));
  if (reduceMotion.matches) return;
  [...listEl.children].forEach((row, newPos) => {
    const oldTop = beforeTops[order[newPos]];
    if (oldTop == null) return;
    const delta = oldTop - row.getBoundingClientRect().top;
    if (!delta) return;
    row.style.transition = "none";
    row.style.transform = `translateY(${delta}px)`;
    requestAnimationFrame(() => {
      row.style.transition = "transform 0.24s cubic-bezier(0.2, 0.7, 0.3, 1)";
      row.style.transform = "";
    });
  });
}

// --- actions ---
async function goToday() {
  if (mode !== "todo") {
    await switchMode("todo");
    return;
  }
  editingIndex = null;
  pendingDeleteIndex = null;
  selectedIndex = null;
  optionMenuActive = false;
  inputEl.blur();
  renderTodo(await invoke("get_today"));
}

// `dir` (-1 back / +1 forward) drives the slide direction; 0 = a plain jump.
async function goTo(iso, dir = 0) {
  editingIndex = null;
  pendingDeleteIndex = null;
  selectedIndex = null;
  inputEl.blur();
  render(
    await invoke("get_day", { date: iso }),
    dir ? { kind: "day", dir } : null
  );
}

// --- tag views ------------------------------------------------------------
// Two screens, both in-app (no modal): the Tags view (a browsable list of every
// tag) and the results view (every todo + idea carrying one selected tag).
// `tagFilterReturn` records where the flow started so exiting returns there.

// Open the browsable Tags view — the entry point for filtering by tag.
async function openTagList() {
  hideEmojiPicker();
  if (!tagFilterReturn) tagFilterReturn = { mode, current };
  await refreshTags();
  activeTag = null;
  tagListView = true;
  editingIndex = null;
  pendingDeleteIndex = null;
  selectedIndex = null;
  ideaDetailSlug = null;
  inputEl.blur();
  renderTagList();
}

// Show every todo (any day) and idea carrying `tag`. Clicking a chip anywhere
// routes here — a single-tag shortcut into the multi-tag results view.
async function openTagFilter(tag) {
  if (!tag) return;
  openTaggedResults([tag], false);
}

// Open the results view for a set of tags. `matchAll` picks the combine mode
// (ANY vs ALL); the results view lets the user flip it afterwards.
async function openTaggedResults(tags, matchAll) {
  const list = (tags || []).filter(Boolean);
  if (!list.length) return;
  hideEmojiPicker();
  if (!tagFilterReturn) tagFilterReturn = { mode, current };
  filterCameFromList = tagListView;
  tagListView = false;
  activeTags = list;
  tagMatchAll = !!matchAll;
  activeTag = list.length === 1 ? list[0] : `${list.length} tags`;
  editingIndex = null;
  pendingDeleteIndex = null;
  selectedIndex = null;
  ideaDetailSlug = null;
  inputEl.blur();
  await refetchTagged();
}

// Re-run the current results query and re-render — used on open and whenever the
// ANY/ALL toggle changes.
async function refetchTagged() {
  const result = await invoke("get_tagged_multi", {
    tags: activeTags,
    matchAll: tagMatchAll,
  });
  renderTagFilter(result);
}

// Flip the results view between matching ANY and ALL of the active tags.
function setTagMatchAll(all) {
  if (tagMatchAll === all) return;
  tagMatchAll = all;
  refetchTagged();
}

// Back out of the results view: to the Tags view if that's where we came from,
// otherwise all the way out of the tag flow.
function clearTagFilter() {
  if (filterCameFromList) {
    openTagList();
  } else {
    exitTagFlow();
  }
}

// Leave the Tags view entirely.
function exitTagView() {
  exitTagFlow();
}

// Restore whatever screen the tag flow was entered from.
function exitTagFlow() {
  const ret = tagFilterReturn || { mode: "todo", current: null };
  activeTag = null;
  activeTags = [];
  selectedTags = [];
  tagListView = false;
  filterCameFromList = false;
  tagFilterReturn = null;
  if (ret.mode === "ideas") {
    switchMode("ideas");
  } else {
    mode = "todo";
    prevBtn.style.display = "";
    nextBtn.style.display = "";
    if (ret.current) goTo(ret.current);
    else goToday();
  }
}

// Leave the tag flow and open a specific day / idea from a result row.
function jumpToDay(date) {
  activeTag = null;
  activeTags = [];
  selectedTags = [];
  tagListView = false;
  filterCameFromList = false;
  tagFilterReturn = null;
  mode = "todo";
  prevBtn.style.display = "";
  nextBtn.style.display = "";
  goTo(date);
}

async function openIdeaFromFilter(slug) {
  activeTag = null;
  activeTags = [];
  selectedTags = [];
  tagListView = false;
  filterCameFromList = false;
  tagFilterReturn = null;
  mode = "ideas";
  prevBtn.style.display = "none";
  nextBtn.style.display = "none";
  inputEl.placeholder = "Add an idea…";
  ideas = await invoke("get_ideas");
  renderIdeaDetail(slug);
}

// Whether `tag` is in the multi-select set (case-insensitive).
function isTagSelected(tag) {
  return selectedTags.some((t) => t.toLowerCase() === tag.toLowerCase());
}

// Add or remove `tag` from the multi-select set, then re-render the Tags view.
function toggleTagSelection(tag) {
  const i = selectedTags.findIndex((t) => t.toLowerCase() === tag.toLowerCase());
  if (i >= 0) selectedTags.splice(i, 1);
  else selectedTags.push(tag);
  renderTagList();
}

// Open the results view for whatever tags are currently checked.
function showSelectedTags() {
  if (selectedTags.length) openTaggedResults(selectedTags, tagMatchAll);
}

// The browsable Tags view: one checkable row per tag (alphabetical). A row's
// checkbox toggles it into the multi-select set; clicking the chip filters by
// that one tag immediately. Enter shows the selected set (or the cursor row if
// nothing is checked).
function renderTagList() {
  weekdayEl.textContent = "";
  dateEl.textContent = "Tags";
  modeIndicatorEl.hidden = true;
  todayBtn.hidden = true;
  prevBtn.style.display = "none";
  nextBtn.style.display = "none";
  composerEl.style.display = "none";
  listEl.innerHTML = "";

  const tags = sortedTags();
  if (tags.length === 0) {
    selectedIndex = null;
    selectedTags = [];
    emptyEl.hidden = false;
    emptyEl.textContent = "No tags yet — add #hashtags to todos or ideas.";
    updateHints();
    return;
  }
  emptyEl.hidden = true;

  // Drop any checked tags that no longer exist (e.g. after an edit).
  selectedTags = selectedTags.filter((t) =>
    tags.some((x) => x.toLowerCase() === t.toLowerCase())
  );

  // Action bar (always shown): the selection count plus Clear and Show results.
  // With nothing checked both buttons are disabled and the count reads "0".
  const has = selectedTags.length > 0;
  const bar = document.createElement("li");
  bar.className = "tag-select-bar";
  const count = document.createElement("span");
  count.className = "tag-select-count";
  count.textContent = `${selectedTags.length} selected`;
  const actions = document.createElement("span");
  actions.className = "tag-select-actions";
  const clear = document.createElement("button");
  clear.className = "tag-filter-clear";
  clear.textContent = "Clear";
  clear.disabled = !has;
  clear.addEventListener("click", () => {
    selectedTags = [];
    renderTagList();
  });
  const show = document.createElement("button");
  show.className = "tag-select-show";
  show.textContent = `Show results ›`;
  show.disabled = !has;
  show.addEventListener("click", showSelectedTags);
  actions.append(clear, show);
  bar.append(count, actions);
  listEl.appendChild(bar);

  if (selectedIndex === null) selectedIndex = 0;
  else if (selectedIndex >= tags.length) selectedIndex = tags.length - 1;

  tags.forEach((t, index) => {
    const li = document.createElement("li");
    li.className = "todo-item tag-list-row";
    li.dataset.index = index;
    if (index === selectedIndex) li.classList.add("selected");

    const box = document.createElement("span");
    box.className = "tag-check" + (isTagSelected(t) ? " on" : "");
    box.setAttribute("aria-hidden", "true");
    li.appendChild(box);

    const chip = document.createElement("span");
    chip.className = "tag-chip tag-c" + colorForTag(t);
    chip.textContent = t;
    chip.title = "Filter by " + t;
    li.appendChild(chip);

    // The chip is a shortcut to filter by this one tag; the rest of the row
    // (and its checkbox) toggles multi-select membership.
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedIndex = index;
      openTagFilter(t);
    });
    li.addEventListener("click", () => {
      selectedIndex = index;
      toggleTagSelection(t);
    });
    listEl.appendChild(li);
  });

  updateHints();
}

// --- settings view --------------------------------------------------------

function openSettings() {
  hideEmojiPicker();
  settingsReturn = { mode, current };
  settingsView = true;
  activeTag = null;
  activeTags = [];
  selectedTags = [];
  tagListView = false;
  editingIndex = null;
  pendingDeleteIndex = null;
  selectedIndex = null;
  ideaDetailSlug = null;
  settingsIndex = 0;
  inputEl.blur();
  renderSettings();
  // Storage info comes from the backend; refresh and re-render when it lands.
  refreshStorageInfo();
}

async function refreshStorageInfo() {
  try {
    storageInfo = await invoke("get_storage_info");
  } catch (e) {
    console.log("[ui] get_storage_info failed", e);
    storageInfo = null;
  }
  if (settingsView) renderSettings();
}

// Native folder picker → persist the choice. Existing files stay where they are;
// only where files are read/created changes.
async function chooseStorageFolder() {
  if (storageInfo && storageInfo.env_override) return;
  let picked;
  try {
    picked = await invoke("plugin:dialog|open", {
      options: {
        directory: true,
        multiple: false,
        title: "Choose the SuperTodo storage folder",
        defaultPath: (storageInfo && storageInfo.path) || undefined,
      },
    });
  } catch (e) {
    console.log("[ui] folder picker failed", e);
    return;
  }
  if (!picked || typeof picked !== "string") return; // cancelled
  try {
    storageInfo = await invoke("set_storage_dir", { path: picked });
  } catch (e) {
    // The backend rejects with a human-readable message (e.g. not writable).
    window.alert(typeof e === "string" ? e : "Couldn't use that folder.");
    return;
  }
  if (settingsView) renderSettings();
}

async function resetStorageFolder() {
  if (storageInfo && storageInfo.env_override) return;
  try {
    storageInfo = await invoke("reset_storage_dir");
  } catch (e) {
    console.log("[ui] reset_storage_dir failed", e);
    return;
  }
  if (settingsView) renderSettings();
}

function exitSettings() {
  const ret = settingsReturn || { mode: "todo", current: null };
  settingsView = false;
  settingsReturn = null;
  if (ret.mode === "ideas") {
    switchMode("ideas");
  } else {
    mode = "todo";
    prevBtn.style.display = "";
    nextBtn.style.display = "";
    if (ret.current) goTo(ret.current);
    else goToday();
  }
}

function setTagSort(alpha) {
  if (settings.sortTagsAlpha === alpha) return;
  settings.sortTagsAlpha = alpha;
  saveSettings();
  renderSettings();
}

function renderSettings() {
  weekdayEl.textContent = "";
  dateEl.textContent = "Settings";
  modeIndicatorEl.hidden = true;
  todayBtn.hidden = true;
  prevBtn.style.display = "none";
  nextBtn.style.display = "none";
  composerEl.style.display = "none";
  listEl.innerHTML = "";
  emptyEl.hidden = true;
  settingsRows = [];

  buildTagOrderRow();
  buildStorageRows();

  if (settingsRows.length) {
    settingsIndex = clampToEnabledRow(settingsIndex);
    highlightSettingsRow();
  }
  updateHints();
}

// Registers one selectable Settings row: appends it, remembers its action for the
// keyboard (↑↓/Enter), and mirrors that on mouse (hover moves the cursor, click
// runs the action). Inner segmented buttons keep their own click handling.
function addSettingsRow(el, { onEnter, disabled = false } = {}) {
  const idx = settingsRows.length;
  if (disabled) el.classList.add("disabled");
  el.addEventListener("mousemove", () => {
    if (!disabled && settingsIndex !== idx) {
      settingsIndex = idx;
      highlightSettingsRow();
    }
  });
  el.addEventListener("click", (e) => {
    if (disabled) return;
    settingsIndex = idx;
    highlightSettingsRow();
    if (e.target.closest(".settings-seg")) return; // seg button handles itself
    if (onEnter) onEnter();
  });
  listEl.appendChild(el);
  settingsRows.push({ el, onEnter, disabled });
}

function highlightSettingsRow() {
  settingsRows.forEach((r, i) => {
    const on = i === settingsIndex;
    r.el.classList.toggle("selected", on);
    if (on) r.el.scrollIntoView({ block: "nearest" });
  });
}

// Snap an index onto the nearest enabled row (disabled rows, e.g. under a
// SUPERTODO_DIR override, are skipped by the cursor).
function clampToEnabledRow(idx) {
  const n = settingsRows.length;
  if (!n) return 0;
  idx = Math.max(0, Math.min(idx, n - 1));
  if (!settingsRows[idx].disabled) return idx;
  for (let d = 1; d < n; d++) {
    if (idx + d < n && !settingsRows[idx + d].disabled) return idx + d;
    if (idx - d >= 0 && !settingsRows[idx - d].disabled) return idx - d;
  }
  return idx;
}

// Move the cursor to the next enabled row in `delta` direction, wrapping around.
function moveSettings(delta) {
  const n = settingsRows.length;
  if (!n) return;
  let i = settingsIndex;
  for (let step = 0; step < n; step++) {
    i = (i + delta + n) % n;
    if (!settingsRows[i].disabled) {
      settingsIndex = i;
      break;
    }
  }
  highlightSettingsRow();
}

// Enter on the current row: toggle a toggle, or trigger a button (the folder
// dialog / reset).
function activateSettings() {
  const r = settingsRows[settingsIndex];
  if (r && !r.disabled && r.onEnter) r.onEnter();
}

// A toggle row: Enter flips it; the segmented control also takes direct clicks.
function buildTagOrderRow() {
  const row = document.createElement("li");
  row.className = "settings-row";

  const info = document.createElement("div");
  info.className = "settings-info";
  const title = document.createElement("div");
  title.className = "settings-title";
  title.textContent = "Tag order on rows";
  const desc = document.createElement("div");
  desc.className = "settings-desc";
  desc.textContent = "How tag chips are ordered on todo and idea rows.";
  info.append(title, desc);
  row.appendChild(info);

  const seg = document.createElement("div");
  seg.className = "settings-seg";
  const mk = (label, alpha) => {
    const b = document.createElement("button");
    b.type = "button";
    b.tabIndex = -1;
    b.className = "seg-btn" + (settings.sortTagsAlpha === alpha ? " active" : "");
    b.textContent = label;
    b.addEventListener("click", () => setTagSort(alpha));
    return b;
  };
  seg.append(mk("Alphabetical", true), mk("Input order", false));
  row.appendChild(seg);

  addSettingsRow(row, { onEnter: () => setTagSort(!settings.sortTagsAlpha) });
}

// The storage-folder setting. The main row's action (Enter, or click) opens the
// native folder picker; when a custom folder is set, a second row resets to the
// default. Under a SUPERTODO_DIR override both are disabled.
function buildStorageRows() {
  const envOverride = storageInfo && storageInfo.env_override;
  const isCustom = storageInfo && storageInfo.custom;

  const row = document.createElement("li");
  row.className = "settings-row settings-row-stacked";

  const info = document.createElement("div");
  info.className = "settings-info";
  const title = document.createElement("div");
  title.className = "settings-title";
  title.textContent = "Storage folder";
  const desc = document.createElement("div");
  desc.className = "settings-desc";
  desc.textContent = "Where your todo and idea files are saved.";
  info.append(title, desc);

  const path = document.createElement("div");
  path.className = "settings-path";
  path.textContent = storageInfo ? storageInfo.path : "…";
  info.appendChild(path);

  if (envOverride) {
    const note = document.createElement("div");
    note.className = "settings-note";
    note.textContent =
      "Set by the SUPERTODO_DIR environment variable — clear it to change this here.";
    info.appendChild(note);
  } else if (isCustom) {
    const note = document.createElement("div");
    note.className = "settings-note";
    note.textContent = "Existing files stay in their old folder; they aren't moved.";
    info.appendChild(note);
  }
  row.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "settings-actions";
  const choose = document.createElement("button");
  choose.type = "button";
  choose.tabIndex = -1;
  choose.className = "settings-btn";
  choose.textContent = "Choose folder…";
  choose.disabled = !storageInfo || envOverride;
  actions.appendChild(choose);
  row.appendChild(actions);

  addSettingsRow(row, {
    onEnter: chooseStorageFolder,
    disabled: !storageInfo || envOverride,
  });

  if (isCustom && !envOverride) {
    const resetRow = document.createElement("li");
    resetRow.className = "settings-row";
    const rinfo = document.createElement("div");
    rinfo.className = "settings-info";
    const rtitle = document.createElement("div");
    rtitle.className = "settings-title";
    rtitle.textContent = "Reset to default folder";
    const rdesc = document.createElement("div");
    rdesc.className = "settings-desc";
    rdesc.textContent = storageInfo.default_path;
    rinfo.append(rtitle, rdesc);
    resetRow.appendChild(rinfo);

    const ractions = document.createElement("div");
    ractions.className = "settings-actions";
    const reset = document.createElement("button");
    reset.type = "button";
    reset.tabIndex = -1;
    reset.className = "settings-btn settings-btn-ghost";
    reset.textContent = "Reset";
    ractions.appendChild(reset);
    resetRow.appendChild(ractions);

    addSettingsRow(resetRow, { onEnter: resetStorageFolder });
  }
}

function renderTagFilter(result) {
  weekdayEl.textContent = "";
  dateEl.textContent = activeTags.length > 1 ? `${activeTags.length} tags` : result.tag;
  modeIndicatorEl.hidden = true;
  todayBtn.hidden = true;
  prevBtn.style.display = "none";
  nextBtn.style.display = "none";
  composerEl.style.display = "none";
  emptyEl.hidden = true;
  listEl.innerHTML = "";

  const multi = activeTags.length > 1;

  // Banner: what's being matched + (for multi-tag) an ANY/ALL switch + back.
  const banner = document.createElement("li");
  banner.className = "tag-filter-banner";
  const blabel = document.createElement("span");
  blabel.className = "tag-filter-label";
  blabel.textContent = multi
    ? `${tagMatchAll ? "All of" : "Any of"} ${activeTags.join(", ")}`
    : `Tagged “${result.tag}”`;
  banner.appendChild(blabel);

  if (multi) {
    const seg = document.createElement("span");
    seg.className = "settings-seg tag-match-seg";
    const mk = (label, all) => {
      const b = document.createElement("button");
      b.className = "seg-btn" + (tagMatchAll === all ? " active" : "");
      b.textContent = label;
      b.addEventListener("click", () => setTagMatchAll(all));
      return b;
    };
    seg.append(mk("Any", false), mk("All", true));
    banner.appendChild(seg);
  }

  const clr = document.createElement("button");
  clr.className = "tag-filter-clear";
  clr.textContent = filterCameFromList ? "‹ Tags" : "Clear ✕";
  clr.addEventListener("click", clearTagFilter);
  banner.appendChild(clr);
  listEl.appendChild(banner);

  // Rebuild the row map (one entry per selectable result, in DOM order) so the
  // keyboard cursor and Enter know what each row opens.
  tagResultRows = [];

  const total = result.todos.length + result.ideas.length;
  if (total === 0) {
    selectedIndex = null;
    const empty = document.createElement("li");
    empty.className = "tag-empty";
    empty.textContent = multi
      ? `Nothing matches ${tagMatchAll ? "all" : "any"} of these tags.`
      : `Nothing tagged “${result.tag}” yet.`;
    listEl.appendChild(empty);
    updateHints();
    return;
  }

  if (result.todos.length) {
    const h = document.createElement("li");
    h.className = "tag-section";
    h.textContent = "Todos";
    listEl.appendChild(h);
    result.todos.forEach((t) => {
      const index = tagResultRows.length;
      tagResultRows.push({ kind: "day", date: t.date });
      const li = document.createElement("li");
      li.className =
        "todo-item tag-result" +
        (t.checked ? " done" : "") +
        (t.rolled ? " rolled" : "");
      li.dataset.index = index;
      const date = document.createElement("span");
      date.className = "tag-result-date";
      date.textContent = t.date;
      li.appendChild(date);
      const label = document.createElement("span");
      label.className = "label";
      fillTodoLabel(label, t.text, t.tags);
      li.appendChild(label);
      li.addEventListener("click", (e) => {
        if (e.target.closest(".tag-chip")) return;
        openTagResult(index);
      });
      listEl.appendChild(li);
    });
  }

  if (result.ideas.length) {
    const h = document.createElement("li");
    h.className = "tag-section";
    h.textContent = "Ideas";
    listEl.appendChild(h);
    result.ideas.forEach((idea) => {
      const index = tagResultRows.length;
      tagResultRows.push({ kind: "idea", slug: idea.slug });
      const li = document.createElement("li");
      li.className = "todo-item idea-row tag-result";
      li.dataset.index = index;
      const em = document.createElement("span");
      em.className = "idea-emoji";
      em.textContent = idea.emoji;
      li.appendChild(em);
      const label = document.createElement("span");
      label.className = "label";
      const txt = document.createElement("span");
      txt.className = "label-text";
      txt.textContent = idea.title;
      label.appendChild(txt);
      appendTagChips(label, idea.tags);
      li.appendChild(label);
      li.addEventListener("click", (e) => {
        if (e.target.closest(".tag-chip")) return;
        openTagResult(index);
      });
      listEl.appendChild(li);
    });
  }

  // Keep the cursor in range across re-renders (e.g. flipping Any/All).
  if (selectedIndex === null) selectedIndex = 0;
  else if (selectedIndex >= tagResultRows.length)
    selectedIndex = tagResultRows.length - 1;
  applySelection();

  updateHints();
}

// Open the result row at `index` — a day for a todo, the detail for an idea.
function openTagResult(index) {
  const row = tagResultRows[index];
  if (!row) return;
  if (row.kind === "idea") openIdeaFromFilter(row.slug);
  else jumpToDay(row.date);
}

async function toggle(index) {
  editingIndex = null;
  pendingDeleteIndex = null;
  const data = await invoke("toggle_task", { date: current, index });
  const nowChecked = !!(data.items[index] && data.items[index].checked);
  render(data, { kind: "toggle", index, nowChecked });
  // Reward for clearing the day: checking off the final open task.
  if (nowChecked && data.items.length > 0 && data.items.every((it) => it.checked)) {
    const row = listEl.querySelector(`.todo-item[data-index="${index}"]`);
    if (row) celebrate(row.querySelector(".check"));
  }
}

async function remove(index) {
  editingIndex = null;
  // Play the row out before the backend delete + re-render closes the gap.
  const row = listEl.querySelector(`.todo-item[data-index="${index}"]`);
  if (row && !reduceMotion.matches) await animateRowOut(row);
  pendingDeleteIndex = null;
  render(await invoke("delete_task", { date: current, index }));
}

// Inline delete confirmation, shown on the row itself (see render). The trash
// icon and the Delete key both arm it; Delete/Esc (or the buttons) decide.
function requestDelete(index) {
  if (viewIsPast) return; // past days are review-only
  selectedIndex = index; // keep the cursor on the row being confirmed
  pendingDeleteIndex = index;
  render(lastData);
}

function cancelPendingDelete() {
  if (pendingDeleteIndex === null) return;
  const idx = pendingDeleteIndex;
  pendingDeleteIndex = null;
  if (mode === "ideas") {
    renderIdeas(ideas);
  } else {
    render(lastData);
  }
}

function confirmPendingDelete() {
  if (pendingDeleteIndex === null) return;
  const idx = pendingDeleteIndex;
  if (mode === "ideas") {
    deleteIdea(idx);
  } else {
    remove(idx);
  }
}

// --- drag & drop reordering (pointer-based; reliable inside WKWebView) ---
function onRowPointerDown(e) {
  if (e.button !== 0) return; // left button / primary touch only
  // Don't start a drag from an interactive control (checkbox / edit / delete)
  // or from a tag chip (which navigates to the filter view on click).
  if (e.target.closest("button, input, .tag-chip")) return;
  if (viewIsPast || editingIndex !== null) return;
  dragState = {
    row: e.currentTarget,
    startX: e.clientX,
    startY: e.clientY,
    active: false,
  };
  document.addEventListener("pointermove", onDocPointerMove);
  document.addEventListener("pointerup", onDocPointerUp);
}

function onDocPointerMove(e) {
  if (!dragState) return;
  if (!dragState.active) {
    // Only begin dragging once the pointer has moved past a small threshold,
    // so a plain click still behaves like a click.
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (Math.hypot(dx, dy) < 5) return;
    dragState.active = true;
    dragState.row.classList.add("dragging");
  }
  e.preventDefault();
  const after = elementAfter(e.clientY);
  if (after == null) listEl.appendChild(dragState.row);
  else if (after !== dragState.row) listEl.insertBefore(dragState.row, after);
}

async function onDocPointerUp() {
  document.removeEventListener("pointermove", onDocPointerMove);
  document.removeEventListener("pointerup", onDocPointerUp);
  const st = dragState;
  dragState = null;
  if (!st || !st.active) return; // it was a click, not a drag
  st.row.classList.remove("dragging");
  selectedIndex = null;
  const order = [...listEl.children].map((c) => Number(c.dataset.index));
  render(await invoke("reorder_task", { date: current, order }));
}

function elementAfter(y) {
  const rows = [...listEl.querySelectorAll(".todo-item:not(.dragging)")];
  let closest = null;
  let closestOffset = -Infinity;
  for (const row of rows) {
    const box = row.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closestOffset) {
      closestOffset = offset;
      closest = row;
    }
  }
  return closest;
}

async function add() {
  const text = inputEl.value.trim();
  if (!text) return;
  console.log("[ui] add: mode=", mode, "text=", text);
  if (mode === "ideas") {
    inputEl.value = "";
    await addIdea(text);
  } else {
    inputEl.value = "";
    editingIndex = null;
    pendingDeleteIndex = null;
    const data = await invoke("add_task", { date: current, text });
    await refreshTags();
    // Like adding an idea: open the new task's detail view so its description
    // and tags can be filled in right away. The new task is appended last.
    lastData = data;
    current = data.date;
    viewIsPast = data.is_past;
    const newIndex = data.items.length - 1;
    selectedIndex = newIndex;
    if (newIndex >= 0) {
      renderTodoDetail(newIndex);
    } else {
      renderTodo(data, { kind: "add" });
    }
  }
  console.log("[ui] add: done");
}

// --- events ---
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    add();
  } else if (e.key === "Escape") {
    // Cancel: clear the text and drop focus.
    e.stopPropagation();
    inputEl.value = "";
    inputEl.blur();
  }
});
// Dim the list while the add box is focused so the composer stands out; the
// highlighted row stays highlighted underneath. Hints switch to "add" mode.
inputEl.addEventListener("focus", () => {
  document.body.classList.add("composing");
  updateHints();
});
inputEl.addEventListener("blur", () => {
  document.body.classList.remove("composing");
  updateHints();
});

attachTagAutocomplete(inputEl);

prevBtn.addEventListener("click", () => goTo(addDays(current, -1), -1));
nextBtn.addEventListener("click", () => goTo(addDays(current, 1), 1));
todayBtn.addEventListener("click", goToday);

document.addEventListener("keydown", (e) => {
  // Settings view: Space/Enter toggles the tag-order setting, Escape leaves.
  if (settingsView) {
    if (e.key === "Escape") {
      e.preventDefault();
      exitSettings();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSettings(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSettings(-1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activateSettings();
    }
    return;
  }

  // The browsable Tags view: arrows move the cursor, Space checks/unchecks the
  // cursor tag for multi-select, Enter shows the checked set (or the cursor tag
  // if none are checked). Escape clears the selection if any tags are checked,
  // otherwise leaves the tag flow. Everything else swallowed.
  if (tagListView) {
    const items = sortedTags();
    const n = items.length;
    if (e.key === "Escape") {
      e.preventDefault();
      if (selectedTags.length) {
        selectedTags = [];
        renderTagList();
      } else {
        exitTagView();
      }
    } else if (n > 0 && e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = selectedIndex === null ? 0 : (selectedIndex + 1) % n;
      applySelection();
    } else if (n > 0 && e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex =
        selectedIndex === null ? n - 1 : (selectedIndex - 1 + n) % n;
      applySelection();
    } else if (n > 0 && e.key === " " && selectedIndex !== null) {
      e.preventDefault();
      toggleTagSelection(items[selectedIndex]);
    } else if (n > 0 && e.key === "Enter") {
      e.preventDefault();
      if (selectedTags.length) showSelectedTags();
      else if (selectedIndex !== null) openTagFilter(items[selectedIndex]);
    }
    return;
  }

  // The tag results view: arrows move the cursor over result rows, Enter opens
  // the selected one, Escape backs out (to the Tags view or the origin), Tab
  // flips a multi-tag query between ANY and ALL. Other keys are swallowed so
  // nothing navigates underneath it.
  if (activeTag) {
    const n = tagResultRows.length;
    if (e.key === "Escape") {
      e.preventDefault();
      clearTagFilter();
    } else if (e.key === "Tab" && activeTags.length > 1) {
      e.preventDefault();
      setTagMatchAll(!tagMatchAll);
    } else if (n > 0 && e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = selectedIndex === null ? 0 : (selectedIndex + 1) % n;
      applySelection();
    } else if (n > 0 && e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex =
        selectedIndex === null ? n - 1 : (selectedIndex - 1 + n) % n;
      applySelection();
    } else if (n > 0 && e.key === "Enter" && selectedIndex !== null) {
      e.preventDefault();
      openTagResult(selectedIndex);
    }
    return;
  }

  // Option+I: from todo, open ideas. From ideas, no-op (use Option+Menu T).
  if (e.altKey && e.code === "KeyI" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    console.log("[ui] key: Option+I, mode=", mode, "ideaDetailSlug=", ideaDetailSlug);
    hideEmojiPicker();
    if (mode === "ideas" && ideaDetailSlug) {
      console.log("[ui] key: Option+I in detail view, going to ideas list");
      switchMode("ideas");
    } else if (mode !== "ideas") {
      console.log("[ui] key: Option+I opening ideas");
      switchMode("ideas");
    }
    return;
  }

  // Escape in idea detail -> back to idea list
  if (mode === "ideas" && ideaDetailSlug && e.key === "Escape") {
    e.preventDefault();
    console.log("[ui] key: Escape in idea detail, going back to ideas list");
    switchMode("ideas");
    return;
  }

  // While a row's inline delete confirmation is showing it captures the
  // keyboard: Delete/Backspace confirms, Escape cancels, everything else
  // (including Enter) is swallowed so nothing acts on the row mid-decision.
  if (pendingDeleteIndex !== null) {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      confirmPendingDelete();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelPendingDelete();
    }
    return;
  }

  // Option (⌥) held: show the option menu in the hint bar.
  // While held, pressing a command key (e.g. T for Today) executes it.
  if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    const tag = document.activeElement && document.activeElement.tagName;
    const inField = tag === "INPUT" || tag === "TEXTAREA";
    if (!inField && editingIndex === null) {
      e.preventDefault();
      showOptionMenu();
      const cmd = COMMANDS.find(
        (c) => e.code === "Key" + c.key && c.modes.includes(mode)
      );
      if (cmd) {
        console.log("[ui] key: Option+" + cmd.key + " (" + cmd.label + ") in mode " + mode);
        cmd.action();
      }
    }
    return;
  }

  const tag = document.activeElement && document.activeElement.tagName;
  const inField = tag === "INPUT" || tag === "TEXTAREA";

  // --- Idea detail view keyboard ---
  if (mode === "ideas" && ideaDetailSlug) {
    if (e.key === "Escape") {
      e.preventDefault();
      // Grab current values from the DOM before saving
      const ti = document.querySelector(".detail-title-input");
      const ta = document.querySelector(".detail-textarea");
      const slug = ideaDetailSlug;
      const title = ti ? ti.value.trim() : "";
      const desc = ta ? ta.value : "";
      // In the detail view, grab the current idea slug and save everything
      // in one call so slug changes are handled atomically.
      const detail = document.querySelector(".idea-detail");
      const emojiBtn = detail && detail.querySelector(".detail-emoji");
      const emoji = emojiBtn ? emojiBtn.textContent.trim() : null;
      const args = { slug };
      if (title) args.title = title;
      if (desc) args.description = desc;
      invoke("edit_idea", args).then(() => switchMode("ideas"));
    }
    return;
  }

  // --- Todo detail view keyboard ---
  if (mode === "todo" && todoDetailIndex !== null) {
    if (e.key === "Escape") {
      e.preventDefault();
      // The title/description fields save + close on their own Esc (and stop
      // propagation). Reaching here means focus was elsewhere (e.g. the tag
      // box), where each field's blur has already persisted — just close.
      closeTodoDetail(todoDetailIndex);
    }
    return;
  }

  // --- Idea list view keyboard ---
  if (mode === "ideas") {
    const n = ideas.length;
    if (inField && tag === "INPUT") {
      // In the add input — handled by its own events
      return;
    }
    // Esc backs out of the Ideas module to the previous one (normally Todo).
    if (e.key === "Escape") {
      e.preventDefault();
      switchMode(previousMode === "ideas" ? "todo" : previousMode);
      return;
    }
    if (n > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = selectedIndex === null ? 0 : (selectedIndex + 1) % n;
        applySelection();
        updateHints();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex =
          selectedIndex === null ? n - 1 : (selectedIndex - 1 + n) % n;
        applySelection();
        updateHints();
        return;
      }
      if (e.key === "Enter" && selectedIndex !== null) {
        e.preventDefault();
        const idea = ideas[selectedIndex];
        console.log("[ui] key: Enter on idea index=", selectedIndex, "slug=", idea && idea.slug);
        if (idea) renderIdeaDetail(idea.slug);
        return;
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIndex !== null
      ) {
        e.preventDefault();
        console.log("[ui] key: Delete on idea index=", selectedIndex);
        requestDeleteIdea(selectedIndex);
        return;
      }
    }
    // Start typing to add an idea
    if (e.metaKey || e.ctrlKey || e.key.length !== 1) return;
    if (inField) return;
    e.preventDefault();
    inputEl.value += e.key;
    inputEl.focus();
    return;
  }

  // --- Todo mode keyboard (original logic) ---
  // Keyboard list navigation (only when not typing in a field or mid-edit).
  // The cursor is always on a row when the list is non-empty; movement and
  // reordering wrap around at the ends.
  //   ↑ / ↓        -> move the cursor (wraps)
  //   ⇧↑ / ⇧↓      -> move the highlighted task (wraps, today/future only)
  //   ← / →        -> change the viewed day (±1 day)
  //   ⇧← / ⇧→      -> jump a week (±7 days)
  //   Space        -> toggle done / not-done
  //   Enter        -> edit the highlighted row
  //   Delete/⌫     -> delete the highlighted row
  if (!inField && editingIndex === null) {
    const n = lastData ? lastData.items.length : 0;
    // Shift modifies the arrows: Up/Down reorders the highlighted task,
    // Left/Right jumps a whole week. Checked before the plain arrows so the
    // modifier wins.
    if (e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      moveRow(e.key === "ArrowUp" ? -1 : 1);
      return;
    }
    if (e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      const back = e.key === "ArrowLeft";
      if (current) goTo(addDays(current, back ? -7 : 7), back ? -1 : 1);
      return;
    }
    // Left / right change the viewed day.
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (current) goTo(addDays(current, -1), -1);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (current) goTo(addDays(current, 1), 1);
      return;
    }
    if (e.key === "ArrowDown" && n > 0) {
      e.preventDefault();
      selectedIndex = selectedIndex === null ? 0 : (selectedIndex + 1) % n;
      applySelection();
      return;
    }
    if (e.key === "ArrowUp" && n > 0) {
      e.preventDefault();
      selectedIndex =
        selectedIndex === null ? n - 1 : (selectedIndex - 1 + n) % n;
      applySelection();
      return;
    }
    if (e.key === " " && selectedIndex !== null) {
      // Space toggles the highlighted task done / not-done (never types into
      // the add box during list navigation). Past days are review-only.
      e.preventDefault();
      if (!viewIsPast) toggle(selectedIndex);
      return;
    }
    if (e.key === "Enter" && selectedIndex !== null) {
      e.preventDefault();
      if (!viewIsPast) renderTodoDetail(selectedIndex);
      return;
    }
    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      selectedIndex !== null
    ) {
      e.preventDefault();
      requestDelete(selectedIndex);
      return;
    }
  }

  // Start typing anywhere (not while editing / in a field) to fill the add
  // box — only on today / future days where adding is allowed.
  if (e.metaKey || e.ctrlKey || e.key.length !== 1) return;
  if (viewIsPast) return;
  if (inField) return;
  // Keep the row highlighted while typing; focusing the add box dims the list
  // (see the input focus handler) so the composer stands out.
  e.preventDefault();
  inputEl.value += e.key;
  inputEl.focus();
});

// Release Option (⌥) hides the option menu.
document.addEventListener("keyup", (e) => {
  if (e.key === "Alt" && optionMenuActive) {
    hideOptionMenu();
  }
});

loadSettings();
refreshTags();
goToday();
