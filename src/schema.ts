import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

export type JsonSchema = Record<string, unknown>;

export function createAjv(): Ajv {
  const ajv = new Ajv({
    allErrors: true,
    allowUnionTypes: true
  });
  addFormats(ajv);
  return ajv;
}

export function formatAjvErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) return 'unknown validation error';
  return errors
    .map((e) => {
      const at = e.instancePath && e.instancePath.length > 0 ? e.instancePath : '/';
      return `${at} ${e.message ?? 'is invalid'}`;
    })
    .join('; ');
}

export function compileValidator<T>(
  ajv: Ajv,
  schema: JsonSchema,
  label: string
): ValidateFunction<T> {
  try {
    return ajv.compile<T>(schema);
  } catch (err) {
    throw new Error(`Failed to compile JSON schema (${label}): ${(err as Error).message}`);
  }
}

export function validateOrThrow<T>(
  validate: ValidateFunction<T>,
  value: unknown,
  label: string
): asserts value is T {
  const ok = validate(value);
  if (!ok) {
    throw new Error(`Validation failed (${label}): ${formatAjvErrors(validate.errors)}`);
  }
}

/**
 * Validate a value against a JSON schema and return {valid, errors}
 */
export function validateSchema(
  schema: JsonSchema,
  value: unknown
): { valid: boolean; errors: string[] } {
  const ajv = createAjv();
  const validate = ajv.compile(schema);
  const valid = validate(value);

  if (!valid) {
    const errors = validate.errors
      ? validate.errors.map((e) => {
          const at = e.instancePath && e.instancePath.length > 0 ? e.instancePath : '/';
          return `${at} ${e.message ?? 'is invalid'}`;
        })
      : ['unknown validation error'];
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}