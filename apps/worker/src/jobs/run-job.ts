import { execSync } from "node:child_process";
import path from "node:path";
import { logger } from "@consulting-ppt/shared";

export interface WorkerJob {
  job_id: string;
  kind: "run";
  payload: {
    brief: string;
    project: string;
    threshold?: string;
    deterministic?: boolean;
    seed?: string;
    research?: string;
    layoutProvider?: string;
    layoutModel?: string;
  };
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export async function handleRunJob(job: WorkerJob, workspaceRoot: string): Promise<void> {
  const args = [
    "pnpm",
    "agent",
    "run",
    "--brief",
    quote(path.resolve(workspaceRoot, job.payload.brief)),
    "--project",
    quote(job.payload.project)
  ];

  if (job.payload.threshold) {
    args.push("--threshold", quote(job.payload.threshold));
  }

  if (job.payload.deterministic) {
    args.push("--deterministic");
    if (job.payload.seed) {
      args.push("--seed", quote(job.payload.seed));
    }
  }

  if (job.payload.research) {
    args.push("--research", quote(path.resolve(workspaceRoot, job.payload.research)));
  }

  if (job.payload.layoutProvider) {
    args.push("--layout-provider", quote(job.payload.layoutProvider));
  }

  if (job.payload.layoutModel) {
    args.push("--layout-model", quote(job.payload.layoutModel));
  }

  const command = args.join(" ");
  logger.info({ jobId: job.job_id, command }, "Worker executing run job");

  execSync(command, {
    cwd: workspaceRoot,
    stdio: "inherit"
  });
}
