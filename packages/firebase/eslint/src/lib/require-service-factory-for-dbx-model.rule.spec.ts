import { afterAll, describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { FIREBASE_REQUIRE_SERVICE_FACTORY_FOR_DBX_MODEL_RULE, type FirebaseRequireServiceFactoryForDbxModelRuleOptions } from './require-service-factory-for-dbx-model.rule';

const RULE_ID = 'dereekb-firebase/require-service-factory-for-dbx-model';

function buildConfig(options: FirebaseRequireServiceFactoryForDbxModelRuleOptions): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-firebase': { rules: { 'require-service-factory-for-dbx-model': FIREBASE_REQUIRE_SERVICE_FACTORY_FOR_DBX_MODEL_RULE } } as any },
      rules: { [RULE_ID]: ['warn', options] }
    }
  ];
}

function lintWithOptions(code: string, options: FirebaseRequireServiceFactoryForDbxModelRuleOptions): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(options), { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
}

function lintCode(code: string, virtualFactoryModelTypes: readonly string[], ignoreModels?: readonly string[]): Linter.LintMessage[] {
  return lintWithOptions(code, { virtualFactoryModelTypes, ...(ignoreModels ? { ignoreModels } : {}) });
}

function messagesById(messages: Linter.LintMessage[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) out[m.messageId ?? 'unknown'] = (out[m.messageId ?? 'unknown'] ?? 0) + 1;
  return out;
}

describe('require-service-factory-for-dbx-model rule', () => {
  it('passes when a matching factory is registered', () => {
    const errors = lintCode(
      `
/**
 * @dbxModel
 */
export interface Guestbook { name: string; }
`,
      ['guestbook']
    );
    expect(errors).toHaveLength(0);
  });

  it('flags a @dbxModel interface with no matching factory', () => {
    const errors = lintCode(
      `
/**
 * @dbxModel
 */
export interface Guestbook { name: string; }
`,
      ['profile']
    );
    expect(messagesById(errors).modelHasNoServiceFactory).toBe(1);
  });

  it('ignores models listed in ignoreModels', () => {
    const errors = lintCode(
      `
/**
 * @dbxModel
 */
export interface Guestbook { name: string; }
`,
      ['profile'],
      ['Guestbook']
    );
    expect(errors).toHaveLength(0);
  });

  it('skips interfaces without the @dbxModel marker', () => {
    const errors = lintCode(
      `
export interface Guestbook { name: string; }
`,
      []
    );
    expect(errors).toHaveLength(0);
  });

  it('skips interfaces marked @dbxModelSubObject', () => {
    const errors = lintCode(
      `
/**
 * @dbxModelSubObject
 */
export interface GuestbookMeta { name: string; }
`,
      []
    );
    expect(errors).toHaveLength(0);
  });

  it('derives the expected modelType by lowercasing the first letter', () => {
    const errors = lintCode(
      `
/**
 * @dbxModel
 */
export interface GuestbookEntry { id: string; }
`,
      ['guestbook']
    );
    expect(messagesById(errors).modelHasNoServiceFactory).toBe(1);
  });

  it('passes when the camelCase derivation matches', () => {
    const errors = lintCode(
      `
/**
 * @dbxModel
 */
export interface GuestbookEntry { id: string; }
`,
      ['guestbookEntry']
    );
    expect(errors).toHaveLength(0);
  });
});

const SPEC_DIRECTORY: string = dirname(fileURLToPath(import.meta.url));
// Real in-repo demo factories (`@dbxModelServiceFactory guestbook`, ... in service.ts) — exercises
// the layout-agnostic glob + JSDoc-tag extraction end-to-end against actual source, no inline stubs.
const DEMO_MODEL_SOURCE_GLOB: string = resolve(SPEC_DIRECTORY, '../../../../../components/demo-firebase/src/lib/model/**/*.ts');

describe('require-service-factory-for-dbx-model real-source discovery', () => {
  it('resolves a consumer-own factory from real in-repo source via factorySearchRoots', () => {
    const errors = lintWithOptions(
      `
/**
 * @dbxModel
 */
export interface Guestbook { name: string; }
`,
      { factorySearchRoots: [DEMO_MODEL_SOURCE_GLOB] }
    );
    expect(errors).toHaveLength(0);
  });

  it('still flags a genuine orphan when resolving against real source', () => {
    const errors = lintWithOptions(
      `
/**
 * @dbxModel
 */
export interface TotallyMadeUpModel { name: string; }
`,
      { factorySearchRoots: [DEMO_MODEL_SOURCE_GLOB] }
    );
    expect(messagesById(errors).modelHasNoServiceFactory).toBe(1);
  });
});

// JSDoc `@dbxModelServiceFactory` tags survive into a package's shipped `.d.ts`, so factory discovery
// works against declaration files just as it does against source — this is the shape a downstream
// consumer's own compiled output / any non-source layout takes. Proven here against a temp fixture
// dir (the technique mirrors require-firestore-rule-for-service-model.rule.spec.ts).
const FACTORY_DTS_FIXTURE = `
/**
 * @dbxModelServiceFactory guestbook
 */
export declare const guestbookServiceFactory: unknown;
/**
 * @dbxModelServiceFactory guestbookEntry
 */
export declare const guestbookEntryServiceFactory: unknown;
`;

describe('require-service-factory-for-dbx-model .d.ts factory discovery', () => {
  const fixtureDirs: string[] = [];

  const writeFixtureDir = (contents: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'dbx-sf-dts-'));
    writeFileSync(join(dir, 'factories.d.ts'), contents, 'utf8');
    fixtureDirs.push(dir);
    return dir;
  };

  afterAll(() => {
    for (const dir of fixtureDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolves a factory declared in a .d.ts JSDoc tag', () => {
    const dir = writeFixtureDir(FACTORY_DTS_FIXTURE);
    const errors = lintWithOptions(
      `
/**
 * @dbxModel
 */
export interface GuestbookEntry { id: string; }
`,
      { factorySearchRoots: [join(dir, '**/*.ts')] }
    );
    expect(errors).toHaveLength(0);
  });

  it('flags a model absent from the .d.ts factory declarations', () => {
    const dir = writeFixtureDir(FACTORY_DTS_FIXTURE);
    const errors = lintWithOptions(
      `
/**
 * @dbxModel
 */
export interface Profile { id: string; }
`,
      { factorySearchRoots: [join(dir, '**/*.ts')] }
    );
    expect(messagesById(errors).modelHasNoServiceFactory).toBe(1);
  });
});
