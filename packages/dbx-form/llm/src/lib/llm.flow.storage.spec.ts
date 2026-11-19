import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MemoryStorageObject, SimpleStorageAccessor, StringifySimpleStorageAccessorConverter, StringStorageAccessor, WrapperSimpleStorageAccessorDelegate } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { BehaviorSubject, firstValueFrom, type Observable, throwError } from 'rxjs';
import { DBX_LLM_FLOW_RUN_INTERRUPTED_ERROR_CODE, type DbxLlmFlowAnySectionConfig, type DbxLlmFlowRun, type DbxLlmFlowState } from './llm.flow';
import { DbxLlmFlowStore } from './llm.flow.store';
import { type DbxLlmFlowPersistedState, DbxLlmFlowStorageSync, dbxLlmFlowPersistedStateFromState, dbxLlmFlowStateWithReset, dbxLlmFlowStateWithRestoredPersistedState } from './llm.flow.storage';
import { type DbxLlmFlowStateContext, dbxLlmFlowStateWithCollapsed, dbxLlmFlowStateWithFormValue, dbxLlmFlowStateWithRegisteredSection, initialDbxLlmFlowState } from './llm.flow.state';

const SECTION: DbxLlmFlowAnySectionConfig = { key: 's', hasForm: true, initialDraft: { formValue: { topic: 'initial' } } };

let prefixCounter = 0;

function makeAccessor(): SimpleStorageAccessor<DbxLlmFlowPersistedState> {
  prefixCounter += 1;
  const delegate = new WrapperSimpleStorageAccessorDelegate<DbxLlmFlowPersistedState>(new StringStorageAccessor(new MemoryStorageObject()), new StringifySimpleStorageAccessorConverter());
  return new SimpleStorageAccessor(delegate, { prefix: `llmtest${prefixCounter}` });
}

function wait(ms = 5): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeRun(id: string, startedAt: number, extra?: Partial<DbxLlmFlowRun>): DbxLlmFlowRun {
  return { id, sectionKey: 's', kind: 'run', input: { rawInput: id }, state: 'success', startedAt: new Date(startedAt), finishedAt: new Date(startedAt + 1), ...extra };
}

describe('dbxLlmFlowPersistedStateFromState()', () => {
  it('should keep selected runs with their lineage, then the newest root runs per section', () => {
    const runs: Record<string, DbxLlmFlowRun> = {
      p1: makeRun('p1', 1, { sectionKey: 'p' }),
      old: makeRun('old', 2, { parentRunId: 'p1' }),
      a: makeRun('a', 10),
      b: makeRun('b', 11),
      c: makeRun('c', 12)
    };

    const state: DbxLlmFlowState = {
      ...initialDbxLlmFlowState(),
      runs,
      sections: {
        p: { key: 'p', draft: { rawInput: '' }, selectedRunIds: [], draftRevision: 0, mountCount: 0 },
        s: { key: 's', parentKey: 'p', draft: { rawInput: '' }, selectedRunIds: ['old'], draftRevision: 0, mountCount: 0 }
      }
    };

    const persisted = dbxLlmFlowPersistedStateFromState(state, { history: { maxRootRuns: 2, maxLeafRuns: 2 } });
    expect(Object.keys(persisted.runs).sort()).toEqual(['b', 'c', 'old', 'p1']);
    expect(persisted.runs['c'].startedAt).toBe(12);
    // eslint-disable-next-line unicorn/prefer-structured-clone -- checks the JSON round trip
    expect(JSON.parse(JSON.stringify(persisted))).toEqual(persisted);
  });
});

