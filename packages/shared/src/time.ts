import { createHash } from "node:crypto";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function dateFolder(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function createRunId(date = new Date()): string {
  const prefix = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${suffix}`;
}

export interface ExecutionClock {
  deterministic: boolean;
  seed: string;
  now: Date;
  nowIso: string;
  date: string;
  year: number;
}

function hashHex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function buildExecutionClock(options?: {
  deterministic?: boolean;
  seed?: string;
  inputHash?: string;
}): ExecutionClock {
  const deterministic = Boolean(options?.deterministic);
  const seed = options?.seed ?? "default-seed";

  if (!deterministic) {
    const now = new Date();
    return {
      deterministic,
      seed,
      now,
      nowIso: now.toISOString(),
      date: now.toISOString().slice(0, 10),
      year: now.getUTCFullYear()
    };
  }

  const digest = hashHex(`${seed}:${options?.inputHash ?? "no-input-hash"}`);
  const dayOffset = Number.parseInt(digest.slice(0, 6), 16) % 365;
  const secondOffset = Number.parseInt(digest.slice(6, 12), 16) % 86400;
  const baseEpoch = Date.UTC(2026, 0, 1, 0, 0, 0);
  const now = new Date(baseEpoch + dayOffset * 86400000 + secondOffset * 1000);

  return {
    deterministic,
    seed,
    now,
    nowIso: now.toISOString(),
    date: now.toISOString().slice(0, 10),
    year: now.getUTCFullYear()
  };
}

export function createDeterministicRunId(inputHash: string, seed = "default-seed"): string {
  const digest = hashHex(`${seed}:${inputHash}`);
  return `det_${digest.slice(0, 8)}_${digest.slice(8, 14)}`;
}
