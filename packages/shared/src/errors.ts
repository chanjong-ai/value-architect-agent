export class AppError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message);
    this.name = "ValidationError";
  }
}

export class PipelineError extends AppError {
  constructor(message: string) {
    super("PIPELINE_ERROR", message);
    this.name = "PipelineError";
  }
}