describe('dbxLlmFlowStateWithRestoredPersistedState()', () => {
  it('should interrupt running runs, filter selections and bump revisions', () => {
    const current: DbxLlmFlowState = { ...initialDbxLlmFlowState(), restoring: true, sections: { s: { key: 's', draft: { rawInput: '' }, selectedRunIds: [], draftRevision: 4, mountCount: 1, activeRunId: 'x' } } };
    const persisted: DbxLlmFlowPersistedState = {
      v: 1,
      sections: { s: { key: 's', draft: { rawInput: 'saved' }, selectedRunIds: ['ok', 'running', 'missing'] } },
      runs: {
        ok: { id: 'ok', sectionKey: 's', kind: 'a', input: { rawInput: 'x' }, state: 'success', startedAt: 1 },
        running: { id: 'running', sectionKey: 's', kind: 'b', input: { rawInput: 'x' }, state: 'running', startedAt: 2 }
      }
    };

    const result = dbxLlmFlowStateWithRestoredPersistedState(current, persisted, { now: new Date(100), sectionConfig: () => undefined, nextRequestId: () => 1 });
    const section = result.sections['s'];

    expect(result.restoring).toBe(false);
    expect(result.runs['ok'].startedAt).toEqual(new Date(1));
    expect(result.runs['running'].state).toBe('failed');
    expect(result.runs['running'].error?.code).toBe(DBX_LLM_FLOW_RUN_INTERRUPTED_ERROR_CODE);
    expect(section.selectedRunIds).toEqual(['ok']);
    expect(section.draft.rawInput).toBe('saved');
    expect(section.draftRevision).toBe(5);
    expect(section.activeRunId).toBeUndefined();
    expect(section.mountCount).toBe(1);
  });

  it('should restore a blank state from an unknown version', () => {
    const result = dbxLlmFlowStateWithRestoredPersistedState(initialDbxLlmFlowState(), { v: 2 } as unknown as DbxLlmFlowPersistedState, { now: new Date(), sectionConfig: () => undefined, nextRequestId: () => 1 });
    expect(result.runs).toEqual({});
  });
});

describe('collapsed sections', () => {
  const context = { now: new Date(100), sectionConfig: () => undefined, nextRequestId: () => 1 };

  function stateWithSections(collapsed: Record<string, boolean>): DbxLlmFlowState {
    const sections: DbxLlmFlowState['sections'] = {};

    for (const [key, value] of Object.entries(collapsed)) {
      sections[key] = { key, draft: { rawInput: '' }, selectedRunIds: [], draftRevision: 0, mountCount: 1, collapsed: value || undefined };
    }

    return { ...initialDbxLlmFlowState(), sections };
  }

  it('should set the collapsed state, keeping the same state when it does not change', () => {
    const state = stateWithSections({ a: false });
    const collapsed = dbxLlmFlowStateWithCollapsed(state, { key: 'a', collapsed: true });

    expect(collapsed.sections['a'].collapsed).toBe(true);
    expect(dbxLlmFlowStateWithCollapsed(collapsed, { key: 'a', collapsed: true })).toBe(collapsed);
    expect(dbxLlmFlowStateWithCollapsed(state, { key: 'a', collapsed: false })).toBe(state);
    expect(dbxLlmFlowStateWithCollapsed(state, { key: 'missing', collapsed: true })).toBe(state);
    expect(dbxLlmFlowStateWithCollapsed(collapsed, { key: 'a', collapsed: false }).sections['a'].collapsed).toBe(false);
  });

  it('should persist only the collapsed sections', () => {
    const persisted = dbxLlmFlowPersistedStateFromState(stateWithSections({ a: true, b: false }));

    expect(persisted.sections['a'].collapsed).toBe(true);
    expect('collapsed' in persisted.sections['b']).toBe(false);
  });

  it('should restore the saved collapsed state, and keep the current one for a section with nothing saved', () => {
    const current = stateWithSections({ a: false, b: true, c: true });
    const persisted: DbxLlmFlowPersistedState = {
      v: 1,
      sections: {
        a: { key: 'a', draft: { rawInput: '' }, selectedRunIds: [], collapsed: true },
        b: { key: 'b', draft: { rawInput: '' }, selectedRunIds: [] }
      },
      runs: {}
    };

    const result = dbxLlmFlowStateWithRestoredPersistedState(current, persisted, context);

    expect(result.sections['a'].collapsed).toBe(true);
    expect(result.sections['b'].collapsed).toBeFalsy();
    expect(result.sections['c'].collapsed).toBe(true);
  });

  it('should keep the collapsed state through a reset', () => {
    const result = dbxLlmFlowStateWithReset(stateWithSections({ a: true, b: false }), { restoring: false }, context);

    expect(result.sections['a'].collapsed).toBe(true);
    expect(result.sections['b'].collapsed).toBeFalsy();
  });
});

