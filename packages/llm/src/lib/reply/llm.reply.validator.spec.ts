import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { makeLlmSchemaValueValidator } from './llm.reply.validator';

describe('makeLlmSchemaValueValidator()', () => {
  const schema = type({ action: 'number', 'target?': 'number' });
  const validate = makeLlmSchemaValueValidator(schema);

  it('accepts a schema-valid value with true', () => {
    expect(validate({ action: 12 })).toBe(true);
    expect(validate({ action: 12, target: 71 })).toBe(true);
  });

  it('rejects a schema-invalid value with a non-empty error summary', () => {
    const verdict = validate({ action: 'nope' });
    expect(verdict).not.toBe(true);
    expect(typeof (verdict as { readonly error: string }).error).toBe('string');
    expect((verdict as { readonly error: string }).error.length).toBeGreaterThan(0);
  });

  it('rejects a value missing a required field', () => {
    const verdict = validate({ target: 71 });
    expect(verdict).not.toBe(true);
    expect((verdict as { readonly error: string }).error.length).toBeGreaterThan(0);
  });

  it('rejects a non-object value', () => {
    expect(validate(null)).not.toBe(true);
    expect(validate('not a value')).not.toBe(true);
  });
});
