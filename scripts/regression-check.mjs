import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const runsRoot = path.join(root, "runs");
const baselinePath = path.join(root, "examples", "regression.baseline.json");
const reportPath = path.join(root, "artifacts", "nightly-regression.md");
const strictMode = process.env.CI === "true" || process.env.REGRESSION_STRICT === "1";
const maxAllowedDrop = Number(process.env.REGRESSION_MAX_DROP ?? 3);

function manifestsForProject(project) {
  if (!fs.existsSync(runsRoot)) {
    return [];
  }

  const candidates = [];
  for (const dateDir of fs.readdirSync(runsRoot, { withFileTypes: true })) {
    if (!dateDir.isDirectory()) {
      continue;
    }

    const projectDir = path.join(runsRoot, dateDir.name, project);
    if (!fs.existsSync(projectDir)) {
      continue;
    }

    for (const runDir of fs.readdirSync(projectDir, { withFileTypes: true })) {
      if (!runDir.isDirectory()) {
        continue;
      }
      const manifestPath = path.join(projectDir, runDir.name, "manifest.json");
      if (!fs.existsSync(manifestPath)) {
        continue;
      }
      candidates.push(manifestPath);
    }
  }

  candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return candidates;
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const projects = Object.keys(baseline);

const reportLines = ["# Nightly Regression", "", `Generated at: ${new Date().toISOString()}`, ""];
let failed = false;

for (const project of projects) {
  const minScore = baseline[project];
  const manifests = manifestsForProject(project);

  if (manifests.length === 0) {
    reportLines.push(`- ${project}: ${strictMode ? "FAIL" : "WARN"} (manifest not found)`);
    if (strictMode) {
      failed = true;
    }
    continue;
  }

  const latest = JSON.parse(fs.readFileSync(manifests[0], "utf8"));
  const latestScore = latest.qa_score;
  const baselinePass = typeof latestScore === "number" && latestScore >= minScore;

  let dropPass = true;
  let dropText = "n/a";

  if (manifests.length >= 2) {
    const previous = JSON.parse(fs.readFileSync(manifests[1], "utf8"));
    const previousScore = previous.qa_score;
    if (typeof previousScore === "number" && typeof latestScore === "number") {
      const drop = previousScore - latestScore;
      dropPass = drop <= maxAllowedDrop;
      dropText = `${drop}`;
    }
  }

  const pass = baselinePass && dropPass;
  reportLines.push(
    `- ${project}: ${pass ? "PASS" : "FAIL"} (score=${latestScore}, baseline=${minScore}, drop=${dropText}, run_id=${latest.run_id})`
  );

  if (!pass) {
    failed = true;
  }
}

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${reportLines.join("\n")}\n`, "utf8");

if (failed && strictMode) {
  process.exitCode = 1;
}
