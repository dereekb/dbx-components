import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_COMPANION_TAGS_RULE } from './require-dbx-model-firebase-index-companion-tags.rule';

const RULE_ID = 'dereekb-firebase/require-dbx-model-firebase-index-companion-tags';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-firebase': { rules: { 'require-dbx-model-firebase-index-companion-tags': FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_COMPANION_TAGS_RULE } } as any },
      rules: { [RULE_ID]: 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
}

function fixCode(code: string): string {
  const linter = new Linter({ configType: 'flat' });
  return linter.verifyAndFix(code, buildConfig(), { filename: 'test.ts' }).output;
}

function messagesById(messages: Linter.LintMessage[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) out[m.messageId ?? 'unknown'] = (out[m.messageId ?? 'unknown'] ?? 0) + 1;
  return out;
}

describe('require-dbx-model-firebase-index-companion-tags rule', () => {
  describe('migrated tag-format checks', () => {
    it('passes on canonical factory with constraint', () => {
      const errors = lintCode(`
import { where } from '@dereekb/firebase';
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel JobLocation
 */
export function jobLocationByStatusQuery() { return [where<JobLocation>('s', '==', 'ok')]; }
`);
      expect(errors).toHaveLength(0);
    });

    it('flags missing model', () => {
      const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexSkip true
 */
export function jobLocationByStatusQuery() {}
`);
      expect(messagesById(errors).missingModel).toBe(1);
    });

    it('flags non-pascal model identifier', () => {
      const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel job-location
 * @dbxModelFirebaseIndexSkip true
 */
export function fooQuery() {}
`);
      expect(messagesById(errors).invalidModelIdentifier).toBe(1);
    });

    it('flags invalid scope', () => {
      const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 * @dbxModelFirebaseIndexScope COLLECTION_BANANA
 * @dbxModelFirebaseIndexSkip true
 */
export function fooQuery() {}
`);
      expect(messagesById(errors).invalidScope).toBe(1);
    });

    it('allows multiple @dbxModelFirebaseIndexPath without duplicate flag', () => {
      const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 * @dbxModelFirebaseIndexPath fieldA, fieldB
 * @dbxModelFirebaseIndexPath fieldC, fieldD
 * @dbxModelFirebaseIndexSkip true
 */
export function fooQuery() {}
`);
      expect(messagesById(errors).duplicateCompanionTag ?? 0).toBe(0);
    });

    it('auto-fixes uppercase tags to lowercase', () => {
      const fixed = fixCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 * @dbxModelFirebaseIndexTags Bar, Baz
 * @dbxModelFirebaseIndexSkip true
 */
export function fooQuery() {}
`);
      expect(fixed).toContain('@dbxModelFirebaseIndexTags bar, baz');
    });

    it('flags unknown companion typo', () => {
      const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 * @dbxModelFirebaseIndexKategory misc
 * @dbxModelFirebaseIndexSkip true
 */
export function fooQuery() {}
`);
      expect(messagesById(errors).unknownDbxModelFirebaseIndexTag).toBe(1);
    });
  });

  describe('body coherence checks', () => {
    it('flags tagged factory with no constraint calls', () => {
      const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 */
export function fooQuery() { return []; }
`);
      expect(messagesById(errors).taggedFactoryHasNoConstraints).toBe(1);
    });

    it('flags generic-arg mismatch with @dbxModelFirebaseIndexModel', () => {
      const errors = lintCode(`
import { where } from '@dereekb/firebase';
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 */
export function fooQuery() { return [where<Bar>('field', '==', 1)]; }
`);
      expect(messagesById(errors).modelTagMismatchesGenericArg).toBe(1);
    });

    it('flags non-literal field path in tagged factory', () => {
      const errors = lintCode(`
import { where } from '@dereekb/firebase';
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 */
export function fooQuery(fieldName: string) { return [where<Foo>(fieldName, '==', 1)]; }
`);
      expect(messagesById(errors).nonLiteralFieldPathInTaggedQuery).toBe(1);
    });

    it('skips body coherence when @dbxModelFirebaseIndexSkip true', () => {
      const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 * @dbxModelFirebaseIndexSkip true
 */
export function fooQuery() {}
`);
      expect(messagesById(errors).taggedFactoryHasNoConstraints ?? 0).toBe(0);
    });

    it('allows where without generic argument', () => {
      const errors = lintCode(`
import { where } from '@dereekb/firebase';
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 */
export function fooQuery() { return [where('field', '==', 1)]; }
`);
      expect(messagesById(errors).modelTagMismatchesGenericArg ?? 0).toBe(0);
    });

    it('accepts limit() without flagging non-literal-field-path (no field arg)', () => {
      const errors = lintCode(`
import { where, limit } from '@dereekb/firebase';
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 */
export function fooQuery() { return [where<Foo>('f', '==', 1), limit(10)]; }
`);
      expect(messagesById(errors).nonLiteralFieldPathInTaggedQuery ?? 0).toBe(0);
    });
  });
});
