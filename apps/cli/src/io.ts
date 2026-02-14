import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

export function readJson<T>(filePath: string): T {
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

export function workspaceRoot(): string {
  return process.env.INIT_CWD ?? process.cwd();
}

export function normalizePath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  return path.resolve(workspaceRoot(), inputPath);
}
