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
    emojis: "😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗😚😙🥲😋😛😜🤪😝🤑🤗🤭🫢🫣🤫🤔🫡🤐🤨😐😑😶🫥😏😒🙄😬😮‍💨🤥😌😔😪🤤😴😷🤒🤕🤢🤮🤧🥵🥶🥴😵🤯🤠🥳🥸😎🤓🧐😕😟🙁😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈👿💀☠️💩🤡👹👺👻👽👾🤖😺😸😹😻😼😽🙀😿😾".split(""),
  },
  {
    name: "Gestures",
    emojis: "👋🤚🖐✋🖖🫱🫲🫳🫴👌🤌🤏✌️🤞🫰🤟🤘🤙👈👉👆🖕👇☝️🫵👍👎✊👊🤛🤜👏🙌🫶👐🤲🤝🙏✍️💅🤳💪🦵🦶👂🦻👃🧠🫀🫁🦷🦴👀👅👄".split(""),
  },
  {
    name: "Objects",
    emojis: "👓🕶👔👕👖🧣🧤🧥🧦👗👘🥻🩱🩲🩳👙👚🪭👛👜👝🎒🩴👞👟🥾🥿👠👡🩰👢👑👒🎩🎓🧢🪖⛑💄💍💼🩸🔬🔭📡🪀🪁🔮🕹🧸🪅🪩🪆🖼🧿🪬🪧📿💎📯🎯🎮🃏🎴🀄🎲🧩♟🎭🎨🧵🪡🧶🪢".split(""),
  },
  {
    name: "Nature",
    emojis: "🐶🐱🐭🐹🐰🦊🐻🐼🐻‍❄️🐨🐯🦁🐮🐷🐸🐵🙈🙉🙊🐒🐔🐧🐦🐤🐣🐥🦆🦅🦉🦇🐺🐗🐴🦄🐝🪱🐛🦋🐌🐞🐜🪰🪲🪳🦟🦗🕷🕸🦂🐢🐍🦎🦖🦕🐙🦑🦐🦞🦀🐡🐠🐟🐬🐳🐋🦈🪸🐊".split(""),
  },
  {
    name: "Food",
    emojis: "🍏🍎🍐🍊🍋🍌🍉🍇🍓🫐🍈🍒🍑🥭🍍🥥🥝🍅🍆🥑🥦🥬🥒🌶🫑🌽🥕🫒🧄🧅🥔🍠🫘🥐🍞🥖🥨🧀🥚🍳🧈🥞🧇🥓🥩🍗🍖🦴🌭🍔🍟🍕🫓🥪🥙🧆🌮🌯🫔🥗🥘🫕🥫🍝🍜🍲🍛🍣🍱🥟🦪🍤🍙🍚🍘🍥🥠🥮🍢🍡🍧🍨🍦🥧🧁🍰🎂🍮🍭🍬🍫🍿🍩🍪🌰🥜".split(""),
  },
  {
    name: "Activity",
    emojis: "⚽🏀🏈⚾🥎🎾🏐🏉🥏🎱🪀🏓🏸🏒🏑🥍🏏🪃🥅⛳🪁🏹🎣🤿🥊🥋🎽🛹🛼🛷⛸🥌🎿⛷🏂🪂🏋️‍♀️🏋️‍♂️🤼‍♀️🤼‍♂️🤸‍♀️🤸‍♂️⛹️‍♀️⛹️‍♂️🤺🤾‍♀️🤾‍♂️🏌️‍♀️🏌️‍♂️🏇🧘‍♀️🧘‍♂️🏄‍♀️🏄‍♂️🏊‍♀️🏊‍♂️🤽‍♀️🤽‍♂️🚣‍♀️🚣‍♂️🧗‍♀️🧗‍♂️🚵‍♀️🚵‍♂️🚴‍♀️🚴‍♂️".split(""),
  },
  {
    name: "Travel",
    emojis: "🚗🚕🚙🚌🚎🏎🚓🚑🚒🚐🛻🚚🚛🚜🏍🛵🛺🚲🛴🛹🚏🛣🛤⛽🛑🚨🚥🚦🛰🚀🛸🚁🛶⛵🚤🛥🛳⛴🚢🛟🪝✈️🛩🛫🛬🪂💺🗺🧭🏔⛰🌋🗻🏕🏖🏜🏝🏞🏟🏛🏗🧱🪨🪵🏘🏚🏠🏡🏢🏣🏤🏥🏦🏨🏩🏪🏫🏬🏭🏯🏰💒🗼🗽⛪🕌🛕🕍⛩🕋⛲🌄🌅🌆🌇🌉".split(""),
  },
  {
    name: "Symbols",
    emojis: "❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝💟☮✝☪🕉☸✡🔯🕎☯☦🛐⛎♈♉♊♋♌♍♎♏♐♑♒♓🆔⚛🉑☢☣📴📳🈶🈚🈸🈺🈷✴🆚💮🉐㊙㊗🈴🈵🈲🅰🅱🆎🆑🅾🆘🛑⛔📛🚫💢♨🚷🚯🚳🚱🔞📵🚭❗❕❓❔‼⁉💯🔱⚜🔰♻✅🈯💹❇✳❎🌐💠ⓜ🈂🛂🛃🛄🛅🆗🆙🆒🆕🆓🆖🆗🆙🆒🆕🆓🆖".split(""),
  },
];

