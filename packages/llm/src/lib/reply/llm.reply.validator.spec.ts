import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { llmSchemaLeverValidator } from './llm.reply.validator';

describe('llmSchemaLeverValidator()', () => {
  const schema = type({ action: 'number', 'target?': 'number' });
  const validate = llmSchemaLeverValidator(schema);

  it('accepts a schema-valid lever with true', () => {
    expect(validate({ action: 12 })).toBe(true);
    expect(validate({ action: 12, target: 71 })).toBe(true);
  });

  it('rejects a schema-invalid lever with a non-empty error summary', () => {
    const verdict = validate({ action: 'nope' });
    expect(verdict).not.toBe(true);
    expect(typeof (verdict as { readonly error: string }).error).toBe('string');
    expect((verdict as { readonly error: string }).error.length).toBeGreaterThan(0);
  });

  it('rejects a lever missing a required field', () => {
    const verdict = validate({ target: 71 });
    expect(verdict).not.toBe(true);
    expect((verdict as { readonly error: string }).error.length).toBeGreaterThan(0);
  });

  it('rejects a non-object lever', () => {
    expect(validate(null)).not.toBe(true);
    expect(validate('not a lever')).not.toBe(true);
  });
});
