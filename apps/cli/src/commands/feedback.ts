import { Feedback, logger } from "@consulting-ppt/shared";
import { deriveLearningRules, storeFeedback } from "@consulting-ppt/memory";
import { validateSchema } from "@consulting-ppt/thinking";
import { readJson, normalizePath, workspaceRoot } from "../io";

export interface FeedbackCommandOptions {
  run_id: string;
  file: string;
}

export async function feedbackCommand(options: FeedbackCommandOptions): Promise<{ storedAt: string; rules: string[] }> {
  const feedbackPath = normalizePath(options.file);
  const feedback = readJson<Feedback>(feedbackPath);
  const patchedFeedback: Feedback = {
    ...feedback,
    run_id: options.run_id
  };

  validateSchema("feedback.schema.json", patchedFeedback, "feedback");
  const storedAt = storeFeedback(patchedFeedback, workspaceRoot());
  const rules = deriveLearningRules(patchedFeedback);

  logger.info({ runId: patchedFeedback.run_id, storedAt, rules }, "Feedback ingested");
  return { storedAt, rules };
}