describe('DbxLlmFlowStorageSync', () => {
  let flowStore: DbxLlmFlowStore;
  let storageKey: BehaviorSubject<Maybe<string>>;
  let sync: Maybe<DbxLlmFlowStorageSync>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DbxLlmFlowStore] });
    flowStore = TestBed.inject(DbxLlmFlowStore);
    storageKey = new BehaviorSubject<Maybe<string>>('one');
    flowStore.registerSection({ key: 's', config: SECTION });
  });

  afterEach(() => {
    sync?.destroy();
    sync = undefined;
  });

  function startSync(accessor = makeAccessor(), maxRuns?: number) {
    if (maxRuns != null) {
      flowStore.setFlowConfig({ history: { maxRootRuns: maxRuns, maxLeafRuns: maxRuns } });
    }

    sync = new DbxLlmFlowStorageSync({ store: flowStore, accessor, storageKey$: storageKey, debounceTime: 0 });
    sync.init();
    return accessor;
  }

  it('should restore a blank state when the key is missing', () => {
    startSync();
    const state = flowStore.currentState();
    expect(state.restoring).toBe(false);
    expect(state.storageKey).toBe('one');
    expect(state.sections['s'].draft.formValue).toEqual({ topic: 'initial' });
  });

  it('should save debounced and restore with dates', async () => {
    const accessor = startSync();
    const run = flowStore.startRun('s', 'run').value!;
    flowStore.completeRun(run.runId, { text: 'out' });
    await wait();

    const saved = await firstValueFrom(accessor.get('one'));
    expect(saved?.runs[run.runId].state).toBe('success');
    expect(typeof saved?.runs[run.runId].startedAt).toBe('number');

    flowStore.resetFlow();
    flowStore.restorePersistedState(saved);
    expect(flowStore.currentState().runs[run.runId].startedAt).toBeInstanceOf(Date);
    expect(flowStore.currentState().sections['s'].selectedRunIds).toEqual([run.runId]);
  });

  it('should save the old key, reset, then restore the new key', async () => {
    const accessor = startSync();
    flowStore.loadDraft('s', { formValue: { topic: 'world one' } });
    storageKey.next('two');

    expect(flowStore.currentState().storageKey).toBe('two');
    expect(flowStore.currentState().sections['s'].draft.formValue).toEqual({ topic: 'initial' });
    expect((await firstValueFrom(accessor.get('one')))?.sections['s'].draft.formValue).toEqual({ topic: 'world one' });

    flowStore.loadDraft('s', { formValue: { topic: 'world two' } });
    storageKey.next('one');
    expect(flowStore.currentState().sections['s'].draft.formValue).toEqual({ topic: 'world one' });
  });

  it('should drop a run that finishes after its key switched, and restore it as interrupted', () => {
    startSync();
    const run = flowStore.startRun('s', 'run').value!;
    storageKey.next('two');
    flowStore.completeRun(run.runId, 'late');
    expect(flowStore.currentState().runs[run.runId]).toBeUndefined();

    storageKey.next('one');
    expect(flowStore.currentState().runs[run.runId].error?.code).toBe(DBX_LLM_FLOW_RUN_INTERRUPTED_ERROR_CODE);
  });

  it('should not write while restoring', async () => {
    const accessor = startSync();
    await wait();

    flowStore.beginRestore('one');
    flowStore.loadDraft('s', { formValue: { topic: 'restoring' } });
    await wait();

    expect((await firstValueFrom(accessor.get('one')))?.sections['s'].draft.formValue).toEqual({ topic: 'initial' });
  });

  it('should halve the history limits of what is written on a quota error, keeping the history in memory', async () => {
    const accessor = makeAccessor();
    const originalSet = accessor.set.bind(accessor);

    accessor.set = (key: string, value: DbxLlmFlowPersistedState): Observable<void> => {
      const tooMany = Object.keys(value.runs).length > 2;
      return tooMany ? throwError(() => Object.assign(new Error('quota'), { name: 'QuotaExceededError' })) : originalSet(key, value);
    };

    startSync(accessor, 8);

    for (let i = 0; i < 5; i += 1) {
      const run = flowStore.startRun('s', 'run').value!;
      flowStore.completeRun(run.runId, `out ${i}`);
    }

    await wait();
    expect(sync?.historyLimits).toEqual({ maxRootRuns: 2, maxLeafRuns: 2 });
    expect(Object.keys((await firstValueFrom(accessor.get('one')))?.runs ?? {}).length).toBe(2);
    expect(Object.keys(flowStore.currentState().runs).length).toBe(5);
  });
});

