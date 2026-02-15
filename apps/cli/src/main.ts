#!/usr/bin/env node
import { Command } from "commander";
import { logger } from "@consulting-ppt/shared";
import { feedbackCommand } from "./commands/feedback";
import { makeCommand } from "./commands/make";
import { qaCommand } from "./commands/qa";
import { runCommand } from "./commands/run";
import { thinkCommand } from "./commands/think";

const program = new Command();

program
  .name("consulting-ppt-agent")
  .description("Thinking → Making consulting PPT generator")
  .version("0.1.0");

program
  .command("run")
  .requiredOption("--brief <path>", "brief json path")
  .option("--project <id>", "project id override")
  .option("--threshold <number>", "QA threshold", "80")
  .option("--deterministic", "deterministic mode for reproducible output", false)
  .option("--seed <value>", "deterministic seed", "default-seed")
  .option("--research <path>", "optional external research pack json path")
  .option("--no-web-research", "disable live web research")
  .option("--web-research-attempts <number>", "minimum live web research attempts (>=30)", "30")
  .option("--web-research-timeout-ms <number>", "per-request timeout in milliseconds", "12000")
  .option("--web-research-concurrency <number>", "live web research concurrency", "6")
  .option("--layout-provider <name>", "layout planner provider (agentic|heuristic|openai|anthropic)", "agentic")
  .option("--layout-model <name>", "layout planner model name (optional)")
  .action(async (opts: {
    brief: string;
    project?: string;
    threshold: string;
    deterministic: boolean;
    seed: string;
    research?: string;
    webResearch?: boolean;
    webResearchAttempts?: string;
    webResearchTimeoutMs?: string;
    webResearchConcurrency?: string;
    layoutProvider?: string;
    layoutModel?: string;
  }) => {
    const result = await runCommand(opts);
    logger.info({ result }, "Run command finished");
  });

program
  .command("think")
  .requiredOption("--brief <path>", "brief json path")
  .option("--project <id>", "project id override")
  .option("--deterministic", "deterministic mode for reproducible output", false)
  .option("--seed <value>", "deterministic seed", "default-seed")
  .option("--research <path>", "optional external research pack json path")
  .option("--no-web-research", "disable live web research")
  .option("--web-research-attempts <number>", "minimum live web research attempts (>=30)", "30")
  .option("--web-research-timeout-ms <number>", "per-request timeout in milliseconds", "12000")
  .option("--web-research-concurrency <number>", "live web research concurrency", "6")
  .action(async (opts: {
    brief: string;
    project?: string;
    deterministic: boolean;
    seed: string;
    research?: string;
    webResearch?: boolean;
    webResearchAttempts?: string;
    webResearchTimeoutMs?: string;
    webResearchConcurrency?: string;
  }) => {
    const result = await thinkCommand(opts);
    logger.info({ result }, "Think command finished");
  });

program
  .command("make")
  .requiredOption("--spec <path>", "slidespec json path")
  .option("--layout-provider <name>", "layout planner provider (agentic|heuristic|openai|anthropic)", "agentic")
  .option("--layout-model <name>", "layout planner model name (optional)")
  .action(async (opts: { spec: string; layoutProvider?: string; layoutModel?: string }) => {
    const result = await makeCommand(opts);
    logger.info({ result }, "Make command finished");
  });

program
  .command("qa")
  .requiredOption("--run <path>", "run root path")
  .option("--threshold <number>", "QA threshold", "80")
  .action(async (opts: { run: string; threshold: string }) => {
    const result = await qaCommand(opts);
    logger.info({ result }, "QA command finished");
  });

program
  .command("feedback")
  .requiredOption("--run_id <id>", "run id")
  .requiredOption("--file <path>", "feedback file path")
  .action(async (opts: { run_id: string; file: string }) => {
    const result = await feedbackCommand(opts);
    logger.info({ result }, "Feedback command finished");
  });

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(
        {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          }
        },
        "CLI command failed"
      );
    } else {
      logger.error({ error }, "CLI command failed");
    }
    process.exitCode = 1;
  }
}

void main();
