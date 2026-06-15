import { applyMcpReasonParameterToSchema, extractMcpReasonFromArgs, mcpSchemaDeclaresProperty, resolveMcpReasonParameterConfig, type ResolvedMcpReasonParameterConfig } from './mcp.reason';
import { DEFAULT_MCP_REASON_PARAMETER_DESCRIPTION, DEFAULT_MCP_REASON_PARAMETER_MAX_LENGTH, DEFAULT_MCP_REASON_PARAMETER_NAME } from '../mcp.config';

describe('resolveMcpReasonParameterConfig', () => {
  it('applies defaults (enabled) when given undefined', () => {
    expect(resolveMcpReasonParameterConfig(undefined)).toEqual({
      enabled: true,
      required: true,
      maxLength: DEFAULT_MCP_REASON_PARAMETER_MAX_LENGTH,
      description: DEFAULT_MCP_REASON_PARAMETER_DESCRIPTION,
      parameterName: DEFAULT_MCP_REASON_PARAMETER_NAME
    });
  });

  it('applies defaults (enabled) when given true', () => {
    expect(resolveMcpReasonParameterConfig(true).enabled).toBe(true);
    expect(resolveMcpReasonParameterConfig(true).maxLength).toBe(250);
  });

  it('disables but keeps defaults when given false', () => {
    const resolved = resolveMcpReasonParameterConfig(false);
    expect(resolved.enabled).toBe(false);
    expect(resolved.maxLength).toBe(DEFAULT_MCP_REASON_PARAMETER_MAX_LENGTH);
    expect(resolved.parameterName).toBe(DEFAULT_MCP_REASON_PARAMETER_NAME);
  });

  it('applies per-field overrides on top of the defaults', () => {
    const resolved = resolveMcpReasonParameterConfig({ required: false, maxLength: 100, description: 'why', parameterName: 'justification' });
    expect(resolved).toEqual({ enabled: true, required: false, maxLength: 100, description: 'why', parameterName: 'justification' });
  });

  it('honors enabled:false on an object', () => {
    expect(resolveMcpReasonParameterConfig({ enabled: false }).enabled).toBe(false);
  });
});

describe('mcpSchemaDeclaresProperty', () => {
  it('returns true when the property exists', () => {
    expect(mcpSchemaDeclaresProperty({ type: 'object', properties: { reason: { type: 'string' } } }, 'reason')).toBe(true);
  });

  it('returns false when the property is absent', () => {
    expect(mcpSchemaDeclaresProperty({ type: 'object', properties: { name: { type: 'string' } } }, 'reason')).toBe(false);
  });

  it('returns false for a schema with no properties or for undefined', () => {
    expect(mcpSchemaDeclaresProperty({ type: 'object' }, 'reason')).toBe(false);
    expect(mcpSchemaDeclaresProperty(undefined, 'reason')).toBe(false);
  });
});

