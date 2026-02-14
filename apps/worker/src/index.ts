import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { logger } from "@consulting-ppt/shared";
import { handleRunJob, WorkerJob } from "./jobs/run-job";

const POLL_INTERVAL_MS = 4000;

function workspaceRoot(): string {
  return process.env.INIT_CWD ?? process.cwd();
}

function jobsDir(root: string): string {
  return path.join(root, "runs", "jobs");
}

function doneDir(root: string): string {
  return path.join(jobsDir(root), "done");
}

function failedDir(root: string): string {
  return path.join(jobsDir(root), "failed");
}

function ensureDirs(root: string): void {
  for (const dir of [jobsDir(root), doneDir(root), failedDir(root)]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

function listPendingJobFiles(root: string): string[] {
  return readdirSync(jobsDir(root))
    .filter((name) => name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => path.join(jobsDir(root), name));
}

function moveTo(targetDir: string, filePath: string): void {
  const baseName = path.basename(filePath);
  renameSync(filePath, path.join(targetDir, baseName));
}

async function processOne(root: string, filePath: string): Promise<void> {
  const raw = readFileSync(filePath, "utf8");
  const job = JSON.parse(raw) as WorkerJob;

  try {
    if (job.kind !== "run") {
      throw new Error(`Unsupported job kind: ${job.kind}`);
    }

    await handleRunJob(job, root);
    moveTo(doneDir(root), filePath);
    logger.info({ jobId: job.job_id }, "Worker job completed");
  } catch (error) {
    const failPath = path.join(failedDir(root), `${path.basename(filePath, ".json")}.error.log`);
    const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error);
    writeFileSync(failPath, `${message}\n`, "utf8");
    moveTo(failedDir(root), filePath);
    logger.error({ filePath, error }, "Worker job failed");
  }
}

async function poll(root: string): Promise<void> {
  const files = listPendingJobFiles(root);
  if (files.length === 0) {
    return;
  }

  await processOne(root, files[0]);
}

async function main(): Promise<void> {
  const root = workspaceRoot();
  ensureDirs(root);
  logger.info({ root, jobsDir: jobsDir(root) }, "Worker started");

  // simple polling loop for file-based queue jobs
  // expected payload: apps/worker/src/jobs/run-job.ts
  setInterval(() => {
    void poll(root);
  }, POLL_INTERVAL_MS);
}

void main();
