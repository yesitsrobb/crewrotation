/* RezCafe Volunteer Tracker (MVP)
   - Names only
   - Sundays list
   - Weeks since last served (counted in Sundays)
   - LocalStorage persistence
*/

const STORAGE_KEY = "rezcafe_volunteer_tracker_v1";

const els = {
  addVolunteerForm: document.getElementById("addVolunteerForm"),
  volunteerName: document.getElementById("volunteerName"),
  volunteerList: document.getElementById("volunteerList"),

  currentSunday: document.getElementById("currentSunday"),
  selectedSunday: document.getElementById("selectedSunday"),
  servedChecklist: document.getElementById("servedChecklist"),

  btnPrevSundays: document.getElementById("btnPrevSundays"),
  btnNextSundays: document.getElementById("btnNextSundays"),

  btnExport: document.getElementById("btnExport"),
  fileImport: document.getElementById("fileImport"),
  btnReset: document.getElementById("btnReset"),
};

function uuid() {
  // good enough for this MVP
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}

// --- Date helpers (all Sundays are stored as YYYY-MM-DD in local time) ---
function toISODateLocal(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseISODateLocal(iso) {
  // Create as local midnight
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isSunday(d) {
  return d.getDay() === 0;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function nearestSunday(d) {
  // If today is Sunday, return today. Otherwise return the most recent Sunday.
  const dd = startOfDay(d);
  const day = dd.getDay(); // 0=Sun
  const diff = day; // how many days since Sunday
  dd.setDate(dd.getDate() - diff);
  return dd;
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function formatSunday(iso) {
  const d = parseISODateLocal(iso);
  // Simple readable format like "Sun Feb 22, 2026"
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

// --- State ---
function defaultState() {
  const today = new Date();
  const current = nearestSunday(today); // most recent Sunday
  // build an initial range: 8 past Sundays + current + 4 future (13 total)
  const sundays = [];
  for (let i = -8; i <= 4; i++) {
    const s = addDays(current, i * 7);
    sundays.push(toISODateLocal(s));
  }

  return {
    volunteers: [
      // sample empty; you can add your own
    ],
    sundays,
    currentSunday: toISODateLocal(current),
    selectedSunday: toISODateLocal(current),
    // servedBySunday: { "YYYY-MM-DD": ["volunteerId", ...] }
    servedBySunday: {},
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);

    // light validation / migration
    if (!parsed.sundays || !Array.isArray(parsed.sundays)) return defaultState();
    if (!parsed.volunteers || !Array.isArray(parsed.volunteers)) parsed.volunteers = [];
    if (!parsed.servedBySunday || typeof parsed.servedBySunday !== "object") parsed.servedBySunday = {};

    // ensure current/selected are in list
    if (!parsed.currentSunday) parsed.currentSunday = parsed.sundays[Math.max(0, parsed.sundays.length - 5)] || parsed.sundays[0];
    if (!parsed.selectedSunday) parsed.selectedSunday = parsed.currentSunday;

    if (!parsed.sundays.includes(parsed.currentSunday)) parsed.sundays.push(parsed.currentSunday);
    if (!parsed.sundays.includes(parsed.selectedSunday)) parsed.sundays.push(parsed.selectedSunday);

    parsed.sundays = dedupeSortSundays(parsed.sundays);
    return parsed;
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function dedupeSortSundays(list) {
  const uniq = Array.from(new Set(list));
  // Keep only valid-ish ISO dates; also ensure they’re Sundays if possible
  const filtered = uniq.filter((iso) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const d = parseISODateLocal(iso);
    return isSunday(d);
  });
  filtered.sort((a, b) => parseISODateLocal(a) - parseISODateLocal(b));
  return filtered;
}

let state = loadState();

// --- Core: weeks since last served (count Sundays) ---
function lastServedSundayForVolunteer(volunteerId) {
  // Find most recent Sunday (<= currentSunday) where volunteerId is in served list
  const cur = state.currentSunday;
  const sundaysUpToCurrent = state.sundays.filter((s) => s <= cur); // ISO strings compare lexicographically
  for (let i = sundaysUpToCurrent.length - 1; i >= 0; i--) {
    const sunday = sundaysUpToCurrent[i];
    const served = state.servedBySunday[sunday] || [];
    if (served.includes(volunteerId)) return sunday;
  }
  return null;
}

function weeksSinceSunday(lastSundayIso, currentSundayIso) {
  if (!lastSundayIso) return null;
  // count how many Sundays between last and current (exclusive of last, inclusive of current)
  // Example: last = current => 0
  // last one week ago => 1
  const lastIndex = state.sundays.indexOf(lastSundayIso);
  const curIndex = state.sundays.indexOf(currentSundayIso);

  if (lastIndex === -1 || curIndex === -1) {
    // fallback to date math (still Sundays)
    const a = parseISODateLocal(lastSundayIso);
    const b = parseISODateLocal(currentSundayIso);
    const ms = b - a;
    return Math.max(0, Math.round(ms / (7 * 24 * 60 * 60 * 1000)));
  }

  return Math.max(0, curIndex - lastIndex);
}

// --- Rendering ---
function renderSundaySelects() {
  const optionsHtml = state.sundays
    .map((iso) => `<option value="${iso}">${formatSunday(iso)}</option>`)
    .join("");

  els.currentSunday.innerHTML = optionsHtml;
  els.selectedSunday.innerHTML = optionsHtml;

  els.currentSunday.value = state.currentSunday;
  els.selectedSunday.value = state.selectedSunday;
}

function renderVolunteers() {
  const cur = state.currentSunday;

  // Sort by "weeks since" descending, with "Never" at top (optional but helpful).
  const enriched = state.volunteers.map((v) => {
    const last = lastServedSundayForVolunteer(v.id);
    const weeks = last ? weeksSinceSunday(last, cur) : null;
    return { ...v, last, weeks };
  });

  enriched.sort((a, b) => {
    // Never first
    if (a.weeks === null && b.weeks !== null) return -1;
    if (a.weeks !== null && b.weeks === null) return 1;
    // Higher weeks first
    if (a.weeks !== null && b.weeks !== null) return b.weeks - a.weeks;
    // tie-breaker alphabetical
    return a.name.localeCompare(b.name);
  });

  els.volunteerList.innerHTML = enriched
    .map((v) => {
      const weeksLabel = v.weeks === null ? "Never" : String(v.weeks);
      return `
        <div class="table-row">
          <div>${escapeHtml(v.name)}</div>
          <div class="right">${weeksLabel}</div>
          <div class="right">
            <button class="btn btn-secondary" data-action="rename" data-id="${v.id}">Rename</button>
            <button class="btn btn-danger" data-action="remove" data-id="${v.id}">Remove</button>
          </div>
        </div>
      `;
    })
    .join("") || `<div class="table-row"><div class="muted">No volunteers yet.</div><div></div><div></div></div>`;
}

function renderChecklist() {
  const sunday = state.selectedSunday;
  const served = new Set(state.servedBySunday[sunday] || []);

  // Keep checklist in alphabetical order for usability
  const volunteersSorted = [...state.volunteers].sort((a, b) => a.name.localeCompare(b.name));

  els.servedChecklist.innerHTML = volunteersSorted
    .map((v) => {
      const checked = served.has(v.id) ? "checked" : "";
      return `
        <div class="check">
          <label>
            <input type="checkbox" data-volunteer-id="${v.id}" ${checked}/>
            <span>${escapeHtml(v.name)}</span>
          </label>
          <span class="pill">${checked ? "Served" : "Not served"}</span>
        </div>
      `;
    })
    .join("") || `<div class="muted">Add volunteers to start assigning.</div>`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function rerenderAll() {
  state.sundays = dedupeSortSundays(state.sundays);
  // ensure current/selected in list
  if (!state.sundays.includes(state.currentSunday)) state.sundays.push(state.currentSunday);
  if (!state.sundays.includes(state.selectedSunday)) state.sundays.push(state.selectedSunday);
  state.sundays = dedupeSortSundays(state.sundays);

  renderSundaySelects();
  renderChecklist();
  renderVolunteers();
  saveState();
}

// --- Sunday list management ---
function extendPast(count) {
  // add count past Sundays before earliest
  const first = parseISODateLocal(state.sundays[0]);
  for (let i = 1; i <= count; i++) {
    const iso = toISODateLocal(addDays(first, -7 * i));
    state.sundays.push(iso);
  }
  state.sundays = dedupeSortSundays(state.sundays);
}

function extendFuture(count) {
  const last = parseISODateLocal(state.sundays[state.sundays.length - 1]);
  for (let i = 1; i <= count; i++) {
    const iso = toISODateLocal(addDays(last, 7 * i));
    state.sundays.push(iso);
  }
  state.sundays = dedupeSortSundays(state.sundays);
}

// --- Events ---
els.addVolunteerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = els.volunteerName.value.trim();
  if (!name) return;

  // prevent exact duplicates (optional)
  const exists = state.volunteers.some((v) => v.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    alert("That name is already in the list.");
    return;
  }

  state.volunteers.push({ id: uuid(), name });
  els.volunteerName.value = "";
  rerenderAll();
});

els.currentSunday.addEventListener("change", (e) => {
  state.currentSunday = e.target.value;
  // If selected is after current, bump selected back to current for consistency
  if (state.selectedSunday > state.currentSunday) state.selectedSunday = state.currentSunday;
  rerenderAll();
});

els.selectedSunday.addEventListener("change", (e) => {
  state.selectedSunday = e.target.value;
  rerenderAll();
});

els.btnPrevSundays.addEventListener("click", () => {
  extendPast(4);
  rerenderAll();
});

els.btnNextSundays.addEventListener("click", () => {
  extendFuture(4);
  rerenderAll();
});

els.servedChecklist.addEventListener("change", (e) => {
  const cb = e.target;
  if (!(cb instanceof HTMLInputElement)) return;
  if (cb.type !== "checkbox") return;

  const volId = cb.getAttribute("data-volunteer-id");
  if (!volId) return;

  const sunday = state.selectedSunday;
  const served = new Set(state.servedBySunday[sunday] || []);

  if (cb.checked) served.add(volId);
  else served.delete(volId);

  state.servedBySunday[sunday] = Array.from(served);
  rerenderAll();
});

els.volunteerList.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.getAttribute("data-action");
  const id = btn.getAttribute("data-id");
  if (!action || !id) return;

  const v = state.volunteers.find((x) => x.id === id);
  if (!v) return;

  if (action === "remove") {
    const ok = confirm(`Remove ${v.name}? This will also remove their served checkmarks.`);
    if (!ok) return;

    state.volunteers = state.volunteers.filter((x) => x.id !== id);
    // remove from servedBySunday
    for (const sunday of Object.keys(state.servedBySunday)) {
      state.servedBySunday[sunday] = (state.servedBySunday[sunday] || []).filter((vid) => vid !== id);
    }
    rerenderAll();
  }

  if (action === "rename") {
    const next = prompt("Rename volunteer:", v.name);
    if (next === null) return;
    const name = next.trim();
    if (!name) return;

    const exists = state.volunteers.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      alert("That name is already in the list.");
      return;
    }

    v.name = name;
    rerenderAll();
  }
});

// Export / Import / Reset
els.btnExport.addEventListener("click", () => {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `rezcafe-volunteer-tracker-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
});

els.fileImport.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    // minimal validation
    if (!imported || !Array.isArray(imported.sundays) || !Array.isArray(imported.volunteers) || typeof imported.servedBySunday !== "object") {
      alert("Invalid import file.");
      return;
    }

    state = imported;
    // normalize
    state.sundays = dedupeSortSundays(state.sundays);
    if (!state.currentSunday) state.currentSunday = state.sundays[state.sundays.length - 1];
    if (!state.selectedSunday) state.selectedSunday = state.currentSunday;

    rerenderAll();
    alert("Imported!");
  } catch {
    alert("Could not import that file.");
  } finally {
    els.fileImport.value = "";
  }
});

els.btnReset.addEventListener("click", () => {
  const ok = confirm("Reset everything? This clears all volunteers and history in this browser.");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  state = defaultState();
  rerenderAll();
});

// initial render
rerenderAll();