// --- option-menu commands ------------------------------------------------
// Each entry defines a command shown in the Option (⌥) menu.
//   key:    single letter pressed while ⌥ is held
//   label:  display name in the hint bar
//   action: function to execute
//   modes:  which modes ("todo", "ideas") this command appears in
const COMMANDS = [
  { key: "T", label: "Today", action: goToday, modes: ["todo"], hideOnToday: true },
  { key: "I", label: "Ideas", action: () => switchMode("ideas"), modes: ["todo"] },
  { key: "T", label: "Todo", action: () => switchMode("todo"), modes: ["ideas"] },
];

// View state.
let mode = "todo"; // "todo" | "ideas"
let current = null; // YYYY-MM-DD of the viewed day
let viewIsPast = false; // whether the viewed day is before today
let lastData = null; // most recent DayData (for re-render on edit)
let editingIndex = null; // index currently being edited inline, or null
let cancelEdit = false; // set when an edit is aborted via Escape
let dragState = null; // active pointer-drag state, or null
let selectedIndex = null; // keyboard-highlighted row, or null
let pendingDeleteIndex = null; // row showing inline delete confirmation, or null

// Idea state.
let ideas = []; // list of IdeaListEntry
let ideaDetailSlug = null; // slug of idea being viewed in detail, or null
let ideaDetailDirty = false; // whether detail has unsaved changes
let emojiPickerTarget = null; // { slug, callback } for the active picker

// --- date helpers (local, no timezone drift) ---
function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const p = (v) => String(v).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function render(data, fx = null) {
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

  let editInputRef = null;

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

    if (!data.is_past && editingIndex === index) {
      // Inline edit field.
      const input = document.createElement("input");
      input.className = "edit-input";
      input.type = "text";
      input.value = item.text;
      input.addEventListener("keydown", (ev) => {
        // Keep edit-field keys from reaching the global handler (otherwise the
        // Enter that commits the edit would bubble up and re-open it).
        ev.stopPropagation();
        if (ev.key === "Enter") {
          ev.preventDefault();
          input.blur();
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          cancelEdit = true;
          input.blur();
        }
      });
      input.addEventListener("blur", () => commitEdit(index, input.value));
      li.appendChild(input);
      editInputRef = input;
    } else {
      const label = document.createElement("span");
      label.className = "label";
      const textSpan = document.createElement("span");
      textSpan.className = "label-text";
      textSpan.textContent = item.text;
      label.appendChild(textSpan);
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
        edit.title = "Edit task";
        edit.innerHTML = PENCIL_SVG;
        edit.addEventListener("click", () => startEdit(index));

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

  if (editInputRef) {
    editInputRef.focus();
    editInputRef.select();
  }

  applyFx(fx);
  updateHints();
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

    const emojiBtn = document.createElement("button");
    emojiBtn.className = "idea-emoji";
    emojiBtn.textContent = idea.emoji;
    emojiBtn.title = "Change emoji";
    emojiBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showEmojiPicker(idea.slug, idea.emoji, async (newEmoji) => {
        await editIdea(idea.slug, newEmoji, null, null);
        // Re-render the list to reflect the emoji change
        renderIdeas(ideas);
      });
    });
    li.appendChild(emojiBtn);

    const label = document.createElement("span");
    label.className = "label";
    const textSpan = document.createElement("span");
    textSpan.className = "label-text";
    textSpan.textContent = idea.title;
    label.appendChild(textSpan);
    li.appendChild(label);

    const dateSpan = document.createElement("span");
    dateSpan.className = "idea-date";
    dateSpan.textContent = idea.created;
    li.appendChild(dateSpan);

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
    emojiBtn.className = "idea-emoji detail-emoji";
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
    updateHints();
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
  selectedIndex = 0;
  console.log("[ui] addIdea: invoking add_idea with title=", text);
  ideas = await invoke("add_idea", { title: text });
  console.log("[ui] addIdea: got", ideas.length, "ideas back", ideas.map(i => i.title));
  renderIdeas(ideas);
  console.log("[ui] addIdea: done (blurring input)");
}

