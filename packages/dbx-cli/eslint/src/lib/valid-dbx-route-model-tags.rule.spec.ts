import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { DBX_CLI_ESLINT_PLUGIN } from './plugin';

const RULE_ID = 'dereekb-dbx-cli/valid-dbx-route-model-tags';

function buildConfig(): Linter.Config[] {
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
      plugins: {
        'dereekb-dbx-cli': DBX_CLI_ESLINT_PLUGIN as any
      },
      rules: {
        [RULE_ID]: 'error'
      }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.component.ts' }).filter((m) => m.ruleId === RULE_ID);
}

function malformedCount(code: string): number {
  return lintCode(code).filter((m) => m.messageId === 'malformedRouteModelTag').length;
}

describe('valid-dbx-route-model-tags rule', () => {
  describe('valid tags', () => {
    it('passes a :param id key template on a component class', () => {
      const errors = lintCode(`
/**
 * @dbxRouteModel profile :uid - The profile
 */
export class WorkerComponent {}
`);
      expect(errors).toHaveLength(0);
    });

    it('passes a {authUid} id key template', () => {
      const errors = lintCode(`
/**
 * @dbxRouteModel profile {authUid}
 */
export class WorkerComponent {}
`);
      expect(errors).toHaveLength(0);
    });

    it('passes a multi-segment subcollection key template', () => {
      const errors = lintCode(`
/**
 * @dbxRouteModel guestbookEntry gb/:id/gbe/{authUid}
 */
export class EntryComponent {}
`);
      expect(errors).toHaveLength(0);
    });

    it('passes a list tag on an exported state const', () => {
      const errors = lintCode(`
import { type Ng2StateDeclaration } from '@uirouter/angular';
/**
 * @dbxRouteModelList guestbook
 */
export const GUESTBOOK_LIST_STATE: Ng2StateDeclaration = { name: 'demo.guestbook', url: '/guestbook' };
`);
      expect(errors).toHaveLength(0);
    });

    it('ignores JSDoc with no route-model tags', () => {
      const errors = lintCode(`
/**
 * A plain component.
 *
 * @param x - Unused.
 */
export class PlainComponent {}
`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('malformed tags', () => {
    it('flags a model tag missing its key template', () => {
      expect(
        malformedCount(`
/**
 * @dbxRouteModel profile
 */
export class WorkerComponent {}
`)
      ).toBe(1);
    });

    it('flags an invalid model-type identifier', () => {
      expect(
        malformedCount(`
/**
 * @dbxRouteModel 9bad :id
 */
export class WorkerComponent {}
`)
      ).toBe(1);
    });

    it('flags an odd-segment-count key template', () => {
      expect(
        malformedCount(`
/**
 * @dbxRouteModel thing gb/:id/extra
 */
export class ThingComponent {}
`)
      ).toBe(1);
    });

    it('flags a list tag that carries an extra token', () => {
      expect(
        malformedCount(`
/**
 * @dbxRouteModelList profile :id
 */
export class ListComponent {}
`)
      ).toBe(1);
    });

    it('flags an unknown @dbxRouteModel* tag name', () => {
      expect(
        malformedCount(`
/**
 * @dbxRouteModelWeird profile :id
 */
export class WeirdComponent {}
`)
      ).toBe(1);
    });

    it('flags a malformed tag declared on an exported state const', () => {
      expect(
        malformedCount(`
import { type Ng2StateDeclaration } from '@uirouter/angular';
/**
 * @dbxRouteModel worker :uid extra
 */
export const WORKER_STATE: Ng2StateDeclaration = { name: 'worker', url: '/worker' };
`)
      ).toBe(1);
    });
  });
});
