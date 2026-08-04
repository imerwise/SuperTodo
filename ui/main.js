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

// View state.
let current = null; // YYYY-MM-DD of the viewed day
let viewIsPast = false; // whether the viewed day is before today
let lastData = null; // most recent DayData (for re-render on edit)
let editingIndex = null; // index currently being edited inline, or null
let cancelEdit = false; // set when an edit is aborted via Escape
let dragState = null; // active pointer-drag state, or null
let selectedIndex = null; // keyboard-highlighted row, or null
let pendingDeleteIndex = null; // row showing inline delete confirmation, or null

// --- date helpers (local, no timezone drift) ---
function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const p = (v) => String(v).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

// `fx` is an optional one-shot animation hint describing the single thing that
// just changed, applied to the freshly-built DOM below:
//   { kind: "add" }                          -> new (last) row springs in
//   { kind: "toggle", index, nowChecked }    -> that row's check pulses / settles
//   { kind: "day", dir: -1 | 1 }             -> the list slides in from dir
function render(data, fx = null) {
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
  const notToday = lastData && !lastData.is_today;
  const html = notToday
    ? '<span style="color:var(--accent);font-weight:700">H</span>ome'
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
  // If force is set, show that content instead of standard hints.
  if (force !== null) {
    statusEl.innerHTML = `<span class="statusbar-track">${force}</span>`;
    measureHintTicker();
    return;
  }

  let pairs;
  if (pendingDeleteIndex !== null) {
    pairs = [["⌫", "Delete"], ["Esc", "Cancel"]];
  } else if (editingIndex !== null) {
    pairs = [["⏎", "Save"], ["Esc", "Cancel"]];
  } else if (document.activeElement === inputEl) {
    pairs = [["⏎", "Add"], ["Esc", "Clear"]];
  } else {
    const n = lastData ? lastData.items.length : 0;
    const notToday = lastData && !lastData.is_today;
    if (n === 0) {
      const base = viewIsPast
        ? [["←→", "Day"], ["⇧←→", "Week"]]
        : [["Type", "to add"], ["←→", "Day"], ["⇧←→", "Week"]];
      if (notToday) base.push(["⌥Menu", "Home"]);
      pairs = base;
    } else if (viewIsPast) {
      pairs = [
        ["↑↓", "Move"],
        ["←→", "Day"],
        ["⇧←→", "Week"],
      ];
      if (notToday) pairs.push(["⌥Menu", "Home"]);
    } else {
      pairs = [
        ["↑↓", "Move"],
        ["Space", "Done"],
        ["⏎", "Edit"],
        ["⇧↑↓", "Reorder"],
        ["⌫", "Delete"],
        ["←→", "Day"],
        ["⇧←→", "Week"],
      ];
      if (notToday) pairs.push(["⌥Menu", "Home"]);
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
  editingIndex = null;
  pendingDeleteIndex = null;
  selectedIndex = null;
  optionMenuActive = false;
  inputEl.blur();
  render(await invoke("get_today"));
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
  pendingDeleteIndex = null;
  render(lastData);
}

function confirmPendingDelete() {
  if (pendingDeleteIndex === null) return;
  remove(pendingDeleteIndex);
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
  inputEl.value = "";
  editingIndex = null;
  pendingDeleteIndex = null;
  selectedIndex = null;
  // New tasks are appended, so the entrance plays on the last row.
  render(await invoke("add_task", { date: current, text }), { kind: "add" });
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
  // While held, pressing a command key (e.g. H) executes it immediately.
  if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    const tag = document.activeElement && document.activeElement.tagName;
    const inField = tag === "INPUT" || tag === "TEXTAREA";
    if (!inField && editingIndex === null) {
      e.preventDefault();
      showOptionMenu();
      // Check for command keys pressed while Option is held.
      if (e.code === "KeyH") {
        goToday();
      }
    }
    return;
  }

  const tag = document.activeElement && document.activeElement.tagName;
  const inField = tag === "INPUT" || tag === "TEXTAREA";

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
