import {
  duration,
  inRange,
  pace,
  periodRange,
  shiftDate,
  summarize,
  groupRuns,
} from "/metrics.mjs";

const $ = (id) => document.getElementById(id);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const number = (value, digits = 1) =>
  value.toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
const dateLabel = (date, options = { day: "numeric", month: "short" }) =>
  new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", {
    ...options,
    timeZone: "UTC",
  });
const runPace = (run) =>
  run.distanceMeters > 0 && run.durationSeconds > 0
    ? (run.durationSeconds / run.distanceMeters) * 1000
    : null;
const zoneColors = ["#dfe6d5", "#bad397", "#84aa62", "#c9ac69", "#bb806b"];
let history,
  today,
  period = "28",
  showAll = false;

async function api(path, options) {
  let response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new Error(
      "Cannot reach your local dashboard. Check that the server is running.",
    );
  }
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Unable to load training data.");
  return data;
}

function updateStatus() {
  if (!history) {
    $("sync-status").textContent = "Ready to connect your training";
    return;
  }
  const synced = new Date(history.syncedAt);
  const age = Date.now() - synced.getTime();
  $("sync-status").textContent =
    `${age > 86_400_000 ? "Saved" : "Synced"} ${synced.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" })}`;
}

function render() {
  $("loading").hidden = true;
  $("today-label").textContent = today
    ? dateLabel(today, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).toUpperCase()
    : "YOUR TRAINING, IN PERSPECTIVE";
  updateStatus();
  const fullHistory = history?.scope === "all";
  $("history-notice").hidden = !history || fullHistory;
  document.querySelector('[data-period="all"]').disabled = !fullHistory;
  $("year-select").disabled = !fullHistory;
  const currentYear = Number(today?.slice(0, 4));
  const firstYear = Number(history?.startDate.slice(0, 4) ?? currentYear);
  $("year-select").innerHTML =
    '<option value="">Year…</option>' +
    (fullHistory
      ? Array.from(
          { length: currentYear - firstYear + 1 },
          (_, i) =>
            `<option value="${currentYear - i}">${currentYear - i}</option>`,
        ).join("")
      : "");
  $("year-select").value = period.startsWith("year:") ? period.slice(5) : "";
  document
    .querySelectorAll("[data-period]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.period === period),
      ),
    );
  const range = today ? periodRange(period, today, history?.startDate) : null;
  const dateOptions = { day: "numeric", month: "short", year: "numeric" };
  $("range-caption").textContent = range
    ? `${dateLabel(range.start, dateOptions)} — ${dateLabel(range.end, dateOptions)}`
    : "";
  $("empty").hidden = Boolean(history?.runs.length);
  $("dashboard").hidden = !history?.runs.length;
  if (!history?.runs.length) {
    $("empty-text").textContent = history
      ? "No running activities found. Sync again after your next run."
      : "Sync Garmin to bring your running history into view.";
    return;
  }

  const runs = inRange(history.runs, range.start, range.end);
  const summary = summarize(runs);
  $("total-distance").textContent = number(summary.km);
  $("total-time").textContent = duration(summary.seconds);
  $("average-pace").textContent = pace(summary.pace);
  $("run-count").textContent = summary.count;
  $("run-note").textContent =
    `${summary.days} active ${summary.days === 1 ? "day" : "days"} · ${number(summary.longestKm)} km longest`;
  const days = Number(period);
  const previousStart = Number.isFinite(days)
    ? shiftDate(range.start, -days)
    : null;
  if (previousStart && (fullHistory || previousStart >= history.startDate)) {
    const previous = summarize(
      inRange(history.runs, previousStart, shiftDate(range.start, -1)),
    );
    const change =
      previous.km > 0 ? ((summary.km - previous.km) / previous.km) * 100 : null;
    $("distance-note").textContent =
      change == null
        ? "No runs in previous period"
        : `${change >= 0 ? "↑" : "↓"} ${number(Math.abs(change), 0)}% vs previous ${days} days`;
  } else {
    $("distance-note").textContent = "Your distance in this period";
  }
  renderVolume(groupRuns(runs, range.start, range.end, range.unit), range.unit);
  renderLatest(runs[0]);
  renderCalendar();
  renderZones(summary.zones);
  renderTable();
}

