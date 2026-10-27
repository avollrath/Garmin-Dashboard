import { shiftDate } from "./metrics.mjs";

const dayMilliseconds = 86_400_000;

export function planWeek(plan, date) {
  const offset =
    (Date.parse(`${date}T12:00:00Z`) -
      Date.parse(`${plan.startDate}T12:00:00Z`)) /
    dayMilliseconds;
  const week = Math.floor(offset / 7) + 1;
  return week >= 1 && week <= plan.weeks ? week : null;
}

export function planSession(plan, date) {
  const week = planWeek(plan, date);
  if (week === null) return null;
  const stage = plan.stages.find(
    (item) => week >= item.from && week <= item.to,
  );
  const cutback = week % 4 === 0 && week < plan.weeks;
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const role = plan.runDays.find((item) => item.weekday === weekday)?.role;
  let run = null;
  if (role) {
    let workout =
      role === "quality"
        ? plan.workouts.find((item) => week >= item.from && week <= item.to)
        : null;
    if (cutback && workout?.kind !== "benchmark") workout = null;
    const minutes =
      workout?.minutes ??
      stage.minutes[role].map((value) =>
        Math.round(value * (cutback ? 0.8 : 1)),
      );
    run = {
      role,
      minutes,
      title:
        workout?.title ??
        (role === "long"
          ? "Longer easy run"
          : role === "short"
            ? "Short easy run"
            : "Easy run"),
      notes: workout?.notes ?? plan.easyNotes,
      assessment: week === plan.weeks && role === "long",
    };
    if (run.assessment) {
      run.title = "10K assessment — if ready";
      run.notes = plan.assessmentNotes;
    }
  }
  let cross = null;
  if (date >= plan.gymStartDate) {
    const offset =
      (Date.parse(`${date}T12:00:00Z`) -
        Date.parse(`${plan.gymStartDate}T12:00:00Z`)) /
      dayMilliseconds;
    const type = offset % 2 === 0 ? "gym" : "rowing";
    const light =
      cutback ||
      role === "long" ||
      week <= 2 ||
      (type === "gym" && [1, 4, 6].includes(weekday)) ||
      (type === "rowing" && role === "quality");
    cross = {
      type,
      title:
        type === "gym"
          ? light
            ? "Light full-body gym"
            : "Full-body gym"
          : light
            ? "Recovery row"
            : "Easy row",
      minutes:
        type === "rowing"
          ? light
            ? stage.recoveryRowMinutes
            : stage.rowMinutes
          : null,
      notes: type === "gym" ? plan.gymNotes : plan.rowNotes,
    };
    if (run?.assessment) {
      cross.title = "Optional recovery only";
      cross.minutes = [0, 15];
      cross.notes =
        "Prioritize the assessment and recovery. Skip this session if tired.";
    }
  }
  return { date, week, stage: stage.title, cutback, run, cross };
}

export function weekSessions(plan, week) {
  const start = shiftDate(plan.startDate, (week - 1) * 7);
  return Array.from({ length: 7 }, (_, i) =>
    planSession(plan, shiftDate(start, i)),
  );
}

export function weekTotals(sessions) {
  const runs = sessions.filter((session) => session.run);
  return {
    runs: runs.length,
    minutes: [0, 1].map((index) =>
      runs.reduce(
        (sum, session) =>
          sum + (session.run.assessment ? 0 : session.run.minutes[index]),
        0,
      ),
    ),
    assessments: runs.filter((session) => session.run.assessment).length,
    gym: sessions.filter((session) => session.cross?.type === "gym").length,
    rowing: sessions.filter((session) => session.cross?.type === "rowing")
      .length,
  };
}