describe('applyMcpReasonParameterToSchema', () => {
  const resolved: ResolvedMcpReasonParameterConfig = { enabled: true, required: true, maxLength: 250, description: 'a reason', parameterName: 'reason' };

  it('adds a string reason property with the configured maxLength + description', () => {
    const input = { type: 'object', properties: { name: { type: 'string' } } };
    const result = applyMcpReasonParameterToSchema(input, resolved) as { properties: Record<string, unknown> };
    expect(result.properties.reason).toEqual({ type: 'string', maxLength: 250, description: 'a reason' });
    expect(result.properties.name).toEqual({ type: 'string' });
  });

  it('adds the parameter name to required when required is true', () => {
    const input = { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] };
    const result = applyMcpReasonParameterToSchema(input, resolved) as { required: ReadonlyArray<string> };
    expect(result.required).toEqual(['name', 'reason']);
  });

  it('initializes required when the input had none', () => {
    const result = applyMcpReasonParameterToSchema({ type: 'object', properties: {} }, resolved) as { required: ReadonlyArray<string> };
    expect(result.required).toEqual(['reason']);
  });

  it('does not add to required when required is false', () => {
    const result = applyMcpReasonParameterToSchema({ type: 'object', properties: {} }, { ...resolved, required: false }) as { required?: ReadonlyArray<string> };
    expect(result.required).toBeUndefined();
  });

  it('returns the same reference (skips) when disabled', () => {
    const input = { type: 'object', properties: {} };
    expect(applyMcpReasonParameterToSchema(input, { ...resolved, enabled: false })).toBe(input);
  });

  it('returns the same reference (skips) when the schema already declares the field', () => {
    const input = { type: 'object', properties: { reason: { type: 'string', description: 'handler-owned' } } };
    expect(applyMcpReasonParameterToSchema(input, resolved)).toBe(input);
  });

  it('does not mutate the input schema', () => {
    const input = { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] };
    const snapshot = structuredClone(input);
    applyMcpReasonParameterToSchema(input, resolved);
    expect(input).toEqual(snapshot);
  });

  it('defends against a schema with no properties block', () => {
    const result = applyMcpReasonParameterToSchema({ type: 'object' }, resolved) as { type: string; properties: Record<string, unknown> };
    expect(result.type).toBe('object');
    expect(result.properties.reason).toBeDefined();
  });

  it('honors a custom parameterName', () => {
    const result = applyMcpReasonParameterToSchema({ type: 'object', properties: {} }, { ...resolved, parameterName: 'justification' }) as { properties: Record<string, unknown>; required: ReadonlyArray<string> };
    expect(result.properties.justification).toBeDefined();
    expect(result.required).toEqual(['justification']);
  });
});

describe('extractMcpReasonFromArgs', () => {
  const resolved: ResolvedMcpReasonParameterConfig = { enabled: true, required: true, maxLength: 250, description: 'a reason', parameterName: 'reason' };

  it('strips the reason key and returns the value', () => {
    const { reason, args } = extractMcpReasonFromArgs({ reason: 'because', foo: 1 }, resolved, false);
    expect(reason).toBe('because');
    expect(args).toEqual({ foo: 1 });
  });

  it('clamps a value longer than maxLength', () => {
    const long = 'x'.repeat(300);
    const { reason } = extractMcpReasonFromArgs({ reason: long }, resolved, false);
    expect(reason).toHaveLength(250);
  });

  it('treats an empty string as undefined', () => {
    const { reason, args } = extractMcpReasonFromArgs({ reason: '', foo: 1 }, resolved, false);
    expect(reason).toBeUndefined();
    expect(args).toEqual({ foo: 1 });
  });

  it('coerces a non-string value to string', () => {
    const { reason } = extractMcpReasonFromArgs({ reason: 42 }, resolved, false);
    expect(reason).toBe('42');
  });

  it('no-ops (does not strip) when disabled', () => {
    const args = { reason: 'because', foo: 1 };
    const result = extractMcpReasonFromArgs(args, { ...resolved, enabled: false }, false);
    expect(result.reason).toBeUndefined();
    expect(result.args).toBe(args);
  });

  it('no-ops (does not strip) when the tool declares its own reason field', () => {
    const args = { reason: 'handler-owned', foo: 1 };
    const result = extractMcpReasonFromArgs(args, resolved, true);
    expect(result.reason).toBeUndefined();
    expect(result.args).toBe(args);
    expect(result.args.reason).toBe('handler-owned');
  });

  it('returns reason undefined and original args when the key is absent', () => {
    const args = { foo: 1 };
    const result = extractMcpReasonFromArgs(args, resolved, false);
    expect(result.reason).toBeUndefined();
    expect(result.args).toBe(args);
  });

  it('does not mutate the input args when stripping', () => {
    const args = { reason: 'because', foo: 1 };
    extractMcpReasonFromArgs(args, resolved, false);
    expect(args).toEqual({ reason: 'because', foo: 1 });
  });
});
