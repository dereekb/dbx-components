import { classifyVisibility, mergeMcpToolHints, resolveEffectiveDestructive, resolveEffectiveReadOnly, resolveMcpToolAnnotations, resolveRequiredScope } from './mcp.visibility';
import { type McpVisibilityContext } from '@dereekb/firebase-server';

describe('classifyVisibility', () => {
  it('treats undefined as always-visible', () => {
    expect(classifyVisibility().visibilityKind).toBe('always');
  });

  it('treats true as always-visible', () => {
    expect(classifyVisibility(true).visibilityKind).toBe('always');
  });

  it('treats false as never-visible', () => {
    expect(classifyVisibility(false).visibilityKind).toBe('never');
  });

  it('classifies declarative rules and preserves the rule', () => {
    const rule = { requiredRoles: ['admin'], requireAuthenticated: true };
    const result = classifyVisibility(rule);
    expect(result.visibilityKind).toBe('declarative');
    expect(result.rule).toBe(rule);
    expect(result.visibilityFn).toBeUndefined();
  });

  it('classifies dynamic predicates and preserves the function', () => {
    const fn = (_ctx: McpVisibilityContext) => true;
    const result = classifyVisibility(fn);
    expect(result.visibilityKind).toBe('dynamic');
    expect(result.visibilityFn).toBe(fn);
    expect(result.rule).toBeUndefined();
  });
});

describe('resolveEffectiveReadOnly', () => {
  it('honors an explicit override regardless of call type', () => {
    expect(resolveEffectiveReadOnly(true, 'create')).toBe(true);
    expect(resolveEffectiveReadOnly(false, 'read')).toBe(false);
  });

  it('infers true for read and query', () => {
    expect(resolveEffectiveReadOnly(undefined, 'read')).toBe(true);
    expect(resolveEffectiveReadOnly(undefined, 'query')).toBe(true);
  });

  it('infers false for create, update, and delete', () => {
    expect(resolveEffectiveReadOnly(undefined, 'create')).toBe(false);
    expect(resolveEffectiveReadOnly(undefined, 'update')).toBe(false);
    expect(resolveEffectiveReadOnly(undefined, 'delete')).toBe(false);
  });

  it('leaves invoke and unknown call types undefined (treated as write by fail-safe)', () => {
    expect(resolveEffectiveReadOnly(undefined, 'invoke')).toBeUndefined();
    expect(resolveEffectiveReadOnly(undefined, 'standalone')).toBeUndefined();
    expect(resolveEffectiveReadOnly(undefined, 'customVerb')).toBeUndefined();
  });

  it('treats null override the same as undefined (re-infer)', () => {
    expect(resolveEffectiveReadOnly(null, 'read')).toBe(true);
    expect(resolveEffectiveReadOnly(null, 'create')).toBe(false);
    expect(resolveEffectiveReadOnly(null, 'invoke')).toBeUndefined();
  });
});

describe('resolveEffectiveDestructive', () => {
  it('honors an explicit override regardless of call type', () => {
    expect(resolveEffectiveDestructive(true, 'create')).toBe(true);
    expect(resolveEffectiveDestructive(false, 'delete')).toBe(false);
    expect(resolveEffectiveDestructive(false, 'invoke')).toBe(false);
  });

  it('infers false for create (additive)', () => {
    expect(resolveEffectiveDestructive(undefined, 'create')).toBe(false);
  });

  it('infers true for update and delete', () => {
    expect(resolveEffectiveDestructive(undefined, 'update')).toBe(true);
    expect(resolveEffectiveDestructive(undefined, 'delete')).toBe(true);
  });

  it('fails safe to true for invoke and custom verbs', () => {
    expect(resolveEffectiveDestructive(undefined, 'invoke')).toBe(true);
    expect(resolveEffectiveDestructive(undefined, 'customVerb')).toBe(true);
  });

  it('treats a null override the same as undefined (re-infer)', () => {
    expect(resolveEffectiveDestructive(null, 'create')).toBe(false);
    expect(resolveEffectiveDestructive(null, 'update')).toBe(true);
  });
});

describe('mergeMcpToolHints', () => {
  it('raises destructive and openWorld from any escalation', () => {
    expect(mergeMcpToolHints({ readOnly: false, destructive: false }, [{ openWorld: true }, { destructive: true }])).toEqual({ readOnly: false, destructive: true, openWorld: true });
  });

  it('never lowers a hint', () => {
    expect(mergeMcpToolHints({ readOnly: false, destructive: true, openWorld: true }, [{}])).toEqual({ readOnly: false, destructive: true, openWorld: true });
  });

  it('passes readOnly through', () => {
    expect(mergeMcpToolHints({ readOnly: undefined, destructive: false }, []).readOnly).toBeUndefined();
    expect(mergeMcpToolHints({ readOnly: true }, []).readOnly).toBe(true);
  });
});

describe('resolveMcpToolAnnotations', () => {
  it('maps a read-only classification to a readOnlyHint', () => {
    expect(resolveMcpToolAnnotations({ readOnly: true })).toEqual({ readOnlyHint: true });
  });

  it('advertises openWorldHint on a read-only tool when set', () => {
    expect(resolveMcpToolAnnotations({ readOnly: true, openWorld: true })).toEqual({ readOnlyHint: true, openWorldHint: true });
  });

  it('maps a known write without a destructive classification to readOnlyHint:false + destructiveHint', () => {
    expect(resolveMcpToolAnnotations({ readOnly: false })).toEqual({ readOnlyHint: false, destructiveHint: true });
  });

  it('fails safe: maps an unclassified verb (e.g. invoke) to a destructive write', () => {
    expect(resolveMcpToolAnnotations({})).toEqual({ readOnlyHint: false, destructiveHint: true });
  });

  it('maps an additive write to destructiveHint:false', () => {
    expect(resolveMcpToolAnnotations({ readOnly: false, destructive: false })).toEqual({ readOnlyHint: false, destructiveHint: false });
  });

  it('advertises openWorldHint on a write when set', () => {
    expect(resolveMcpToolAnnotations({ readOnly: false, destructive: false, openWorld: true })).toEqual({ readOnlyHint: false, destructiveHint: false, openWorldHint: true });
    expect(resolveMcpToolAnnotations({ readOnly: false, destructive: true, openWorld: false })).toEqual({ readOnlyHint: false, destructiveHint: true, openWorldHint: false });
  });
});

describe('resolveRequiredScope', () => {
  it('maps each CRUD call to its canonical model.* scope', () => {
    expect(resolveRequiredScope('create')).toBe('model.create');
    expect(resolveRequiredScope('read')).toBe('model.read');
    expect(resolveRequiredScope('update')).toBe('model.update');
    expect(resolveRequiredScope('delete')).toBe('model.delete');
    expect(resolveRequiredScope('query')).toBe('model.query');
    expect(resolveRequiredScope('invoke')).toBe('model.invoke');
  });

  it('returns nullish for unknown call types', () => {
    expect(resolveRequiredScope('standalone')).toBeFalsy();
    expect(resolveRequiredScope('customVerb')).toBeFalsy();
  });
});
