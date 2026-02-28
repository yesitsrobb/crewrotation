// RezCafe Sunday Assignments — 9 Sundays at once
// 4 previous Sundays • upcoming Sunday • 4 future Sundays
// Persisted in localStorage

const STORAGE_KEY = "rezcafe_sunday_assignments_v2";

// Fixed crew list (your list)
const CREW = [
  "Debbie C",
  "RJ B",
  "Josiah J",
  "Josiah K",
  "Sarah T",
  "Dan O",
  "Robb R."
];

const els = {
  grid: document.getElementById("grid"),
  rangeLabel: document.getElementById("rangeLabel"),
  btnPrev: document.getElementById("btnPrev"),
  btnToday: document.getElementById("btnToday"),
  btnNext: document.getElementById("btnNext"),
  btnClearAll: document.getElementById("btnClearAll"),
};

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
function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function formatSundayShort(iso) {
  const d = parseISODateLocal(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function formatSundayLong(iso) {
  const d = parseISODateLocal(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function isSunday(d) {
  return d.getDay() === 0;
}

// Upcoming Sunday = next Sunday from today.
// If today is Sunday, "upcoming" is today.
function upcomingSunday(today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const day = d.getDay(); // 0=Sun
  const daysUntilSunday = (7 - day) % 7; // 0 if Sunday
  const up = addDays(d, daysUntilSunday);
  return up;
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

// Window center (upcoming Sunday ISO)
let centerSundayISO = toISODateLocal(upcomingSunday(new Date()));

function buildWindow(centerIso) {
  const center = parseISODateLocal(centerIso);
  if (!isSunday(center)) {
    // safety: force to upcoming Sunday if bad input
    centerSundayISO = toISODateLocal(upcomingSunday(new Date()));
  }
  const list = [];
  for (let i = -4; i <= 4; i++) {
    const d = addDays(parseISODateLocal(centerIso), i * 7);
    list.push(toISODateLocal(d));
  }
  return list;
}

function getAssignedSet(iso) {
  const arr = state.assignmentsBySunday[iso] || [];
  return new Set(arr);
}
function setAssignedSet(iso, set) {
  state.assignmentsBySunday[iso] = Array.from(set);
  saveState();
}

function render() {
  const sundays = buildWindow(centerSundayISO);
  const upcomingIso = centerSundayISO;

  els.rangeLabel.textContent =
    `${formatSundayLong(sundays[0])}  →  ${formatSundayLong(sundays[sundays.length - 1])} (center: ${formatSundayLong(upcomingIso)})`;

  // Build table HTML
  const thead = `
    <thead>
      <tr>
        <th style="text-align:left;min-width:180px;">Volunteer</th>
        ${sundays.map(iso => {
          const cls = iso === upcomingIso ? "upcoming" : "";
          return `<th class="${cls}">${formatSundayShort(iso)}<div style="font-weight:600;color:rgba(230,237,243,.85);margin-top:2px;">${iso === upcomingIso ? "upcoming" : ""}</div></th>`;
        }).join("")}
      </tr>
    </thead>
  `;

  const tbodyRows = CREW.map(name => {
    const cells = sundays.map(iso => {
      const assigned = getAssignedSet(iso);
      const checked = assigned.has(name) ? "checked" : "";
      return `
        <td class="cell">
          <input type="checkbox"
                 data-iso="${iso}"
                 data-name="${escapeHtml(name)}"
                 ${checked} />
        </td>
      `;
    }).join("");

    return `
      <tr>
        <td class="name">${escapeHtml(name)}</td>
        ${cells}
      </tr>
    `;
  }).join("");

  els.grid.innerHTML = thead + `<tbody>${tbodyRows}</tbody>`;
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
els.grid.addEventListener("change", (e) => {
  const cb = e.target;
  if (!(cb instanceof HTMLInputElement) || cb.type !== "checkbox") return;

  const iso = cb.getAttribute("data-iso");
  const name = cb.getAttribute("data-name");
  if (!iso || !name) return;

  const set = getAssignedSet(iso);
  if (cb.checked) set.add(name);
  else set.delete(name);

  setAssignedSet(iso, set);
});

els.btnPrev.addEventListener("click", () => {
  // shift window back 1 week (center moves back)
  const c = parseISODateLocal(centerSundayISO);
  centerSundayISO = toISODateLocal(addDays(c, -7));
  render();
});

els.btnNext.addEventListener("click", () => {
  const c = parseISODateLocal(centerSundayISO);
  centerSundayISO = toISODateLocal(addDays(c, 7));
  render();
});

els.btnToday.addEventListener("click", () => {
  centerSundayISO = toISODateLocal(upcomingSunday(new Date()));
  render();
});

els.btnClearAll.addEventListener("click", () => {
  const ok = confirm("Clear ALL assignments for ALL Sundays in this browser?");
  if (!ok) return;
  state.assignmentsBySunday = {};
  saveState();
  render();
});

// Init
render();
