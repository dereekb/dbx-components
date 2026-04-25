import { describe, expect, it } from 'vitest';
import { runLookupAction } from './lookup-action.tool.js';

function firstText(result: ReturnType<typeof runLookupAction>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_action_lookup', () => {
  it('rejects missing topic via arktype validation', () => {
    const result = runLookupAction({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('resolves a directive slug to a full entry with inputs and example', () => {
    const text = firstText(runLookupAction({ topic: 'handler' }));
    expect(text).toMatch(/# DbxActionHandlerDirective/);
    expect(text).toMatch(/\*\*selector:\*\* `\[dbxActionHandler\]`/);
    expect(text).toMatch(/## Inputs/);
    expect(text).toMatch(/`dbxActionHandler`/);
    expect(text).toMatch(/## State interaction/);
    expect(text).toMatch(/## Example/);
  });

  it('brief depth omits the inputs table and example fence', () => {
    const text = firstText(runLookupAction({ topic: 'handler', depth: 'brief' }));
    expect(text).toMatch(/# DbxActionHandlerDirective/);
    expect(text).not.toMatch(/## Inputs/);
    expect(text).not.toMatch(/## Example/);
    expect(text).toMatch(/State interaction/);
  });

  it('resolves a directive selector with brackets', () => {
    const text = firstText(runLookupAction({ topic: '[dbxActionAutoTrigger]' }));
    expect(text).toMatch(/# DbxActionAutoTriggerDirective/);
  });

  it('resolves a directive selector without brackets', () => {
    const text = firstText(runLookupAction({ topic: 'dbxActionAutoTrigger' }));
    expect(text).toMatch(/# DbxActionAutoTriggerDirective/);
  });

  it('resolves a directive class name (case-insensitive)', () => {
    const text = firstText(runLookupAction({ topic: 'DBXACTIONHANDLERDIRECTIVE' }));
    expect(text).toMatch(/# DbxActionHandlerDirective/);
  });

  it('resolves the store class name to the store entry with method/observable tables', () => {
    const text = firstText(runLookupAction({ topic: 'ActionContextStore' }));
    expect(text).toMatch(/# ActionContextStore/);
    expect(text).toMatch(/## Methods/);
    expect(text).toMatch(/## Observables/);
    expect(text).toMatch(/`trigger`/);
    expect(text).toMatch(/`actionState\$`/);
  });

  it('renders a transition diagram for a state member', () => {
    const text = firstText(runLookupAction({ topic: 'WORKING' }));
    expect(text).toMatch(/# DbxActionState\.WORKING/);
    expect(text).toMatch(/## Transitions/);
    expect(text).toMatch(/← VALUE_READY/);
    expect(text).toMatch(/→ RESOLVED, REJECTED/);
  });

  it('groups by role when the topic is `state`', () => {
    const text = firstText(runLookupAction({ topic: 'state' }));
    expect(text).toMatch(/# DbxActionState members/);
    expect(text).toMatch(/DbxActionState\.IDLE/);
    expect(text).toMatch(/DbxActionState\.RESOLVED/);
  });

  it('groups by role when the topic is `directive`', () => {
    const text = firstText(runLookupAction({ topic: 'directive' }));
    expect(text).toMatch(/# Action directives/);
    expect(text).toMatch(/DbxActionHandlerDirective/);
  });

  it('resolves the "list" alias to the full catalog grouped by role', () => {
    const text = firstText(runLookupAction({ topic: 'list' }));
    expect(text).toMatch(/# Action catalog/);
    expect(text).toMatch(/## Action directives/);
    expect(text).toMatch(/## Action stores/);
    expect(text).toMatch(/## DbxActionState members/);
  });

  it('suggests fuzzy candidates for partial-word queries', () => {
    const text = firstText(runLookupAction({ topic: 'autotri' }));
    expect(text).toMatch(/No action entry matched/);
    expect(text).toMatch(/Did you mean/);
    expect(text).toMatch(/dbxActionAutoTrigger/);
  });

  it('falls through to catalog hint when no substring overlap exists', () => {
    const text = firstText(runLookupAction({ topic: 'zzzz-not-a-thing' }));
    expect(text).toMatch(/No action entry matched/);
    expect(text).toMatch(/browse the catalog/);
  });
});
