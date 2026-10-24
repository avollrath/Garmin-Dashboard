import { syncHistory } from "../src/history.mjs";

try {
  const history = await syncHistory();
  console.log(`Imported ${history.runs.length} runs (${history.startDate} to ${history.endDate}).`);
  console.log("Saved to data/runs.json (ignored by Git). No credentials saved.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
