const { invoke } = window.__TAURI__.core;

const weekdayEl = document.getElementById("weekday");
const dateEl = document.getElementById("date");
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const inputEl = document.getElementById("input");
const composerEl = document.getElementById("composer");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const todayBtn = document.getElementById("todayBtn");
const confirmEl = document.getElementById("confirm");
const confirmTextEl = document.getElementById("confirmText");
const confirmOkBtn = document.getElementById("confirmOk");
const confirmCancelBtn = document.getElementById("confirmCancel");

const CHECK_SVG =
  '<svg viewBox="0 0 24 24"><polyline points="4 12 10 18 20 6" /></svg>';
const PENCIL_SVG =
  '<svg viewBox="0 0 24 24"><path d="M4 20h4L18.5 9.5l-4-4L4 16v4z" /><path d="M14.5 5.5l4 4" /></svg>';
const TRASH_SVG =
  '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M6.5 7l1 13h9l1-13" /></svg>';

// View state.
let current = null; // YYYY-MM-DD of the viewed day
let viewIsPast = false; // whether the viewed day is before today
let lastData = null; // most recent DayData (for re-render on edit)
let editingIndex = null; // index currently being edited inline, or null
let cancelEdit = false; // set when an edit is aborted via Escape
let dragState = null; // active pointer-drag state, or null
let selectedIndex = null; // keyboard-highlighted row, or null
let confirmResolver = null; // resolves the open confirm dialog, or null

// --- date helpers (local, no timezone drift) ---
function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const p = (v) => String(v).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function render(data) {
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
    return;
  }
  emptyEl.hidden = true;

  // Keep the highlight in range if the list shrank.
  if (selectedIndex !== null && selectedIndex >= data.items.length) {
    selectedIndex = data.items.length - 1;
  }

  let editInputRef = null;

  data.items.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "todo-item" + (item.checked ? " done" : "");
    li.dataset.index = index;
    if (index === selectedIndex) li.classList.add("selected");
    // Rows can be dragged to reorder — but not on past days, and not while an
    // inline edit is open.
    if (!data.is_past && editingIndex === null) {
      li.classList.add("reorderable");
      li.addEventListener("pointerdown", onRowPointerDown);
    }

    const check = document.createElement("button");
    check.className = "check";
    check.innerHTML = CHECK_SVG;
    check.title = item.checked ? "Mark not done" : "Mark done";
    check.addEventListener("click", () => toggle(index));
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
      label.textContent = item.text;
      li.appendChild(label);

      if (item.carried) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = "carried over";
        li.appendChild(badge);
      }

      // Edit + delete are only offered on today / future days.
      if (!data.is_past) {
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
}

// --- keyboard selection ---
function applySelection() {
  listEl.querySelectorAll(".todo-item").forEach((row) => {
    const on = Number(row.dataset.index) === selectedIndex;
    row.classList.toggle("selected", on);
    if (on) row.scrollIntoView({ block: "nearest" });
  });
}

// --- actions ---
async function goToday() {
  editingIndex = null;
  selectedIndex = null;
  inputEl.blur();
  render(await invoke("get_today"));
}

async function goTo(iso) {
  editingIndex = null;
  selectedIndex = null;
  inputEl.blur();
  render(await invoke("get_day", { date: iso }));
}

async function toggle(index) {
  editingIndex = null;
  render(await invoke("toggle_task", { date: current, index }));
}

async function remove(index) {
  editingIndex = null;
  render(await invoke("delete_task", { date: current, index }));
}

// Confirmation dialog shared by the trash icon and the Delete key.
function openConfirm(message) {
  confirmTextEl.textContent = message;
  confirmEl.hidden = false;
  confirmOkBtn.focus();
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function closeConfirm(result) {
  confirmEl.hidden = true;
  const resolve = confirmResolver;
  confirmResolver = null;
  if (resolve) resolve(result);
}

async function requestDelete(index) {
  if (viewIsPast) return; // past days are review-only
  const item = lastData && lastData.items[index];
  const message = item
    ? `Delete “${item.text}”?`
    : "Delete this task?";
  const ok = await openConfirm(message);
  if (ok) remove(index);
}

function startEdit(index) {
  editingIndex = index;
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
  inputEl.value = "";
  editingIndex = null;
  selectedIndex = null;
  render(await invoke("add_task", { date: current, text }));
  inputEl.focus();
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
prevBtn.addEventListener("click", () => goTo(addDays(current, -1)));
nextBtn.addEventListener("click", () => goTo(addDays(current, 1)));
todayBtn.addEventListener("click", goToday);

confirmOkBtn.addEventListener("click", () => closeConfirm(true));
confirmCancelBtn.addEventListener("click", () => closeConfirm(false));
confirmEl.addEventListener("pointerdown", (e) => {
  if (e.target === confirmEl) closeConfirm(false); // click outside the card
});

document.addEventListener("keydown", (e) => {
  // While the confirm dialog is open it captures the keyboard: Enter confirms,
  // Escape cancels, everything else is swallowed.
  if (confirmResolver !== null) {
    if (e.key === "Enter") {
      e.preventDefault();
      closeConfirm(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeConfirm(false);
    }
    return;
  }

  // Option (⌥) shortcut: H = jump to today.
  if (e.altKey) {
    if (e.code === "KeyH") {
      e.preventDefault();
      goToday();
    }
    return;
  }

  const tag = document.activeElement && document.activeElement.tagName;
  const inField = tag === "INPUT" || tag === "TEXTAREA";

  // Keyboard list navigation (only when not typing in a field or mid-edit):
  //   Down  -> next row (first row if nothing selected yet)
  //   Up    -> previous row (last row if nothing selected yet)
  //   Enter -> edit the highlighted row
  //   Esc   -> cancel the navigation / clear the highlight
  if (!inField && editingIndex === null) {
    const n = lastData ? lastData.items.length : 0;
    // Left / right change the viewed day.
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (current) goTo(addDays(current, -1));
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (current) goTo(addDays(current, 1));
      return;
    }
    if (e.key === "ArrowDown" && n > 0) {
      e.preventDefault();
      selectedIndex =
        selectedIndex === null ? 0 : Math.min(n - 1, selectedIndex + 1);
      applySelection();
      return;
    }
    if (e.key === "ArrowUp" && n > 0) {
      e.preventDefault();
      selectedIndex =
        selectedIndex === null ? n - 1 : Math.max(0, selectedIndex - 1);
      applySelection();
      return;
    }
    if (e.key === " " && selectedIndex !== null) {
      // Space toggles the highlighted task done / not-done (never types into
      // the add box during list navigation).
      e.preventDefault();
      toggle(selectedIndex);
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
    if (e.key === "Escape" && selectedIndex !== null) {
      e.preventDefault();
      selectedIndex = null;
      applySelection();
      return;
    }
  }

  // Start typing anywhere (not while editing / in a field) to fill the add
  // box — only on today / future days where adding is allowed.
  if (e.metaKey || e.ctrlKey || e.key.length !== 1) return;
  if (viewIsPast) return;
  if (inField) return;
  // Typing starts a new task, so drop any row highlight.
  if (selectedIndex !== null) {
    selectedIndex = null;
    applySelection();
  }
  e.preventDefault();
  inputEl.value += e.key;
  inputEl.focus();
});

goToday();