function renderVolume(buckets, unit) {
  const heading =
    unit === "year" ? "Yearly" : unit === "month" ? "Monthly" : "Weekly";
  $("volume-heading").textContent = `${heading} distance`;
  $("volume-note").textContent =
    unit === "week"
      ? "Weeks start Monday. First and current weeks may be partial."
      : `Calendar ${unit}s. First and current ${unit}s may be partial.`;
  const bucketLabel = (date) =>
    unit === "year"
      ? date.slice(0, 4)
      : unit === "month"
        ? dateLabel(date, { month: "short" })
        : dateLabel(date);
  const width = 640,
    height = 218,
    left = 30,
    right = 8,
    top = 8,
    bottom = 32;
  const plotHeight = height - top - bottom;
  const step = Math.max(
    1,
    Math.ceil(Math.max(...buckets.map((week) => week.km), 1) / 4),
  );
  const maximum = step * 4;
  const slot = (width - left - right) / buckets.length;
  const barWidth = Math.min(42, slot * 0.6);
  const grid = [0, 1, 2, 3, 4]
    .map((i) => {
      const y = top + plotHeight - (i / 4) * plotHeight;
      return `<line class="grid-line" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"/><text x="${left - 9}" y="${y + 3}" text-anchor="end">${i * step}</text>`;
    })
    .join("");
  const bars = buckets
    .map((week, i) => {
      const barHeight = (week.km / maximum) * plotHeight;
      const x = left + i * slot + slot / 2;
      const label =
        buckets.length < 13 ||
        i % Math.ceil(buckets.length / 10) === 0 ||
        i === buckets.length - 1
          ? bucketLabel(week.date)
          : "";
      return `<rect class="bar" x="${x - barWidth / 2}" y="${top + plotHeight - barHeight}" width="${barWidth}" height="${Math.max(barHeight, 1)}" rx="3"><title>${unit === "week" ? "Week of " : ""}${bucketLabel(week.date)}: ${number(week.km)} km · ${week.count} runs</title></rect><text x="${x}" y="${height - 8}" text-anchor="middle">${label}</text>`;
    })
    .join("");
  $("volume-chart").innerHTML =
    `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="volume-title"><title id="volume-title">${heading} running distance in kilometers. ${escape(buckets.map((week) => `${bucketLabel(week.date)}: ${number(week.km)} km`).join("; "))}</title>${grid}${bars}</svg>`;
}

function renderLatest(run) {
  if (!run) {
    $("latest-run").innerHTML =
      '<p class="zone-empty">No runs in this period.</p>';
    return;
  }
  $("latest-run").innerHTML =
    `<div class="latest-distance">${run.distanceMeters == null ? "—" : number(run.distanceMeters / 1000, 2)}<small>km</small></div><span class="latest-name">${escape(run.name)}</span><span class="latest-meta">${dateLabel(run.startLocal, { weekday: "short", day: "numeric", month: "short" })} · ${escape(run.type.replaceAll("_", " "))}</span><div class="latest-stats"><div><strong>${pace(runPace(run))}</strong><span>PACE /KM</span></div><div><strong>${duration(run.durationSeconds)}</strong><span>TIME</span></div><div><strong>${run.averageHr ? Math.round(run.averageHr) : "—"}</strong><span>AVG HR</span></div></div><button class="text-button latest-detail" data-run-id="${run.id}">View run details →</button>`;
}