async function editIdea(slug, emoji, title, description) {
  console.log("[ui] editIdea: slug=", slug, "emoji=", emoji, "title=", title, "description_len=", description && description.length);
  const args = { slug };
  if (emoji !== null) args.emoji = emoji;
  if (title !== null) args.title = title;
  if (description !== null) args.description = description;
  const result = await invoke("edit_idea", args);
  ideas = result.entries;
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
  hideEmojiPicker();
  editingIndex = null;
  pendingDeleteIndex = null;
  selectedIndex = null;
  ideaDetailSlug = null;
  inputEl.blur();

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

  // Idea detail view hints
  if (mode === "ideas" && ideaDetailSlug) {
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
      statusEl.innerHTML = `<span class="statusbar-track">${hintHTML([["Type", "to add"], ["⌥Menu", "Commands"]])}</span>`;
    } else {
      statusEl.innerHTML = `<span class="statusbar-track">${hintHTML([
        ["↑↓", "Move"],
        ["⏎", "Open"],
        ["⌫", "Delete"],
        ["⌥Menu", "Commands"],
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
      pairs = base.concat([["⌥Menu", "Commands"]]);
    } else if (viewIsPast) {
      pairs = [
        ["↑↓", "Move"],
        ["←→", "Day"],
        ["⇧←→", "Week"],
        ["⌥Menu", "Commands"],
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
        ["⌥Menu", "Commands"],
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

function startEdit(index) {
  editingIndex = index;
  pendingDeleteIndex = null;
  render(lastData);
}

async function commitEdit(index, value) {
  if (editingIndex !== index) return; // already handled
  editingIndex = null;
  if (cancelEdit) {
    cancelEdit = false;
    render(await invoke("get_day", { date: current }));
    return;
  }
  const text = value.trim();
  if (!text) {
    render(await invoke("get_day", { date: current }));
    return;
  }
  render(await invoke("edit_task", { date: current, index, text }));
}

// --- drag & drop reordering (pointer-based; reliable inside WKWebView) ---
function onRowPointerDown(e) {
  if (e.button !== 0) return; // left button / primary touch only
  // Don't start a drag from an interactive control (checkbox / edit / delete).
  if (e.target.closest("button, input")) return;
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
    selectedIndex = null;
    renderTodo(await invoke("add_task", { date: current, text }), { kind: "add" });
    inputEl.focus();
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

prevBtn.addEventListener("click", () => goTo(addDays(current, -1), -1));
nextBtn.addEventListener("click", () => goTo(addDays(current, 1), 1));
todayBtn.addEventListener("click", goToday);

document.addEventListener("keydown", (e) => {
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

  // --- Idea list view keyboard ---
  if (mode === "ideas") {
    const n = ideas.length;
    if (inField && tag === "INPUT") {
      // In the add input — handled by its own events
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
      if (!viewIsPast) startEdit(selectedIndex);
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

goToday();
