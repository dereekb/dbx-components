import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FIREBASE_ESLINT_PLUGIN } from './plugin';

const RULE_ID = 'dereekb-firebase/require-api-crud-spec-for-group';

function makeConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: {
        parser: tsParser,
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: 'module'
        }
      },
      plugins: { 'dereekb-firebase': FIREBASE_ESLINT_PLUGIN as any },
      rules: {
        [RULE_ID]: 'error'
      }
    }
  ];
}

function lintCode(filename: string, code = 'export {};'): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, makeConfig(), { filename }).filter((m) => m.ruleId === RULE_ID);
}

describe('require-api-crud-spec-for-group rule', () => {
  let tmpRoot: string;
  let withCrudGroup: string;
  let withSubgroupCrudGroup: string;
  let missingCrudGroup: string;
  let scenarioOnlyGroup: string;

  beforeAll(() => {
    // Workspace-root `/tmp` is gitignored; the lint config's `apps/**` glob does NOT match this
    // path, but the rule still fires because we drive Linter directly with explicit filenames.
    const tmpBase = join(process.cwd(), 'tmp', 'firebase-eslint-crud-coverage');
    mkdirSync(tmpBase, { recursive: true });
    tmpRoot = mkdtempSync(join(tmpBase, 'run-'));
    const functionDir = join(tmpRoot, 'src', 'app', 'function');

    withCrudGroup = join(functionDir, 'profile');
    mkdirSync(withCrudGroup, { recursive: true });
    writeFileSync(join(withCrudGroup, 'index.ts'), '');
    writeFileSync(join(withCrudGroup, 'profile.crud.spec.ts'), '');

    withSubgroupCrudGroup = join(functionDir, 'job');
    mkdirSync(withSubgroupCrudGroup, { recursive: true });
    writeFileSync(join(withSubgroupCrudGroup, 'index.ts'), '');
    writeFileSync(join(withSubgroupCrudGroup, 'job.crud.requirement.spec.ts'), '');

    missingCrudGroup = join(functionDir, 'worker');
    mkdirSync(missingCrudGroup, { recursive: true });
    writeFileSync(join(missingCrudGroup, 'index.ts'), '');
    writeFileSync(join(missingCrudGroup, 'worker.scenario.spec.ts'), '');

    scenarioOnlyGroup = join(functionDir, 'notification');
    mkdirSync(scenarioOnlyGroup, { recursive: true });
    writeFileSync(join(scenarioOnlyGroup, 'index.ts'), '');
    writeFileSync(join(scenarioOnlyGroup, 'notification.scenario.spec.ts'), '');
    writeFileSync(join(scenarioOnlyGroup, 'notification.scenario.send.spec.ts'), '');
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  describe('groups with a crud spec pass', () => {
    it('accepts a folder containing `<group>.crud.spec.ts`', () => {
      const errors = lintCode(join(withCrudGroup, 'index.ts'));
      expect(errors).toHaveLength(0);
    });

    it('accepts a folder containing only `<group>.crud.<sub>.spec.ts`', () => {
      const errors = lintCode(join(withSubgroupCrudGroup, 'index.ts'));
      expect(errors).toHaveLength(0);
    });
  });

  describe('groups missing a crud spec fail', () => {
    it('flags a folder with only a scenario spec', () => {
      const errors = lintCode(join(missingCrudGroup, 'index.ts'));
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('modelGroupMissingCrudSpec');
      expect(errors[0].message).toContain('worker.crud.spec.ts');
    });

    it('flags a folder with multiple scenario specs but no crud spec', () => {
      const errors = lintCode(join(scenarioOnlyGroup, 'index.ts'));
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('modelGroupMissingCrudSpec');
      expect(errors[0].message).toContain('notification.crud.spec.ts');
    });
  });

  describe('non-anchor paths are ignored', () => {
    it('does not fire on a sibling .ts (non-index)', () => {
      const errors = lintCode(join(missingCrudGroup, 'worker.scenario.spec.ts'));
      expect(errors).toHaveLength(0);
    });

    it('does not fire on an index.ts outside an API function folder', () => {
      const errors = lintCode(join(tmpRoot, 'src', 'app', 'function', 'index.ts'));
      expect(errors).toHaveLength(0);
    });
  });
});
