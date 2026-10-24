import { duration, inRange, pace, periodRange } from "/metrics.mjs";
import { funStats, runPace } from "/fun-stats.mjs";

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
  value == null
    ? "—"
    : value.toLocaleString("en-GB", { maximumFractionDigits: digits });
const dateLabel = (
  date,
  options = { day: "numeric", month: "short", year: "numeric" },
) =>
  date
    ? new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", {
        ...options,
        timeZone: "UTC",
      })
    : "—";
const runLabel = (run) =>
  run
    ? `${dateLabel(run.startLocal)} · ${run.name}`
    : "No qualifying run in this period";
let history,
  today,
  period = "all";

function card({
  label,
  value,
  unit = "",
  detail = "",
  run = null,
  featured = false,
}) {
  return `<article class="stat-card${featured ? " featured" : ""}"><h3>${escape(label)}</h3><div class="stat-value">${escape(value)}${unit ? `<small>${escape(unit)}</small>` : ""}</div><p class="stat-detail">${escape(detail)}</p>${run ? `<a class="text-button" href="/?run=${run.id}" aria-label="${escape(`View ${run.name}, ${dateLabel(run.startLocal)}`)}">View run →</a>` : ""}</article>`;
}

function renderBars(id, values) {
  const max = Math.max(...values.map((item) => item.count), 1);
  $(id).innerHTML = values
    .map(
      (item) =>
        `<div class="habit-row"><span>${escape(item.label)}</span><div class="habit-track"><span style="width:${(item.count / max) * 100}%"></span></div><strong>${item.count}</strong></div>`,
    )
    .join("");
}

