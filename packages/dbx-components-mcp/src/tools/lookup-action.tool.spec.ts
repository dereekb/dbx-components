import { describe, expect, it } from 'vitest';
import { createActionRegistryFromEntries, type ActionEntryInfo } from '../registry/actions-runtime.js';
import { createLookupActionTool } from './lookup-action.tool.js';

const FIXTURE_ENTRIES: readonly ActionEntryInfo[] = [
  {
    role: 'directive',
    slug: 'action',
    selector: 'dbx-action,[dbxAction]',
    className: 'DbxActionDirective',
    module: '@dereekb/dbx-core',
    description: 'Root of the action context.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/directive/context/action.directive.ts',
    inputs: [],
    outputs: [],
    producesContext: true,
    consumesContext: false,
    stateInteraction: ['IDLE'],
    example: '<div dbxAction>...</div>'
  },
  {
    role: 'directive',
    slug: 'handler',
    selector: '[dbxActionHandler]',
    className: 'DbxActionHandlerDirective',
    module: '@dereekb/dbx-core',
    description: 'Wires a `Work<T, O>` function as the action handler.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/directive/state/action.handler.directive.ts',
    inputs: [
      {
        alias: 'dbxActionHandler',
        propertyName: 'handlerFunction',
        type: 'Maybe<Work<T, O>>',
        required: true,
        description: 'The work function invoked when a value is ready.'
      }
    ],
    outputs: [],
    producesContext: false,
    consumesContext: true,
    stateInteraction: ['VALUE_READY', 'WORKING', 'RESOLVED', 'REJECTED'],
    example: '<div dbxAction [dbxActionHandler]="handleSave"></div>'
  },
  {
    role: 'directive',
    slug: 'auto-trigger',
    selector: 'dbxActionAutoTrigger,[dbxActionAutoTrigger]',
    className: 'DbxActionAutoTriggerDirective',
    module: '@dereekb/dbx-core',
    description: 'Auto-fires the action whenever it becomes modified.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/directive/auto/action.autotrigger.directive.ts',
    inputs: [],
    outputs: [],
    producesContext: false,
    consumesContext: true,
    stateInteraction: ['IDLE', 'TRIGGERED'],
    example: '<ng-container dbxActionAutoTrigger></ng-container>'
  },
  {
    role: 'store',
    slug: 'action-context-store',
    className: 'ActionContextStore',
    module: '@dereekb/dbx-core',
    description: 'NgRx ComponentStore that drives an action lifecycle.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/action.store.ts',
    methods: [{ name: 'trigger', signature: 'trigger(): void', description: 'Transitions IDLE → TRIGGERED.' }],
    observables: [{ name: 'actionState$', type: 'Observable<DbxActionState>', description: 'Current state.' }],
    disabledKeyDefaults: ['dbx_action_disabled'],
    example: 'const store = inject(ActionContextStore);'
  },
  {
    role: 'state',
    slug: 'state-idle',
    enumName: 'DbxActionState',
    stateValue: 'IDLE',
    literal: 'idle',
    module: '@dereekb/dbx-core',
    description: 'Default state.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/action.ts',
    transitionsFrom: ['RESOLVED', 'REJECTED', 'DISABLED'],
    transitionsTo: ['TRIGGERED', 'DISABLED'],
    example: 'DbxActionState.IDLE'
  },
  {
    role: 'state',
    slug: 'state-working',
    enumName: 'DbxActionState',
    stateValue: 'WORKING',
    literal: 'working',
    module: '@dereekb/dbx-core',
    description: 'Handler is in flight.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/action.ts',
    transitionsFrom: ['VALUE_READY'],
    transitionsTo: ['RESOLVED', 'REJECTED'],
    example: 'DbxActionState.WORKING'
  },
  {
    role: 'state',
    slug: 'state-resolved',
    enumName: 'DbxActionState',
    stateValue: 'RESOLVED',
    literal: 'resolved',
    module: '@dereekb/dbx-core',
    description: 'Handler succeeded.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/action.ts',
    transitionsFrom: ['WORKING'],
    transitionsTo: ['IDLE', 'DISABLED'],
    example: 'DbxActionState.RESOLVED'
  }
];

const tool = createLookupActionTool({
  registry: createActionRegistryFromEntries({ entries: FIXTURE_ENTRIES, loadedSources: ['@dereekb/dbx-core'] })
});

function runLookupAction(args: unknown): { isError?: boolean; content: { type: string; text: string }[] } {
  return tool.run(args) as { isError?: boolean; content: { type: string; text: string }[] };
}

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
