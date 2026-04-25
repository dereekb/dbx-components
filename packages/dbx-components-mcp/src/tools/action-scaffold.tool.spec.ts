import { describe, expect, it } from 'vitest';
import { runActionScaffold } from './action-scaffold.tool.js';

function firstText(result: ReturnType<typeof runActionScaffold>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_action_scaffold', () => {
  it('rejects missing required args via arktype', () => {
    const result = runActionScaffold({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('rejects empty use_case after trim', () => {
    const result = runActionScaffold({ use_case: '   ', trigger: 'button', value_type: 'void' });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/use_case/);
  });

  it('renders a button + confirm + snackbar scaffold by default', () => {
    const text = firstText(
      runActionScaffold({
        use_case: 'delete account',
        trigger: 'button',
        confirm: true,
        success_feedback: 'snackbar',
        value_type: 'AccountId',
        result_type: 'void'
      })
    );
    expect(text).toMatch(/# Action scaffold — delete account/);
    expect(text).toMatch(/dbxAction/);
    expect(text).toMatch(/dbxActionValue/);
    expect(text).toMatch(/dbxActionPopoverConfirm/);
    expect(text).toMatch(/dbxActionSnackbar/);
    expect(text).toMatch(/dbxActionError/);
    expect(text).toMatch(/handleDeleteAccount/);
    expect(text).toMatch(/`dbx_action_examples pattern="button-confirm-delete"`/);
  });

  it('renders a form trigger with dbxActionForm and EnforceModified', () => {
    const text = firstText(
      runActionScaffold({
        use_case: 'submit settings',
        trigger: 'form',
        success_feedback: 'snackbar',
        value_type: 'SettingsValue',
        result_type: 'void'
      })
    );
    expect(text).toMatch(/<form /);
    expect(text).toMatch(/dbxActionForm/);
    expect(text).toMatch(/dbxActionEnforceModified/);
    expect(text).toMatch(/handleSubmitSettings/);
    expect(text).toMatch(/`dbx_action_examples pattern="form-submit"`/);
  });

  it('renders an auto-modify scaffold with auto-trigger + auto-modify directives', () => {
    const text = firstText(
      runActionScaffold({
        use_case: 'autosave settings',
        trigger: 'auto-modify',
        value_type: 'SettingsValue'
      })
    );
    expect(text).toMatch(/dbxActionAutoTrigger/);
    expect(text).toMatch(/dbxActionAutoModify/);
    expect(text).toMatch(/dbxActionForm/);
    expect(text).toMatch(/`dbx_action_examples pattern="auto-trigger-on-modify"`/);
  });

  it('uses [dbxActionSource] when context_provider is parent', () => {
    const text = firstText(
      runActionScaffold({
        use_case: 'submit child action',
        trigger: 'button',
        context_provider: 'parent',
        value_type: 'string'
      })
    );
    expect(text).toMatch(/\[dbxActionSource\]/);
    expect(text).toMatch(/ActionContextStoreSource/);
    expect(text).toMatch(/`dbx_action_examples pattern="provide-context-up"`/);
  });

  it('emits a redirect TODO when success_feedback is redirect', () => {
    const text = firstText(
      runActionScaffold({
        use_case: 'place order',
        trigger: 'button',
        success_feedback: 'redirect',
        value_type: 'OrderId'
      })
    );
    expect(text).toMatch(/successPair\$/);
    expect(text).toMatch(/redirect after success/);
  });

  it('omits snackbar directives and the dbx-error placeholder when success_feedback is none', () => {
    const text = firstText(
      runActionScaffold({
        use_case: 'compute summary',
        trigger: 'button',
        success_feedback: 'none',
        value_type: 'void'
      })
    );
    expect(text).not.toMatch(/dbxActionSnackbar/);
    expect(text).not.toMatch(/dbxActionError/);
  });
});
