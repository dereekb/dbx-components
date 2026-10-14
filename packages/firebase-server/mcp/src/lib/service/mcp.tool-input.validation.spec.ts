import { describe, it, expect, vi } from 'vitest';
import { formatMcpToolInputValidationErrors, mcpToolInputValidator } from './mcp.tool-input.validation';

const WHOAMI_LIKE_SCHEMA = {
  type: 'object',
  properties: {
    modelType: { type: 'string' },
    detail: { type: 'string', enum: ['summary', 'claims'] },
    keys: { type: 'array', items: { type: 'string' } },
    nested: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
  },
  required: ['modelType'],
  additionalProperties: false
};

describe('mcpToolInputValidator()', () => {
  it('should return undefined for valid args', () => {
    const validator = mcpToolInputValidator();
    expect(validator.validate(WHOAMI_LIKE_SCHEMA, { modelType: 'guestbook', detail: 'claims' })).toBeUndefined();
  });

  it('should format required, additionalProperties, enum and type errors one per line', () => {
    const validator = mcpToolInputValidator();
    const summary = validator.validate(WHOAMI_LIKE_SCHEMA, { detail: true, bogus: 1, keys: ['a', 2], nested: {} });
    const lines = summary?.split('\n') ?? [];

    expect(lines).toContain('modelType is required');
    expect(lines).toContain('bogus is not a parameter of this tool');
    expect(lines).toContain('detail must be one of "summary", "claims" (was true)');
    expect(lines).toContain('detail must be string (was true)');
    expect(lines).toContain('keys/1 must be string (was 2)');
    expect(lines).toContain('nested/id is required');
  });

  it('should use params as the path for a root type error', () => {
    const validator = mcpToolInputValidator();
    expect(validator.validate({ type: 'object' }, 'nope')).toBe('params must be object (was "nope")');
  });

  it('should not mutate the args', () => {
    const validator = mcpToolInputValidator();
    const args = { modelType: 'x' };
    validator.validate({ type: 'object', properties: { extra: { type: 'string', default: 'y' } } }, args);
    expect(args).toEqual({ modelType: 'x' });
  });

  it('should reuse the compiled schema', () => {
    const validator = mcpToolInputValidator();
    const schema = { type: 'object', properties: { a: { type: 'string' } } };

    expect(validator.validate(schema, { a: 1 })).toBeDefined();
    expect(validator.validate(schema, { a: 'ok' })).toBeUndefined();
    expect(validator.validate(schema, { a: 2 })).toBe('a must be string (was 2)');
  });

  it('should skip a schema that fails to compile with one warning', () => {
    const warn = vi.fn();
    const validator = mcpToolInputValidator({ warn });
    const badSchema = { type: 'object', properties: { a: { $ref: '#/definitions/missing' } } };

    expect(validator.validate(badSchema, { a: 1 })).toBeUndefined();
    expect(validator.validate(badSchema, { a: 2 })).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('formatMcpToolInputValidationErrors()', () => {
  it('should fall back to the ajv message for other keywords', () => {
    expect(formatMcpToolInputValidationErrors([{ keyword: 'minimum', instancePath: '/n', params: {}, message: 'must be >= 1', data: 0 }])).toBe('n must be >= 1 (was 0)');
  });
});
