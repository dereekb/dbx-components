import { Linter } from 'eslint';
import * as templateParser from '@angular-eslint/template-parser';
import { DBX_WEB_ESLINT_PLUGIN } from './plugin';

const RULE_ID = 'dereekb-dbx-web/require-action-error-handler';

function makeConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.html'],
      languageOptions: { parser: templateParser },
      plugins: { 'dereekb-dbx-web': DBX_WEB_ESLINT_PLUGIN },
      rules: { [RULE_ID]: 'error' }
    }
  ] as unknown as Linter.Config[];
}

function lintTemplate(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, makeConfig(), { filename: 'test.html' }).filter((m) => m.ruleId === RULE_ID);
}

describe('require-action-error-handler rule', () => {
  describe('should pass', () => {
    it('dbxActionSnackbarError satisfies the rule', () => {
      const errors = lintTemplate(`<span dbxAction dbxActionSnackbarError dbxActionValue [dbxActionHandler]="h"><dbx-button dbxActionButton></dbx-button></span>`);
      expect(errors).toHaveLength(0);
    });

    it('a descendant [dbxActionError] satisfies the rule', () => {
      const errors = lintTemplate(`<div dbxAction dbxActionValue [dbxActionHandler]="h"><dbx-button dbxActionButton></dbx-button><dbx-error dbxActionError></dbx-error></div>`);
      expect(errors).toHaveLength(0);
    });

    it('[dbxActionErrorHandler] satisfies the rule', () => {
      const errors = lintTemplate(`<div dbxAction dbxActionValue [dbxActionHandler]="h" [dbxActionErrorHandler]="eh"><dbx-button dbxActionButton></dbx-button></div>`);
      expect(errors).toHaveLength(0);
    });

    it('an action with no handler and no trigger is out of scope', () => {
      const errors = lintTemplate(`<div dbxAction dbxActionValue></div>`);
      expect(errors).toHaveLength(0);
    });

    it('[dbxActionSource] on an ancestor bails', () => {
      const errors = lintTemplate(`<div [dbxActionSource]="src"><span dbxAction [dbxActionHandler]="h"><dbx-button dbxActionButton></dbx-button></span></div>`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('should fail', () => {
    it('handler with no error directive', () => {
      const errors = lintTemplate(`<span dbxAction dbxActionValue [dbxActionHandler]="h"><dbx-button dbxActionButton></dbx-button></span>`);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingErrorHandler');
    });

    it('trigger-only (no handler) with no error directive still fires', () => {
      const errors = lintTemplate(`<div dbxAction dbxActionValue><dbx-button dbxActionButton></dbx-button></div>`);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingErrorHandler');
    });

    it('a value source does not count as an error directive', () => {
      const errors = lintTemplate(`<span dbxAction [dbxActionValue]="v" [dbxActionHandler]="h"><dbx-button dbxActionButton></dbx-button></span>`);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingErrorHandler');
    });
  });
});
