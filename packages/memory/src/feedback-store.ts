import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { Feedback } from "@consulting-ppt/shared";
import { deriveLearningRules } from "./learning-rules";
import { findRunRootById, writeJson } from "./run-store";

export function storeFeedback(feedback: Feedback, cwd = process.cwd()): string {
  const runRoot = findRunRootById(feedback.run_id, cwd);
  if (!runRoot) {
    throw new Error(`Run not found for run_id=${feedback.run_id}`);
  }

  const target = path.join(runRoot, "qa", "feedback.json");
  writeJson(target, feedback);
  return target;
}

function listFeedbackFiles(projectId: string, cwd = process.cwd()): string[] {
  const runsRoot = path.join(cwd, "runs");
  if (!existsSync(runsRoot)) {
    return [];
  }

  const feedbackFiles: Array<{ file: string; mtimeMs: number }> = [];

  for (const dateDir of readdirSync(runsRoot, { withFileTypes: true })) {
    if (!dateDir.isDirectory()) {
      continue;
    }

    const projectDir = path.join(runsRoot, dateDir.name, projectId);
    if (!existsSync(projectDir)) {
      continue;
    }

    for (const runDir of readdirSync(projectDir, { withFileTypes: true })) {
      if (!runDir.isDirectory()) {
        continue;
      }

      const feedbackPath = path.join(projectDir, runDir.name, "qa", "feedback.json");
      if (!existsSync(feedbackPath)) {
        continue;
      }

      feedbackFiles.push({ file: feedbackPath, mtimeMs: statSync(feedbackPath).mtimeMs });
    }
  }

  feedbackFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return feedbackFiles.map((item) => item.file);
}

export function loadProjectLearningRules(projectId: string, cwd = process.cwd(), maxFeedbackFiles = 10): string[] {
  const files = listFeedbackFiles(projectId, cwd).slice(0, maxFeedbackFiles);
  const rules = new Set<string>();

  for (const file of files) {
    try {
      const feedback = JSON.parse(readFileSync(file, "utf8")) as Feedback;
      for (const rule of deriveLearningRules(feedback)) {
        rules.add(rule);
      }
    } catch {
      // ignore broken historical feedback and continue
    }
  }

  return Array.from(rules).sort();
}
