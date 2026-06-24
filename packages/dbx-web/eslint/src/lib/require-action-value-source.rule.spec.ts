import { Linter } from 'eslint';
import * as templateParser from '@angular-eslint/template-parser';
import { DBX_WEB_ESLINT_PLUGIN } from './plugin';

const RULE_ID = 'dereekb-dbx-web/require-action-value-source';

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

describe('require-action-value-source rule', () => {
  describe('should pass', () => {
    it('bare dbxActionValue provides a value', () => {
      const errors = lintTemplate(`<span dbxAction dbxActionValue [dbxActionHandler]="h"><dbx-button dbxActionButton></dbx-button></span>`);
      expect(errors).toHaveLength(0);
    });

    it('bound [dbxActionValue] provides a value', () => {
      const errors = lintTemplate(`<span dbxAction [dbxActionValue]="v" [dbxActionHandler]="h"><dbx-button dbxActionButton></dbx-button></span>`);
      expect(errors).toHaveLength(0);
    });

    it('[dbxActionForm] is a value source', () => {
      const errors = lintTemplate(`<form dbxAction [dbxActionForm]="f" [dbxActionHandler]="h"><dbx-button dbxActionButton></dbx-button></form>`);
      expect(errors).toHaveLength(0);
    });

    it('[dbxActionValueStream] is a value source', () => {
      const errors = lintTemplate(`<div dbxAction [dbxActionValueStream]="s" [dbxActionHandler]="h"><dbx-button dbxActionButton></dbx-button></div>`);
      expect(errors).toHaveLength(0);
    });

    it('no trigger present is out of scope', () => {
      const errors = lintTemplate(`<div dbxAction [dbxActionHandler]="h"><dbx-button></dbx-button></div>`);
      expect(errors).toHaveLength(0);
    });

    it('[dbxActionSource] on an ancestor bails (external store)', () => {
      const errors = lintTemplate(`<div [dbxActionSource]="src"><span dbxAction [dbxActionHandler]="h"><dbx-button dbxActionButton></dbx-button></span></div>`);
      expect(errors).toHaveLength(0);
    });

    it('a nested dbxAction makes the context ambiguous and bails', () => {
      const errors = lintTemplate(`<div dbxAction [dbxActionHandler]="h"><dbx-button dbxActionButton></dbx-button><div dbxAction dbxActionValue [dbxActionHandler]="h2"><dbx-button dbxActionButton></dbx-button></div></div>`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('should fail', () => {
    it('trigger with no value source hangs', () => {
      const errors = lintTemplate(`<span dbxAction [dbxActionHandler]="h"><dbx-button dbxActionButton></dbx-button></span>`);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingValueSource');
    });

    it('an error directive does not satisfy the value requirement', () => {
      const errors = lintTemplate(`<span dbxAction dbxActionSnackbarError [dbxActionHandler]="h"><dbx-button dbxActionButton></dbx-button></span>`);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingValueSource');
    });

    it('detects a trigger nested inside an @if control-flow block', () => {
      const errors = lintTemplate(`<div dbxAction [dbxActionHandler]="h">@if (x) { <dbx-button dbxActionButton></dbx-button> }</div>`);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingValueSource');
    });

    it('dbxActionAutoTrigger with no value source hangs', () => {
      const errors = lintTemplate(`<div dbxAction dbxActionAutoTrigger [dbxActionHandler]="h"></div>`);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingValueSource');
    });
  });
});
