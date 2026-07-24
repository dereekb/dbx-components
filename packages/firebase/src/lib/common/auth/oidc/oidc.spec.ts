import { oidcScopeTermSatisfied, oidcScopeTermsSatisfied, resolveEffectiveOidcScopeTerms, resolveOidcModelScopeRequirement, type OidcModelScopeRequirement } from './oidc';

const granted = (...scopes: string[]) => new Set(scopes);

describe('oidcScopeTermSatisfied', () => {
  it('a single-scope term is satisfied only when that exact scope is held', () => {
    expect(oidcScopeTermSatisfied('lms', granted('lms'))).toBe(true);
    expect(oidcScopeTermSatisfied('lms', granted('hellosubs'))).toBe(false);
    expect(oidcScopeTermSatisfied('lms', granted())).toBe(false);
  });

  it('an OR-group term is satisfied when ANY member is held', () => {
    const term = ['hellosubs', 'lms'];
    expect(oidcScopeTermSatisfied(term, granted('lms'))).toBe(true);
    expect(oidcScopeTermSatisfied(term, granted('hellosubs'))).toBe(true);
    expect(oidcScopeTermSatisfied(term, granted('other'))).toBe(false);
    expect(oidcScopeTermSatisfied(term, granted())).toBe(false);
  });

  it('an empty OR-group imposes no requirement (vacuously satisfied)', () => {
    expect(oidcScopeTermSatisfied([], granted())).toBe(true);
  });
});

describe('oidcScopeTermsSatisfied', () => {
  it('requires EVERY term to be satisfied (AND-of-ORs)', () => {
    const terms = ['model.create', ['hellosubs', 'lms']];
    expect(oidcScopeTermsSatisfied(terms, granted('model.create', 'lms'))).toBe(true);
    expect(oidcScopeTermsSatisfied(terms, granted('model.create', 'hellosubs'))).toBe(true);
    expect(oidcScopeTermsSatisfied(terms, granted('model.create'))).toBe(false); // group unsatisfied
    expect(oidcScopeTermsSatisfied(terms, granted('lms'))).toBe(false); // per-verb unsatisfied
  });

  it('an empty term list is vacuously satisfied', () => {
    expect(oidcScopeTermsSatisfied([], granted())).toBe(true);
  });
});

describe('resolveOidcModelScopeRequirement', () => {
  it('a single-term requirement applies to every verb', () => {
    expect(resolveOidcModelScopeRequirement('hellosubs', 'read')).toBe('hellosubs');
    expect(resolveOidcModelScopeRequirement(['hellosubs', 'lms'], 'create')).toEqual(['hellosubs', 'lms']);
  });

  it('a verb-keyed requirement returns the matching verb entry', () => {
    const req: OidcModelScopeRequirement = { read: ['hellosubs', 'lms'], default: 'hellosubs' };
    expect(resolveOidcModelScopeRequirement(req, 'read')).toEqual(['hellosubs', 'lms']);
  });

  it('a verb-keyed requirement falls back to its default for an unlisted verb', () => {
    const req: OidcModelScopeRequirement = { read: ['hellosubs', 'lms'], default: 'hellosubs' };
    expect(resolveOidcModelScopeRequirement(req, 'create')).toBe('hellosubs');
  });

  it('returns undefined when a verb-keyed requirement has neither the verb nor a default', () => {
    const req: OidcModelScopeRequirement = { read: 'lms' };
    expect(resolveOidcModelScopeRequirement(req, 'create')).toBeUndefined();
  });
});

describe('resolveEffectiveOidcScopeTerms', () => {
  it('composes [perVerbScope, effectiveGroupTerm] in order', () => {
    const terms = resolveEffectiveOidcScopeTerms({ perVerbScope: 'model.create', requiredScope: 'lms', call: 'create' });
    expect(terms).toEqual(['model.create', 'lms']);
  });

  it('precedence: per-function requiredScope wins over model + default', () => {
    const terms = resolveEffectiveOidcScopeTerms({ perVerbScope: 'model.create', requiredScope: 'lms', modelRequirement: 'hellosubs', call: 'create', defaultRequiredScope: 'other' });
    expect(terms).toEqual(['model.create', 'lms']);
  });

  it('precedence: model-level requirement beats the default', () => {
    const terms = resolveEffectiveOidcScopeTerms({ perVerbScope: 'model.read', modelRequirement: ['hellosubs', 'lms'], call: 'read', defaultRequiredScope: 'hellosubs' });
    expect(terms).toEqual(['model.read', ['hellosubs', 'lms']]);
  });

  it('precedence: falls through to the default when no finer term applies', () => {
    const terms = resolveEffectiveOidcScopeTerms({ perVerbScope: 'model.read', call: 'read', defaultRequiredScope: 'hellosubs' });
    expect(terms).toEqual(['model.read', 'hellosubs']);
  });

  it('resolves a verb-keyed model requirement for the call verb', () => {
    const modelRequirement: OidcModelScopeRequirement = { read: ['hellosubs', 'lms'], default: 'hellosubs' };
    expect(resolveEffectiveOidcScopeTerms({ perVerbScope: 'model.read', modelRequirement, call: 'read' })).toEqual(['model.read', ['hellosubs', 'lms']]);
    expect(resolveEffectiveOidcScopeTerms({ perVerbScope: 'model.create', modelRequirement, call: 'create' })).toEqual(['model.create', 'hellosubs']);
  });

  it('drops a nullish per-verb scope (custom verb) and keeps the group term', () => {
    const terms = resolveEffectiveOidcScopeTerms({ perVerbScope: undefined, call: 'archive', defaultRequiredScope: 'hellosubs' });
    expect(terms).toEqual(['hellosubs']);
  });

  it('yields an empty list when there is no requirement at all', () => {
    expect(resolveEffectiveOidcScopeTerms({ perVerbScope: undefined, call: 'archive' })).toEqual([]);
  });

  it('drops an empty OR-group group term', () => {
    expect(resolveEffectiveOidcScopeTerms({ perVerbScope: 'model.read', requiredScope: [], call: 'read' })).toEqual(['model.read']);
  });
});
