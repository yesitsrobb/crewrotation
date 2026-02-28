// RezCafe Sunday Assignments — Step 1 MVP
// - Fixed crew list
// - Choose a Sunday (past + future)
// - Assign crew via checkboxes
// - Persists in localStorage

const STORAGE_KEY = "rezcafe_sunday_assignments_v1";

const CREW = [
  "Debbie C",
  "RJ B",
  "Josiah J",
  "Josiah K",
  "Sarah T",
  "Dan O",
  "Robb R."
];

const sundaySelect = document.getElementById("sundaySelect");
const crewList = document.getElementById("crewList");
const clearBtn = document.getElementById("clearSunday");

function toISODateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODateLocal(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function nearestSunday(today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() - d.getDay()); // 0=Sun
  return d;
}

function formatSunday(iso) {
  const d = parseISODateLocal(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { assignmentsBySunday: {} };
    const parsed = JSON.parse(raw);
    if (!parsed.assignmentsBySunday || typeof parsed.assignmentsBySunday !== "object") {
      return { assignmentsBySunday: {} };
    }
    return parsed;
  } catch {
    return { assignmentsBySunday: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

// Build a simple Sunday list: 12 past Sundays + current + 20 future
function buildSundays() {
  const base = nearestSunday(new Date());
  const sundays = [];
  for (let i = -12; i <= 20; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    sundays.push(toISODateLocal(d));
  }
  return sundays;
}

const SUNDAYS = buildSundays();

function renderSundaySelect() {
  sundaySelect.innerHTML = SUNDAYS
    .map(iso => `<option value="${iso}">${formatSunday(iso)}</option>`)
    .join("");

  // default to current Sunday
  const current = toISODateLocal(nearestSunday(new Date()));
  sundaySelect.value = current;
}

function getAssignedSet(iso) {
  const arr = state.assignmentsBySunday[iso] || [];
  return new Set(arr);
}

function setAssignedSet(iso, set) {
  state.assignmentsBySunday[iso] = Array.from(set);
  saveState();
}

function renderCrew() {
  const iso = sundaySelect.value;
  const assigned = getAssignedSet(iso);

  crewList.innerHTML = CREW.map(name => {
    const checked = assigned.has(name) ? "checked" : "";
    return `
      <div class="crew-item">
        <label>
          <input type="checkbox" data-name="${escapeHtml(name)}" ${checked} />
          <span>${escapeHtml(name)}</span>
        </label>
        <span></span>
      </div>
    `;
  }).join("");
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Events
sundaySelect.addEventListener("change", () => {
  renderCrew();
});

crewList.addEventListener("change", (e) => {
  const cb = e.target;
  if (!(cb instanceof HTMLInputElement) || cb.type !== "checkbox") return;

  const iso = sundaySelect.value;
  const name = cb.getAttribute("data-name");
  if (!name) return;

  const assigned = getAssignedSet(iso);
  if (cb.checked) assigned.add(name);
  else assigned.delete(name);

  setAssignedSet(iso, assigned);
});

clearBtn.addEventListener("click", () => {
  const iso = sundaySelect.value;
  const ok = confirm(`Clear assignments for ${formatSunday(iso)}?`);
  if (!ok) return;

  state.assignmentsBySunday[iso] = [];
  saveState();
  renderCrew();
});

// Init
renderSundaySelect();
renderCrew();
