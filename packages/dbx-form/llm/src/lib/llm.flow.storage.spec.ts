import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MemoryStorageObject, SimpleStorageAccessor, StringifySimpleStorageAccessorConverter, StringStorageAccessor, WrapperSimpleStorageAccessorDelegate } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { BehaviorSubject, firstValueFrom, type Observable, throwError } from 'rxjs';
import { DBX_LLM_FLOW_RUN_INTERRUPTED_ERROR_CODE, type DbxLlmFlowAnySectionConfig, type DbxLlmFlowRun, type DbxLlmFlowState } from './llm.flow';
import { DbxLlmFlowStore } from './llm.flow.store';
import { type DbxLlmFlowPersistedState, DbxLlmFlowStorageSync, dbxLlmFlowPersistedStateFromState, dbxLlmFlowStateWithRestoredPersistedState } from './llm.flow.storage';
import { initialDbxLlmFlowState } from './llm.flow.state';

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
  it('should keep selected runs with their lineage, then the newest runs per section', () => {
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

    const persisted = dbxLlmFlowPersistedStateFromState(state, { maxRunsPerSection: 2 });
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

  function startSync(accessor = makeAccessor(), maxRunsPerSection?: number) {
    sync = new DbxLlmFlowStorageSync({ store: flowStore, accessor, storageKey$: storageKey, debounceTime: 0, maxRunsPerSection });
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

  it('should halve the max runs per section on a quota error', async () => {
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
    expect(sync?.maxRunsPerSection).toBe(2);
    expect(Object.keys((await firstValueFrom(accessor.get('one')))?.runs ?? {}).length).toBe(2);
  });
});