describe('view-only state', () => {
  const configs: Record<string, DbxLlmFlowAnySectionConfig> = {
    setup: { key: 'setup', viewOnly: true, initialDraft: { formValue: { look: 'noir' } } },
    prompt: { key: 'prompt', parentKey: 'setup' }
  };

  let stateRunId = 0;
  const context: DbxLlmFlowStateContext = { now: new Date(100), sectionConfig: (key) => configs[key], nextRequestId: () => 1, nextRunId: () => `s${(stateRunId += 1)}` };

  function mountedState(): DbxLlmFlowState {
    const state = dbxLlmFlowStateWithRegisteredSection(initialDbxLlmFlowState(), { key: 'setup' }, context);
    return dbxLlmFlowStateWithRegisteredSection(state, { key: 'prompt', parentKey: 'setup' }, context);
  }

  function selectedStateRun(state: DbxLlmFlowState): Maybe<DbxLlmFlowRun> {
    const runId = state.sections['setup'].selectedRunIds.at(-1);
    return runId == null ? undefined : state.runs[runId];
  }

  it('should persist the state with its state run, and restore both', () => {
    const state = dbxLlmFlowStateWithFormValue(mountedState(), { key: 'setup', formValue: { look: 'pastel' } }, context);
    // eslint-disable-next-line unicorn/prefer-structured-clone -- checks the JSON round trip
    const persisted = JSON.parse(JSON.stringify(dbxLlmFlowPersistedStateFromState(state))) as DbxLlmFlowPersistedState;
    const restored = dbxLlmFlowStateWithRestoredPersistedState(dbxLlmFlowStateWithReset(state, { restoring: true }, context), persisted, context);
    const run = selectedStateRun(restored);

    expect(restored.sections['setup'].draft.formValue).toEqual({ look: 'pastel' });
    expect(restored.sections['setup'].selectedRunIds).toEqual(state.sections['setup'].selectedRunIds);
    expect(run?.output).toEqual({ look: 'pastel' });
    expect(restored.sections['prompt'].followedParentRunId).toBe(run?.id);
  });

  it('should record the state of a view-only section saved without a state run', () => {
    const persisted: DbxLlmFlowPersistedState = {
      v: 1,
      sections: {
        setup: { key: 'setup', draft: { formValue: { look: 'neon' }, rawInput: '' }, selectedRunIds: [] },
        prompt: { key: 'prompt', parentKey: 'setup', draft: { rawInput: '' }, selectedRunIds: [] }
      },
      runs: {}
    };

    const restored = dbxLlmFlowStateWithRestoredPersistedState(dbxLlmFlowStateWithReset(mountedState(), { restoring: true }, context), persisted, context);
    const run = selectedStateRun(restored);

    expect(run?.output).toEqual({ look: 'neon' });
    expect(restored.sections['prompt'].followedParentRunId).toBe(run?.id);
  });

  it('should record the initial state after a reset', () => {
    const state = dbxLlmFlowStateWithFormValue(mountedState(), { key: 'setup', formValue: { look: 'pastel' } }, context);
    const reset = dbxLlmFlowStateWithReset(state, { restoring: false }, context);
    const run = selectedStateRun(reset);

    expect(reset.sections['setup'].draft.formValue).toEqual({ look: 'noir' });
    expect(run?.output).toEqual({ look: 'noir' });
    expect(reset.sections['prompt'].followedParentRunId).toBe(run?.id);
  });

  it('should not record state runs while a reset begins a restore', () => {
    const reset = dbxLlmFlowStateWithReset(mountedState(), { restoring: true }, context);
    expect(reset.runs).toEqual({});
    expect(reset.sections['setup'].selectedRunIds).toEqual([]);
  });
});
