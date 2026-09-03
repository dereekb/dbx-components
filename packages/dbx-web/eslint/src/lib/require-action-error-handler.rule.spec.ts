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

function fixTemplate(code: string): string {
  const linter = new Linter({ configType: 'flat' });
  return linter.verifyAndFix(code, makeConfig(), { filename: 'test.html' }).output;
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

  describe('autofix', () => {
    it('appends dbxActionSnackbarError to the action host start tag', () => {
      const output = fixTemplate(`<span dbxAction dbxActionValue [dbxActionHandler]="h"><dbx-button dbxActionButton></dbx-button></span>`);
      expect(output).toBe(`<span dbxAction dbxActionValue [dbxActionHandler]="h" dbxActionSnackbarError><dbx-button dbxActionButton></dbx-button></span>`);
    });

    it('fixes the action host, not the nested trigger element', () => {
      const output = fixTemplate(`<div dbxAction dbxActionValue><dbx-button dbxActionButton></dbx-button></div>`);
      expect(output).toBe(`<div dbxAction dbxActionValue dbxActionSnackbarError><dbx-button dbxActionButton></dbx-button></div>`);
    });

    it('inserts inside the tag for a self-closing action host', () => {
      const output = fixTemplate(`<dbx-action dbxActionValue [dbxActionHandler]="h" />`);
      expect(output).toBe(`<dbx-action dbxActionValue [dbxActionHandler]="h" dbxActionSnackbarError />`);
    });

    it('the fixed output no longer reports', () => {
      const output = fixTemplate(`<span dbxAction dbxActionValue [dbxActionHandler]="h"><dbx-button dbxActionButton></dbx-button></span>`);
      expect(lintTemplate(output)).toHaveLength(0);
    });

    it('leaves an already-compliant template untouched', () => {
      const code = `<span dbxAction dbxActionSnackbarError dbxActionValue [dbxActionHandler]="h"><dbx-button dbxActionButton></dbx-button></span>`;
      expect(fixTemplate(code)).toBe(code);
    });
  });
});
