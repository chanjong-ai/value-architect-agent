import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignoredPaths = new Set([
  "scripts/public-readiness-check.mjs",
  "artifacts/nightly-regression.md"
]);

const binaryExt = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".pptx",
  ".zip",
  ".gz",
  ".zst",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".mp3",
  ".mp4",
  ".mov"
]);

const checks = [
  {
    id: "specific-customer-name",
    description: "specific customer/company name",
    regex: /(포스코|에코프로|LG화학|LG에너지솔루션|삼성SDI|SK온|POSCO|EcoPro|LG Chem|LG Energy Solution|Samsung SDI|SK On)/i
  },
  {
    id: "deleted-brief-reference",
    description: "reference to deleted company-specific brief/research sample",
    regex: /(brief\.(posco|ecopro|ecoprobm|lgchem|lges|samsungsdi|skon).*\.json|research\.(ecopro|ecoprobm)\.ko\.json)/i
  },
  {
    id: "consulting-firm-direct-mention",
    description: "direct mention of named consulting firms",
    regex: /(McKinsey|BCG|맥킨지)/i
  }
];

function getTrackedFiles() {
  const output = execSync("git ls-files -z", {
    cwd: root,
    encoding: "utf8"
  });
  return output
    .split("\0")
    .map((file) => file.trim())
    .filter(Boolean)
    .filter((file) => !ignoredPaths.has(file));
}

function isLikelyTextFile(file) {
  const ext = path.extname(file).toLowerCase();
  return !binaryExt.has(ext);
}

function scanFile(file) {
  if (!isLikelyTextFile(file)) {
    return [];
  }

  const absolutePath = path.join(root, file);
  let content = "";
  try {
    content = fs.readFileSync(absolutePath, "utf8");
  } catch {
    return [];
  }

  const findings = [];
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const check of checks) {
      if (check.regex.test(line)) {
        findings.push({
          file,
          line: index + 1,
          checkId: check.id,
          description: check.description,
          text: line.trim().slice(0, 180)
        });
      }
    }
  });
  return findings;
}

function run() {
  const files = getTrackedFiles();
  const findings = files.flatMap((file) => scanFile(file));

  if (findings.length === 0) {
    console.log("[public-check] PASS: no restricted terms/references found in tracked files.");
    return;
  }

  console.error(`[public-check] FAIL: ${findings.length} issue(s) detected.`);
  findings.slice(0, 200).forEach((finding) => {
    console.error(
      `- ${finding.file}:${finding.line} [${finding.checkId}] ${finding.description}\n  ${finding.text}`
    );
  });

  if (findings.length > 200) {
    console.error(`... ${findings.length - 200} more issue(s) omitted.`);
  }

  process.exitCode = 1;
}

run();
