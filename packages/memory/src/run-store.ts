import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dateFolder, Manifest, RunPaths } from "@consulting-ppt/shared";

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export function initRunStore(projectId: string, runId: string, cwd = process.cwd(), runDate = new Date()): RunPaths {
  const rootDate = dateFolder(runDate);
  const runRoot = path.join(cwd, "runs", rootDate, projectId, runId);
  const inputDir = path.join(runRoot, "input");
  const researchDir = path.join(runRoot, "research");
  const specDir = path.join(runRoot, "spec");
  const outputDir = path.join(runRoot, "output");
  const qaDir = path.join(runRoot, "qa");

  [runRoot, inputDir, researchDir, specDir, outputDir, qaDir].forEach(ensureDir);

  return {
    runRoot,
    inputDir,
    researchDir,
    specDir,
    outputDir,
    qaDir
  };
}

export function writeJson(target: string, value: unknown): void {
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeText(target: string, value: string): void {
  writeFileSync(target, value, "utf8");
}

export function writeManifest(paths: RunPaths, manifest: Manifest): void {
  writeJson(path.join(paths.runRoot, "manifest.json"), manifest);
}

function walkForRun(root: string, runId: string): string | null {
  const items = readdirSync(root, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(root, item.name);
    if (!item.isDirectory()) {
      continue;
    }

    if (item.name === runId) {
      return fullPath;
    }

    const next = walkForRun(fullPath, runId);
    if (next) {
      return next;
    }
  }
  return null;
}

export function findRunRootById(runId: string, cwd = process.cwd()): string | null {
  const runsRoot = path.join(cwd, "runs");
  try {
    if (!statSync(runsRoot).isDirectory()) {
      return null;
    }
  } catch {
    return null;
  }
  return walkForRun(runsRoot, runId);
}