function renderCalendar() {
  const rangeStart = shiftDate(today, -89);
  const byDate = new Map();
  for (const run of inRange(history.runs, rangeStart, today)) {
    const date = run.startLocal.slice(0, 10);
    byDate.set(
      date,
      (byDate.get(date) ?? 0) + (run.distanceMeters ?? 0) / 1000,
    );
  }
  const buckets = groupRuns([], rangeStart, today);
  const labels = `<div class="calendar-days" aria-hidden="true">${["M", "", "W", "", "F", "", "S"].map((day) => `<span>${day}</span>`).join("")}</div>`;
  const columns = buckets
    .map((week, index) => {
      const monthChanged =
        index === 0 ||
        week.date.slice(5, 7) !== buckets[index - 1].date.slice(5, 7);
      const label = monthChanged
        ? dateLabel(week.date, { month: "short" })
        : "";
      const cells = Array.from({ length: 7 }, (_, i) => {
        const date = shiftDate(week.date, i);
        const outside =
          date < rangeStart ||
          date > today ||
          date < history.startDate ||
          date > history.endDate;
        const km = byDate.get(date) ?? 0;
        const level =
          km >= 15 ? 4 : km >= 10 ? 3 : km >= 5 ? 2 : byDate.has(date) ? 1 : 0;
        const title = `${dateLabel(date, { day: "numeric", month: "long" })}: ${byDate.has(date) ? `${number(km)} km` : "Rest day"}`;
        return `<span class="day level${level}${outside ? " outside" : ""}" title="${escape(title)}"${outside ? ' aria-hidden="true"' : ` role="img" aria-label="${escape(title)}"`}></span>`;
      }).join("");
      return `<div class="calendar-week"><span class="month-label" aria-hidden="true">${label}</span>${cells}</div>`;
    })
    .join("");
  $("calendar").innerHTML =
    `${labels}<div class="calendar-weeks">${columns}</div>`;
  $("consistency-note").textContent =
    `${byDate.size} running days in the last 90 days`;
}

function renderZones(zones) {
  $("zone-period").textContent = periodRange(
    period,
    today,
    history.startDate,
  ).label;
  const total = zones.reduce((a, b) => a + b, 0);
  if (!total) {
    $("zones").innerHTML =
      '<p class="zone-empty">No heart rate zone data recorded for these runs.</p>';
    return;
  }
  $("zones").innerHTML =
    `<div class="zone-bar" role="img" aria-label="${escape(zones.map((seconds, i) => `Zone ${i + 1}: ${duration(seconds)}`).join(", "))}">${zones.map((seconds, i) => `<div class="zone-segment" style="width:${(seconds / total) * 100}%;background:${zoneColors[i]}" title="Zone ${i + 1}: ${duration(seconds)}"></div>`).join("")}</div><div class="zone-labels">${zones.map((seconds, i) => `<div class="zone-label"><span class="zone-dot" style="background:${zoneColors[i]}"></span>Z${i + 1}<strong>${number((seconds / total) * 100, 0)}%</strong></div>`).join("")}</div>`;
}

function renderTable() {
  if (!history) return;
  const query = $("search").value.trim().toLowerCase();
  const range = periodRange(period, today, history.startDate);
  const runs = inRange(history.runs, range.start, range.end).filter((run) =>
    run.name.toLowerCase().includes(query),
  );
  if ($("sort").value === "longest")
    runs.sort((a, b) => (b.distanceMeters ?? 0) - (a.distanceMeters ?? 0));
  if ($("sort").value === "fastest")
    runs.sort((a, b) => (runPace(a) ?? Infinity) - (runPace(b) ?? Infinity));
  const shown = showAll ? runs : runs.slice(0, 8);
  $("log-count").textContent = runs.length;
  $("runs-body").innerHTML = shown
    .map(
      (run) =>
        `<tr><td><button class="run-name" data-run-id="${run.id}"><span class="run-icon" aria-hidden="true">↗</span><span class="run-name-text">${escape(run.name)}</span></button></td><td class="date-cell">${dateLabel(run.startLocal, { day: "numeric", month: "short", year: "numeric" })}</td><td class="distance-cell">${run.distanceMeters == null ? "—" : `${number(run.distanceMeters / 1000, 2)} km`}</td><td>${duration(run.durationSeconds)}</td><td>${pace(runPace(run))}</td><td>${run.averageHr ? `${Math.round(run.averageHr)} <span class="date-cell">bpm</span>` : "—"}</td><td>${run.elevationMeters == null ? "—" : `${Math.round(run.elevationMeters)} m`}</td></tr>`,
    )
    .join("");
  $("no-results").hidden = runs.length > 0;
  $("table-caption").textContent =
    `Showing ${shown.length} of ${runs.length} runs`;
  $("show-all").hidden = runs.length <= 8;
  $("show-all").textContent = showAll ? "Show fewer ↑" : "Show all runs ↓";
}

