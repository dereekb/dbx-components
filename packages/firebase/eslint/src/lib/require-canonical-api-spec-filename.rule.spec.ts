import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { describe, expect, it } from 'vitest';
import { FIREBASE_ESLINT_PLUGIN } from './plugin';

const RULE_ID = 'dereekb-firebase/require-canonical-api-spec-filename';

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

function lintCode(filename: string, code = ''): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, makeConfig(), { filename }).filter((m) => m.ruleId === RULE_ID);
}

describe('require-canonical-api-spec-filename rule', () => {
  describe('canonical filenames are allowed', () => {
    it('accepts `<group>.crud.spec.ts`', () => {
      const errors = lintCode('apps/demo-api/src/app/function/profile/profile.crud.spec.ts');
      expect(errors).toHaveLength(0);
    });

    it('accepts `<group>.crud.<sub>.spec.ts`', () => {
      const errors = lintCode('apps/demo-api/src/app/function/job/job.crud.requirement.spec.ts');
      expect(errors).toHaveLength(0);
    });

    it('accepts `<group>.scenario.spec.ts`', () => {
      const errors = lintCode('apps/demo-api/src/app/function/notification/notification.scenario.spec.ts');
      expect(errors).toHaveLength(0);
    });

    it('accepts a deeply-nested canonical scenario-subgroup', () => {
      const errors = lintCode('apps/hellosubs-api/src/app/function/job/job.scenario.cancel.skippenalty.spec.ts');
      expect(errors).toHaveLength(0);
    });
  });

  describe('drift filenames are flagged', () => {
    it('flags `no-bucket` drift and suggests a scenario rename', () => {
      const errors = lintCode('apps/demo-api/src/app/function/profile/profile.function.spec.ts');
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('testFileMissingBucket');
      expect(errors[0].message).toContain('profile.scenario.function.spec.ts');
    });

    it('flags `scenario-misplaced` drift', () => {
      const errors = lintCode('apps/hellosubs-api/src/app/function/worker/worker.payroll.scenario.spec.ts');
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('testFileDriftRename');
      expect(errors[0].message).toContain('worker.scenario.payroll.spec.ts');
    });

    it('flags `crud-misplaced` drift', () => {
      const errors = lintCode('apps/hellosubs-api/src/app/function/worker/worker.pay.crud.spec.ts');
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('testFileDriftRename');
      expect(errors[0].message).toContain('worker.crud.pay.spec.ts');
    });

    it("flags `non-group` placement when filename prefix doesn't match parent folder", () => {
      const errors = lintCode('apps/demo-api/src/app/function/worker/job.crud.spec.ts');
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('testFileNonGroupPlacement');
      expect(errors[0].message).toContain('worker');
    });
  });

  describe('non-matching paths are ignored', () => {
    it('does not flag a `.spec.ts` outside an API function folder', () => {
      const errors = lintCode('packages/firebase/src/lib/model/profile.spec.ts');
      expect(errors).toHaveLength(0);
    });

    it('does not flag a non-spec file inside an API function folder', () => {
      const errors = lintCode('apps/demo-api/src/app/function/profile/profile.read.ts');
      expect(errors).toHaveLength(0);
    });
  });
});