function render() {
  $("loading").hidden = true;
  const fullHistory = history?.scope === "all";
  if (!fullHistory && (period === "all" || period.startsWith("year:")))
    period = "90";
  $("history-notice").hidden = !history || fullHistory;
  document.querySelector('[data-period="all"]').disabled = !fullHistory;
  $("year-select").disabled = !fullHistory;
  const lastYear = Number(today.slice(0, 4));
  const firstYear = Number(history?.startDate.slice(0, 4) ?? lastYear);
  $("year-select").innerHTML =
    '<option value="">Year…</option>' +
    (fullHistory
      ? Array.from(
          { length: lastYear - firstYear + 1 },
          (_, i) => `<option value="${lastYear - i}">${lastYear - i}</option>`,
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
  const range = periodRange(period, today, history?.startDate);
  $("range-caption").textContent =
    `${dateLabel(range.start)} — ${dateLabel(range.end)}`;
  $("stats-status").textContent = history
    ? `Saved ${new Date(history.syncedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Kyiv" })} · ${history.runs.length} runs in history`
    : "No saved running history";
  const runs = history ? inRange(history.runs, range.start, range.end) : [];
  $("empty").hidden = runs.length > 0;
  $("stats-content").hidden = !runs.length;
  if (!runs.length) {
    $("empty-text").textContent = history?.runs.length
      ? "No runs in this period. Try another year or All time."
      : "Import your running history from Overview to see your personal records.";
    return;
  }

  const stats = funStats(runs, Number($("pace-minimum").value));
  const { total } = stats;
  $("stats-totals").innerHTML = [
    [number(total.km), "km recorded"],
    [number(total.count, 0), "runs logged"],
    [number(total.days, 0), "running days"],
    [duration(total.seconds), "time on your feet"],
    [number(total.km / 42.195), "marathon distances combined"],
  ]
    .map(
      ([value, label]) =>
        `<div><strong>${value}</strong><span>${label}</span></div>`,
    )
    .join("");
  $("record-cards").innerHTML = [
    {
      label: "Fastest average pace",
      value: pace(stats.fastest ? runPace(stats.fastest) : null),
      unit: "/km",
      detail: runLabel(stats.fastest),
      run: stats.fastest,
      featured: true,
    },
    {
      label: "Slowest average pace",
      value: pace(stats.slowest ? runPace(stats.slowest) : null),
      unit: "/km",
      detail: runLabel(stats.slowest),
      run: stats.slowest,
    },
    {
      label: "Longest running streak",
      value: stats.longestStreak.days,
      unit: stats.longestStreak.days === 1 ? "day" : "days",
      detail: `${dateLabel(stats.longestStreak.start)} — ${dateLabel(stats.longestStreak.end)} · Consecutive calendar days, any run distance`,
    },
    {
      label: "Longest run",
      value: number(
        stats.longest ? stats.longest.distanceMeters / 1000 : null,
        2,
      ),
      unit: "km",
      detail: runLabel(stats.longest),
      run: stats.longest,
    },
    {
      label: "Longest time running",
      value: duration(stats.longestTime?.durationSeconds),
      detail: runLabel(stats.longestTime),
      run: stats.longestTime,
    },
    {
      label: "Most climbing in one run",
      value: number(stats.mostClimbing?.elevationMeters, 0),
      unit: "m",
      detail: runLabel(stats.mostClimbing),
      run: stats.mostClimbing,
    },
    {
      label: "Most runs in a day",
      value: stats.busiestDay.count,
      unit: "runs",
      detail: dateLabel(stats.busiestDay.date),
    },
    {
      label: "Longest pause between runs",
      value: stats.longestPause?.days ?? (total.days > 1 ? 0 : "—"),
      unit: "days",
      detail: stats.longestPause
        ? `${dateLabel(stats.longestPause.start)} — ${dateLabel(stats.longestPause.end)} · Days with no recorded run`
        : total.days > 1
          ? "No rest days between consecutive running dates"
          : "Needs at least two running dates",
    },
  ]
    .map(card)
    .join("");
  $("moment-cards").innerHTML = [
    {
      label: "First recorded run",
      value: dateLabel(stats.first.startLocal),
      detail: stats.first.name,
      run: stats.first,
    },
    {
      label: "Latest recorded run",
      value: dateLabel(stats.latest.startLocal),
      detail: stats.latest.name,
      run: stats.latest,
    },
    {
      label: "Earliest start of the day",
      value: stats.earliestStart.startLocal.slice(11, 16),
      detail: runLabel(stats.earliestStart),
      run: stats.earliestStart,
    },
    {
      label: "Latest start of the day",
      value: stats.latestStart.startLocal.slice(11, 16),
      detail: runLabel(stats.latestStart),
      run: stats.latestStart,
    },
  ]
    .map(card)
    .join("");
  $("volume-cards").innerHTML = [
    {
      label: "Biggest running day",
      value: number(stats.biggestDay?.km, 2),
      unit: "km",
      detail: dateLabel(stats.biggestDay?.date),
    },
    {
      label: "Biggest running week",
      value: number(stats.biggestWeek?.km),
      unit: "km",
      detail: `Week of ${dateLabel(stats.biggestWeek?.date)}`,
    },
    {
      label: "Biggest running month",
      value: number(stats.biggestMonth?.km),
      unit: "km",
      detail: stats.biggestMonth
        ? dateLabel(`${stats.biggestMonth.date}-01`, {
            month: "long",
            year: "numeric",
          })
        : "No recorded distance",
    },
    {
      label: "Biggest running year",
      value: number(stats.biggestYear?.km),
      unit: "km",
      detail: stats.biggestYear?.date ?? "No recorded distance",
    },
  ]
    .map(card)
    .join("");
  renderBars("weekday-chart", stats.weekdays);
  renderBars("time-chart", stats.times);
  renderBars("distance-chart", stats.distances);
  const favoriteDays = stats.weekdays.filter(
    (day) =>
      day.count === Math.max(...stats.weekdays.map((item) => item.count)),
  );
  $("weekday-note").textContent =
    `${favoriteDays.map((day) => day.label).join(" / ")} leads with ${favoriteDays[0].count} runs`;
  $("time-note").textContent =
    `${number(((stats.times[1].count + stats.times[2].count) / total.count) * 100, 0)}% start from 06:00 to 17:59`;
  $("distance-note").textContent =
    `${stats.distances.reduce((sum, bucket) => sum + bucket.count, 0)} runs with recorded distance`;
  $("milestone-cards").innerHTML = stats.milestones
    .map(({ meters, run }) => ({
      label:
        meters === 21097.5
          ? "First half marathon distance"
          : meters === 42195
            ? "First marathon distance"
            : `First ${meters / 1000} km+ run`,
      value: run ? dateLabel(run.startLocal) : "Still to come",
      detail: run
        ? `${number(run.distanceMeters / 1000, 2)} km · ${run.name}`
        : "No qualifying run in this period",
      run,
    }))
    .map(card)
    .join("");
}

document.querySelectorAll("[data-period]").forEach((button) =>
  button.addEventListener("click", () => {
    period = button.dataset.period;
    render();
  }),
);
$("year-select").addEventListener("change", () => {
  period = $("year-select").value ? `year:${$("year-select").value}` : "all";
  render();
});
$("pace-minimum").addEventListener("change", render);

try {
  const response = await fetch("/api/training");
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Cannot load saved running history.");
  history = data.history;
  today = data.today;
  render();
} catch {
  $("loading").hidden = true;
  $("message").textContent =
    "Could not load running statistics. Check that the local server is running, then reload. Your saved data is unchanged.";
  $("message").hidden = false;
  $("stats-status").textContent = "Statistics unavailable";
}