function showRun(id) {
  const run = history?.runs.find((item) => item.id === Number(id));
  if (!run) return;
  $("detail-name").textContent = run.name;
  $("detail-date").textContent =
    `${dateLabel(run.startLocal, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${run.startLocal.slice(11, 16)} · ${run.type.replaceAll("_", " ")}`;
  const metrics = [
    [
      run.distanceMeters == null ? "—" : number(run.distanceMeters / 1000, 2),
      "km",
      "Distance",
    ],
    [duration(run.durationSeconds), "", "Timer time"],
    [pace(runPace(run)), "/km", "Average pace"],
    [
      run.averageHr ? Math.round(run.averageHr) : "—",
      "bpm",
      "Average heart rate",
    ],
    [run.maxHr ? Math.round(run.maxHr) : "—", "bpm", "Max heart rate"],
    [
      run.elevationMeters == null ? "—" : Math.round(run.elevationMeters),
      "m",
      "Elevation gain",
    ],
    [
      run.cadenceSpm ? Math.round(run.cadenceSpm) : "—",
      "spm",
      "Average cadence",
    ],
    [
      run.aerobicEffect == null ? "—" : number(run.aerobicEffect),
      "/5",
      "Aerobic effect",
    ],
    [
      run.trainingLoad == null ? "—" : Math.round(run.trainingLoad),
      "",
      "Garmin training load",
    ],
  ];
  $("detail-metrics").innerHTML = metrics
    .map(
      ([value, unit, label]) =>
        `<div><strong>${value}<small>${unit}</small></strong><span>${label}</span></div>`,
    )
    .join("");
  $("run-dialog").showModal();
}

async function sync() {
  $("sync").disabled = true;
  $("empty-sync").disabled = true;
  $("sync-status").textContent = "Contacting Garmin…";
  $("message").hidden = true;
  try {
    const data = await api("/api/sync", { method: "POST" });
    history = data.history;
    today = data.today;
    render();
  } catch (error) {
    $("message").textContent =
      `${error.message}${history ? " Your saved training is still available." : ""}`;
    $("message").hidden = false;
    updateStatus();
  } finally {
    $("sync").disabled = false;
    $("empty-sync").disabled = false;
  }
}

$("sync").addEventListener("click", sync);
$("empty-sync").addEventListener("click", sync);
document.querySelectorAll("[data-period]").forEach((button) =>
  button.addEventListener("click", () => {
    period = button.dataset.period;
    showAll = false;
    render();
  }),
);
$("year-select").addEventListener("change", () => {
  period = $("year-select").value ? `year:${$("year-select").value}` : "28";
  showAll = false;
  render();
});
$("search").addEventListener("input", () => {
  showAll = false;
  renderTable();
});
$("sort").addEventListener("change", () => {
  showAll = false;
  renderTable();
});
$("show-all").addEventListener("click", () => {
  showAll = !showAll;
  renderTable();
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-run-id]");
  if (button) showRun(button.dataset.runId);
});
$("close-dialog").addEventListener("click", () => $("run-dialog").close());
$("run-dialog").addEventListener("click", (event) => {
  if (event.target === $("run-dialog")) $("run-dialog").close();
});

try {
  const data = await api("/api/training");
  history = data.history;
  today = data.today;
  const runId = new URLSearchParams(location.search).get("run");
  if (runId && history?.scope === "all") period = "all";
  render();
  if (runId) showRun(runId);
} catch (error) {
  $("loading").hidden = true;
  $("message").textContent = error.message;
  $("message").hidden = false;
  $("empty").hidden = false;
  $("sync-status").textContent = "Could not load saved training";
}
