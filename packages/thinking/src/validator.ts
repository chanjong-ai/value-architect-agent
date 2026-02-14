import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv2020, { ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { ValidationError } from "@consulting-ppt/shared";

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const cache = new Map<string, ValidateFunction<unknown>>();

function schemaPath(schemaFile: string): string {
  return path.resolve(__dirname, "../schemas", schemaFile);
}

function loadValidator(schemaFile: string): ValidateFunction<unknown> {
  const existing = cache.get(schemaFile);
  if (existing) {
    return existing;
  }

  const raw = readFileSync(schemaPath(schemaFile), "utf8");
  const schema = JSON.parse(raw) as object;
  const validator = ajv.compile(schema);
  cache.set(schemaFile, validator);
  return validator;
}

export function validateSchema<T>(schemaFile: string, data: T, label: string): T {
  const validator = loadValidator(schemaFile);
  const valid = validator(data);

  if (!valid) {
    const message = validator.errors
      ?.map((error) => `${error.instancePath || "/"} ${error.message}`)
      .join("; ");
    throw new ValidationError(`${label} schema validation failed: ${message ?? "unknown error"}`);
  }

  return data;
}
