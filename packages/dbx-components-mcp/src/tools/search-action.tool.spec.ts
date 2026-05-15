import { describe, expect, it } from 'vitest';
import { createActionRegistryFromEntries, type ActionEntryInfo } from '../registry/actions-runtime.js';
import { createSearchActionTool } from './search-action.tool.js';

const FIXTURE_ENTRIES: readonly ActionEntryInfo[] = [
  {
    role: 'directive',
    slug: 'action',
    selector: 'dbx-action,[dbxAction]',
    className: 'DbxActionDirective',
    module: '@dereekb/dbx-core',
    description: 'Root of the action context.',
    skillRefs: [],
    inputs: [],
    outputs: [],
    producesContext: true,
    consumesContext: false,
    stateInteraction: ['IDLE'],
    example: '<div dbxAction></div>'
  },
  {
    role: 'directive',
    slug: 'handler',
    selector: '[dbxActionHandler]',
    className: 'DbxActionHandlerDirective',
    module: '@dereekb/dbx-core',
    description: 'Wires a Work function as the action handler.',
    skillRefs: [],
    inputs: [],
    outputs: [],
    producesContext: false,
    consumesContext: true,
    stateInteraction: ['VALUE_READY'],
    example: '<div [dbxActionHandler]="handleSave"></div>'
  },
  {
    role: 'directive',
    slug: 'auto-trigger',
    selector: '[dbxActionAutoTrigger]',
    className: 'DbxActionAutoTriggerDirective',
    module: '@dereekb/dbx-core',
    description: 'Auto-fires the action when modified.',
    skillRefs: [],
    inputs: [],
    outputs: [],
    producesContext: false,
    consumesContext: true,
    stateInteraction: ['IDLE'],
    example: '<ng-container dbxActionAutoTrigger></ng-container>'
  },
  {
    role: 'store',
    slug: 'action-context-store',
    className: 'ActionContextStore',
    module: '@dereekb/dbx-core',
    description: 'NgRx ComponentStore that drives an action lifecycle.',
    skillRefs: [],
    methods: [],
    observables: [],
    disabledKeyDefaults: [],
    example: 'const store = inject(ActionContextStore);'
  },
  {
    role: 'state',
    slug: 'state-working',
    enumName: 'DbxActionState',
    stateValue: 'WORKING',
    literal: 'working',
    module: '@dereekb/dbx-core',
    description: 'Handler is in flight.',
    skillRefs: [],
    transitionsFrom: ['VALUE_READY'],
    transitionsTo: ['RESOLVED'],
    example: 'DbxActionState.WORKING'
  }
];

const REGISTRY = createActionRegistryFromEntries({ entries: FIXTURE_ENTRIES, loadedSources: ['fixture'] });
const TOOL = createSearchActionTool({ registry: REGISTRY });

describe('dbx_action_search', () => {
  it('exact slug match ranks the entry first', async () => {
    const result = (await TOOL.run({ query: 'handler' })) as { content: { text: string }[] };
    const text = result.content[0].text;
    expect(text).toContain('## `handler`');
  });

  it('selector token ranks the matching directive', async () => {
    const result = (await TOOL.run({ query: 'dbxActionAutoTrigger' })) as { content: { text: string }[] };
    const text = result.content[0].text;
    expect(text).toContain('## `auto-trigger`');
  });

  it('class name match finds the store', async () => {
    const result = (await TOOL.run({ query: 'ActionContextStore' })) as { content: { text: string }[] };
    const text = result.content[0].text;
    expect(text).toContain('## `action-context-store`');
  });

  it('state value match finds the state entry', async () => {
    const result = (await TOOL.run({ query: 'WORKING' })) as { content: { text: string }[] };
    const text = result.content[0].text;
    expect(text).toContain('## `state-working`');
  });

  it('role filter restricts the corpus', async () => {
    const result = (await TOOL.run({ query: 'action', role: 'state' })) as { content: { text: string }[] };
    const text = result.content[0].text;
    expect(text).not.toContain('## `handler`');
    expect(text).not.toContain('## `action-context-store`');
  });

  it('returns empty-state on no matches', async () => {
    const result = (await TOOL.run({ query: 'qqqzz' })) as { content: { text: string }[] };
    expect(result.content[0].text).toContain('No action entries matched');
  });

  it('rejects missing query', async () => {
    const result = (await TOOL.run({})) as { isError?: boolean; content: { text: string }[] };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });
});
