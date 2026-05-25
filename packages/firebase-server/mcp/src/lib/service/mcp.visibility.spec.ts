import { classifyVisibility, resolveEffectiveReadOnly, resolveRequiredScope } from './mcp.visibility';
import { type McpVisibilityContext } from '@dereekb/firebase-server';

describe('classifyVisibility', () => {
  it('treats undefined as always-visible', () => {
    expect(classifyVisibility(undefined).visibilityKind).toBe('always');
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
