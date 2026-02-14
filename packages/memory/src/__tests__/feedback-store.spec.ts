import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadProjectLearningRules } from "../feedback-store";

const createdRoots: string[] = [];

afterEach(() => {
  for (const root of createdRoots.splice(0, createdRoots.length)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function writeFeedback(root: string, date: string, projectId: string, runId: string, feedback: object): void {
  const dir = path.join(root, "runs", date, projectId, runId, "qa");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "feedback.json"), `${JSON.stringify(feedback, null, 2)}\n`, "utf8");
}

describe("loadProjectLearningRules", () => {
  it("loads and de-duplicates rules from project feedback history", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "memory-feedback-"));
    createdRoots.push(root);

    writeFeedback(root, "2026-02-14", "proj-a", "run-1", {
      run_id: "run-1",
      reviewer: "reviewer-1",
      score_breakdown: { logic: 80 },
      comments: [{ slide_id: "s1", category: "density", text: "간결화 필요" }],
      actions: ["tighten_governing_message"]
    });

    writeFeedback(root, "2026-02-15", "proj-a", "run-2", {
      run_id: "run-2",
      reviewer: "reviewer-2",
      score_breakdown: { logic: 82 },
      comments: [{ slide_id: "s2", category: "evidence", text: "근거 보강 필요" }],
      actions: ["force_evidence_for_numeric_claims"]
    });

    const rules = loadProjectLearningRules("proj-a", root);
    expect(rules).toEqual([
      "force_evidence_for_numeric_claims",
      "limit_bullets_to_5",
      "tighten_governing_message"
    ]);
  });
});
