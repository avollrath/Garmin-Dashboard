import { shiftDate } from "/metrics.mjs";
import {
  planSession,
  planWeek,
  weekSessions,
  weekTotals,
} from "/plan-schedule.mjs";

const $ = (id) => document.getElementById(id);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const dateLabel = (
  date,
  options = { day: "numeric", month: "short", year: "numeric" },
) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    ...options,
    timeZone: "UTC",
  });
const minutes = ([low, high]) =>
  low === high ? `${low} min` : `${low}–${high} min`;
let plan, today, selectedWeek;

function taskMarkup(task, label, compact = false) {
  if (!task)
    return `<div class="plan-task plan-rest"><span class="eyebrow">${label}</span><h3>${label === "RUN" ? "No run planned" : "No extra session"}</h3></div>`;
  const dose = task.assessment
    ? "10 km · if ready"
    : task.minutes
      ? minutes(task.minutes)
      : "Reduced leg load";
  return `<div class="plan-task"><span class="eyebrow">${label}</span><div class="plan-task-heading"><h3>${escape(task.title)}</h3><span class="plan-dose">${dose}</span></div>${compact ? `<details class="plan-task-details"><summary>Session notes</summary><p>${escape(task.notes)}</p></details>` : `<p class="plan-task-note">${escape(task.notes)}</p>`}</div>`;
}

function renderFocus(prefix, date) {
  $(prefix + "-date").textContent = dateLabel(date, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const session = planSession(plan, date);
  $(prefix + "-sessions").innerHTML = session
    ? taskMarkup(session.run, "RUN") + taskMarkup(session.cross, "ROW / GYM")
    : `<p class="plan-task-note">${date < plan.startDate ? `Your plan starts ${dateLabel(plan.startDate)}.` : "This training block has ended. Review your progress before starting the next one."}</p>`;
}

function renderWeek() {
  const sessions = weekSessions(plan, selectedWeek);
  const totals = weekTotals(sessions);
  $("week-select").value = selectedWeek;
  $("previous-week").disabled = selectedWeek === 1;
  $("next-week").disabled = selectedWeek === plan.weeks;
  $("week-heading").textContent = `Week ${selectedWeek} · ${sessions[0].stage}`;
  $("week-dates").textContent =
    `${dateLabel(sessions[0].date)} — ${dateLabel(sessions.at(-1).date)}`;
  $("week-summary").textContent =
    `${totals.runs} planned runs · ${minutes(totals.minutes)} running${totals.assessments ? " + optional 10K" : ""} · ${totals.gym} gym visits · ${totals.rowing} rows`;
  const stage = plan.stages.find(
    (item) => selectedWeek >= item.from && selectedWeek <= item.to,
  );
  $("week-focus").textContent =
    `${sessions[0].cutback ? "Recovery week · " : ""}${stage.focus}`;
  $("week-sessions").innerHTML = sessions
    .map(
      (session) =>
        `<article class="plan-day${session.date === today ? " is-today" : ""}"><div class="plan-day-date"><strong>${dateLabel(session.date, { weekday: "short" })}</strong><span>${dateLabel(session.date, { day: "numeric", month: "short" })}</span>${session.date === today ? '<span class="tag">Today</span>' : session.date === shiftDate(today, 1) ? '<span class="tag">Tomorrow</span>' : ""}</div>${taskMarkup(session.run, "RUN", true)}${taskMarkup(session.cross, "ROW / GYM", true)}</article>`,
    )
    .join("");
  document
    .querySelectorAll("[data-week]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(
          selectedWeek >= Number(button.dataset.week) &&
            selectedWeek <= Number(button.dataset.end),
        ),
      ),
    );
}

try {
  const response = await fetch("/api/plan");
  const data = await response.json();
  if (!response.ok) throw new Error();
  plan = data.plan;
  today = data.today;
  $("loading").hidden = true;
  $("empty").hidden = Boolean(plan);
  $("plan-content").hidden = !plan;
  if (plan) {
    $("plan-goal").textContent =
      `${plan.goal} · Four running days · Alternating rowing and gym`;
    $("plan-status").textContent =
      `${plan.weeks}-week plan · Starts ${dateLabel(plan.startDate)}`;
    selectedWeek =
      planWeek(plan, today) ?? (today < plan.startDate ? 1 : plan.weeks);
    $("week-select").innerHTML = Array.from(
      { length: plan.weeks },
      (_, i) => `<option value="${i + 1}">Week ${i + 1}</option>`,
    ).join("");
    $("plan-roadmap").innerHTML = plan.stages
      .map(
        (stage) =>
          `<button class="plan-stage" data-week="${stage.from}" data-end="${stage.to}" aria-pressed="false"><span class="eyebrow">${stage.from === stage.to ? `WEEK ${stage.from}` : `WEEKS ${stage.from}–${stage.to}`}</span><strong>${escape(stage.title)}</strong><span>${escape(stage.focus)}</span></button>`,
      )
      .join("");
    $("plan-guidance").innerHTML = plan.rules
      .map(
        (rule) =>
          `<article class="panel"><h3>${escape(rule.title)}</h3><p>${escape(rule.text)}</p></article>`,
      )
      .join("");
    $("plan-rationale").innerHTML = plan.rationale
      .map((text) => `<p>${escape(text)}</p>`)
      .join("");
    renderFocus("today", today);
    renderFocus("tomorrow", shiftDate(today, 1));
    renderWeek();
  } else {
    $("plan-status").textContent = "No saved training plan";
  }
} catch {
  $("loading").hidden = true;
  $("plan-content").hidden = true;
  $("message").hidden = false;
  $("message").textContent =
    "Could not load your training plan. Check that the local server is running, then reload.";
  $("plan-status").textContent = "Plan unavailable";
}

$("week-select").addEventListener("change", () => {
  selectedWeek = Number($("week-select").value);
  renderWeek();
});
$("previous-week").addEventListener("click", () => {
  selectedWeek--;
  renderWeek();
});
$("next-week").addEventListener("click", () => {
  selectedWeek++;
  renderWeek();
});
$("current-week").addEventListener("click", () => {
  selectedWeek =
    planWeek(plan, today) ?? (today < plan.startDate ? 1 : plan.weeks);
  renderWeek();
});
$("plan-roadmap").addEventListener("click", (event) => {
  const button = event.target.closest("[data-week]");
  if (button) {
    selectedWeek = Number(button.dataset.week);
    renderWeek();
    $("week-heading").scrollIntoView({ block: "start" });
  }
});
