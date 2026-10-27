import assert from "node:assert/strict";
import { test } from "node:test";
import { shiftDate } from "../public/metrics.mjs";
import {
  planSession,
  planWeek,
  weekSessions,
  weekTotals,
} from "../public/plan-schedule.mjs";

const plan = {
  startDate: "2026-10-27",
  gymStartDate: "2026-10-28",
  weeks: 16,
  runDays: [
    { weekday: 2, role: "easy" },
    { weekday: 3, role: "short" },
    { weekday: 5, role: "quality" },
    { weekday: 0, role: "long" },
  ],
  stages: [
    {
      from: 1,
      to: 16,
      title: "Sample build",
      minutes: {
        easy: [20, 25],
        short: [10, 15],
        quality: [30, 40],
        long: [45, 60],
      },
      rowMinutes: [20, 30],
      recoveryRowMinutes: [10, 15],
    },
  ],
  workouts: [
    { from: 5, to: 11, title: "Tempo", notes: "Controlled effort" },
    {
      from: 12,
      to: 12,
      kind: "benchmark",
      title: "Optional benchmark",
      minutes: [45, 55],
      notes: "Only if ready",
    },
  ],
  easyNotes: "Conversational",
  gymNotes: "Reduce sets",
  rowNotes: "Easy",
  assessmentNotes: "Only if ready",
};

test("Tuesday starts with run only, Wednesday starts gym plus a shorter run", () => {
  const today = planSession(plan, "2026-10-27");
  assert.equal(today.run.role, "easy");
  assert.equal(today.cross, null);
  const tomorrow = planSession(plan, "2026-10-28");
  assert.equal(tomorrow.run.role, "short");
  assert.deepEqual(tomorrow.run.minutes, [10, 15]);
  assert.equal(tomorrow.cross.type, "gym");
  assert.equal(tomorrow.cross.title, "Light full-body gym");
  assert.equal(planSession(plan, "2026-10-29").run, null);
  assert.equal(planSession(plan, "2026-10-29").cross.type, "rowing");
});

test("all 16 weeks have exactly four running dates and cross-training never resets at a week boundary", () => {
  for (let week = 1; week <= 16; week++) {
    const sessions = weekSessions(plan, week);
    assert.equal(sessions.length, 7);
    assert.equal(weekTotals(sessions).runs, 4);
    assert.deepEqual(
      sessions
        .filter((day) => day.run)
        .map((day) => new Date(`${day.date}T12:00:00Z`).getUTCDay()),
      [2, 3, 5, 0],
    );
  }
  for (let offset = 0; offset < 111; offset++) {
    const session = planSession(plan, shiftDate(plan.gymStartDate, offset));
    assert.equal(session.cross.type, offset % 2 === 0 ? "gym" : "rowing");
  }
  assert.equal(planSession(plan, "2026-11-02").cross.type, "rowing");
  assert.equal(planSession(plan, "2026-11-03").cross.type, "gym");
});

test("recovery weeks reduce durations and keep quality easy except the explicitly optional benchmark", () => {
  const build = weekTotals(weekSessions(plan, 3));
  const recovery = weekTotals(weekSessions(plan, 4));
  assert.deepEqual(
    recovery.minutes,
    build.minutes.map((value) => value * 0.8),
  );
  assert.equal(
    weekSessions(plan, 4).find((day) => day.run?.role === "quality").run.title,
    "Easy run",
  );
  assert.equal(
    weekSessions(plan, 5).find((day) => day.run?.role === "quality").run.title,
    "Tempo",
  );
  const benchmark = weekSessions(plan, 12).find(
    (day) => day.run?.role === "quality",
  );
  assert.equal(benchmark.cutback, true);
  assert.equal(benchmark.run.title, "Optional benchmark");
  assert.deepEqual(benchmark.run.minutes, [45, 55]);
});

test("year and DST boundaries retain calendar dates and plan ends without repeating", () => {
  assert.equal(weekSessions(plan, 16).at(-1).date, "2027-02-15");
  assert.equal(planWeek(plan, "2026-10-26"), null);
  assert.equal(planSession(plan, "2027-02-16"), null);
  const dstPlan = {
    ...plan,
    startDate: "2026-10-20",
    gymStartDate: "2026-10-21",
  };
  assert.deepEqual(
    weekSessions(dstPlan, 1).map((day) => day.date),
    [
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
    ],
  );
});

test("final assessment is conditional and is not presented as zero minutes in weekly totals", () => {
  const sessions = weekSessions(plan, 16);
  const assessment = sessions.find((day) => day.run?.assessment);
  assert.equal(assessment.date, "2027-02-14");
  assert.equal(assessment.run.title, "10K assessment — if ready");
  assert.equal(assessment.cross.title, "Optional recovery only");
  const totals = weekTotals(sessions);
  assert.equal(totals.assessments, 1);
  assert.deepEqual(totals.minutes, [60, 80]);
});
