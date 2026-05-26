import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { FIREBASE_REQUIRE_DBX_MODEL_SERVICE_FACTORY_TAG_RULE } from './require-dbx-model-service-factory-tag.rule';

const RULE_ID = 'dereekb-firebase/require-dbx-model-service-factory-tag';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-firebase': { rules: { 'require-dbx-model-service-factory-tag': FIREBASE_REQUIRE_DBX_MODEL_SERVICE_FACTORY_TAG_RULE } } as any },
      rules: { [RULE_ID]: 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
}

function messagesById(messages: Linter.LintMessage[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) out[m.messageId ?? 'unknown'] = (out[m.messageId ?? 'unknown'] ?? 0) + 1;
  return out;
}

describe('require-dbx-model-service-factory-tag rule', () => {
  it('passes when the export carries a valid @dbxModelServiceFactory tag', () => {
    const errors = lintCode(`
import { firebaseModelServiceFactory } from '@dereekb/firebase';
/**
 * @dbxModelServiceFactory guestbook
 */
export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory({ roleMapForModel: () => ({}), getFirestoreCollection: (c) => c });
`);
    expect(errors).toHaveLength(0);
  });

  it('flags missing tag', () => {
    const errors = lintCode(`
import { firebaseModelServiceFactory } from '@dereekb/firebase';
export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory({ roleMapForModel: () => ({}), getFirestoreCollection: (c) => c });
`);
    expect(messagesById(errors).factoryMissingTag).toBe(1);
  });

  it('flags missing tag when JSDoc exists without @dbxModelServiceFactory', () => {
    const errors = lintCode(`
import { firebaseModelServiceFactory } from '@dereekb/firebase';
/**
 * Some unrelated docstring.
 */
export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory({ roleMapForModel: () => ({}), getFirestoreCollection: (c) => c });
`);
    expect(messagesById(errors).factoryMissingTag).toBe(1);
  });

  it('flags empty tag value', () => {
    const errors = lintCode(`
import { firebaseModelServiceFactory } from '@dereekb/firebase';
/**
 * @dbxModelServiceFactory
 */
export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory({ roleMapForModel: () => ({}), getFirestoreCollection: (c) => c });
`);
    expect(messagesById(errors).factoryEmptyValue).toBe(1);
  });

  it('flags invalid (non-camelCase) value', () => {
    const errors = lintCode(`
import { firebaseModelServiceFactory } from '@dereekb/firebase';
/**
 * @dbxModelServiceFactory Guestbook
 */
export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory({ roleMapForModel: () => ({}), getFirestoreCollection: (c) => c });
`);
    expect(messagesById(errors).factoryInvalidValue).toBe(1);
  });

  it('flags kebab-case value', () => {
    const errors = lintCode(`
import { firebaseModelServiceFactory } from '@dereekb/firebase';
/**
 * @dbxModelServiceFactory guest-book
 */
export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory({ roleMapForModel: () => ({}), getFirestoreCollection: (c) => c });
`);
    expect(messagesById(errors).factoryInvalidValue).toBe(1);
  });

  it('flags duplicate tag', () => {
    const errors = lintCode(`
import { firebaseModelServiceFactory } from '@dereekb/firebase';
/**
 * @dbxModelServiceFactory guestbook
 * @dbxModelServiceFactory guestbookEntry
 */
export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory({ roleMapForModel: () => ({}), getFirestoreCollection: (c) => c });
`);
    expect(messagesById(errors).factoryDuplicateTag).toBe(1);
  });

  it('resolves a renamed import', () => {
    const errors = lintCode(`
import { firebaseModelServiceFactory as makeFactory } from '@dereekb/firebase';
/**
 * @dbxModelServiceFactory guestbook
 */
export const guestbookFirebaseModelServiceFactory = makeFactory({ roleMapForModel: () => ({}), getFirestoreCollection: (c) => c });
`);
    expect(errors).toHaveLength(0);
  });

  it('ignores calls to a same-named function from a different module', () => {
    const errors = lintCode(`
import { firebaseModelServiceFactory } from 'some-other-package';
export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory({ roleMapForModel: () => ({}), getFirestoreCollection: (c) => c });
`);
    expect(errors).toHaveLength(0);
  });

  it('flags a factory call not assigned to an exported variable', () => {
    const errors = lintCode(`
import { firebaseModelServiceFactory } from '@dereekb/firebase';
firebaseModelServiceFactory({ roleMapForModel: () => ({}), getFirestoreCollection: (c) => c });
`);
    expect(messagesById(errors).factoryNotOnExport).toBe(1);
  });

  it('passes on multiple factories in the same file when each is tagged', () => {
    const errors = lintCode(`
import { firebaseModelServiceFactory } from '@dereekb/firebase';
/**
 * @dbxModelServiceFactory guestbook
 */
export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory({ roleMapForModel: () => ({}), getFirestoreCollection: (c) => c });
/**
 * @dbxModelServiceFactory guestbookEntry
 */
export const guestbookEntryFirebaseModelServiceFactory = firebaseModelServiceFactory({ roleMapForModel: () => ({}), getFirestoreCollection: (c) => c });
`);
    expect(errors).toHaveLength(0);
  });

  it('flags only the untagged factory when one of two is tagged', () => {
    const errors = lintCode(`
import { firebaseModelServiceFactory } from '@dereekb/firebase';
/**
 * @dbxModelServiceFactory guestbook
 */
export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory({ roleMapForModel: () => ({}), getFirestoreCollection: (c) => c });
export const guestbookEntryFirebaseModelServiceFactory = firebaseModelServiceFactory({ roleMapForModel: () => ({}), getFirestoreCollection: (c) => c });
`);
    expect(messagesById(errors).factoryMissingTag).toBe(1);
  });
});
