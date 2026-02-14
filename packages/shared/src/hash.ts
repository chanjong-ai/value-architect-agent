import { createHash } from "node:crypto";

export function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashJson(value: unknown): string {
  return hashString(JSON.stringify(value));
}
