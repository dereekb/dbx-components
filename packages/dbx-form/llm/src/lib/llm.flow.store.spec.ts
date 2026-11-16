import { describe, it, expect, beforeEach } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { type DbxLlmFlowAnySectionConfig, type DbxLlmFlowSectionKey } from './llm.flow';
import { DbxLlmFlowStore } from './llm.flow.store';
import { DbxLlmFlowSectionStore } from './llm.flow.section.store';

interface Simple {
  readonly topic?: string;
}

const PARENT: DbxLlmFlowAnySectionConfig = { key: 'parent', hasForm: true, initialDraft: { formValue: { topic: 'a' } } };
const CHILD: DbxLlmFlowAnySectionConfig = { key: 'child', parentKey: 'parent' };

describe('DbxLlmFlowStore', () => {
  let flowStore: DbxLlmFlowStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DbxLlmFlowStore] });
    flowStore = TestBed.inject(DbxLlmFlowStore);
  });

  function makeSectionStore(config: DbxLlmFlowAnySectionConfig, parent?: Injector): DbxLlmFlowSectionStore<Simple, string> {
    const injector = Injector.create({ providers: [DbxLlmFlowSectionStore], parent: parent ?? TestBed.inject(Injector) });
    const store = injector.get(DbxLlmFlowSectionStore) as DbxLlmFlowSectionStore<Simple, string>;
    store.register({ config });
    return store;
  }

  function sectionState(key: DbxLlmFlowSectionKey) {
    return flowStore.currentState().sections[key];
  }

  describe('registerSection()', () => {
    it('should register the section and its config, and only unmount on destroy', async () => {
      const destroy = flowStore.registerSection({ key: 'parent', config: PARENT });
      expect(flowStore.sectionConfig('parent')).toBe(PARENT);
      expect((await firstValueFrom(flowStore.section$('parent')))?.mountCount).toBe(1);

      destroy();
      destroy();
      expect(sectionState('parent')?.mountCount).toBe(0);
      expect(flowStore.state().sections['parent']).toBeDefined();
    });
  });

  describe('startRun()', () => {
    it('should answer synchronously and record the run before returning', () => {
      flowStore.registerSection({ key: 'parent', config: PARENT });
      const result = flowStore.startRun('parent', 'run');

      expect(result.value).toBeDefined();
      expect(result.blockedReason).toBeUndefined();
      expect(flowStore.currentState().runs[result.value!.runId].state).toBe('running');

      const second = flowStore.startRun('parent', 'run');
      expect(second.value).toBeUndefined();
      expect(second.blockedReason).toBe('running');
    });

    it('should skip run ids that are already in use', () => {
      const ids = ['a', 'a', 'b'];
      flowStore.setFlowConfig({ runIdFactory: () => ids.shift() as string });
      flowStore.registerSection({ key: 'parent', config: PARENT });

      const first = flowStore.startRun('parent', 'run');
      flowStore.completeRun(first.value!.runId, 'out');
      const second = flowStore.startRun('parent', 'run');

      expect(first.value?.runId).toBe('a');
      expect(second.value?.runId).toBe('b');
    });
  });

  describe('run requests', () => {
    it('should not request a run without a mounted bridge', () => {
      flowStore.registerSection({ key: 'parent', config: PARENT });
      expect(flowStore.requestRun('parent', 'run')).toBe(false);
    });

    it('should let exactly one caller consume a request', () => {
      flowStore.registerSection({ key: 'parent', config: PARENT });
      flowStore.registerRunBridge('parent', 'run');
      expect(flowStore.requestRun('parent', 'run')).toBe(true);

      const request = flowStore.currentState().runRequests['parent'];
      expect(flowStore.consumeRunRequest('parent', request.id)).toBe(true);
      expect(flowStore.consumeRunRequest('parent', request.id)).toBe(false);
    });

    it('should rerun a run with its input', () => {
      flowStore.registerSection({ key: 'parent', config: PARENT });
      flowStore.registerRunBridge('parent', 'run');
      const run = flowStore.startRun('parent', 'run').value!;
      flowStore.completeRun(run.runId, 'out');
      flowStore.loadDraft('parent', { formValue: { topic: 'b' } });

      expect(flowStore.rerun(run.runId)).toBe(true);
      expect(sectionState('parent')?.draft.formValue).toEqual({ topic: 'a' });
      expect(flowStore.currentState().runRequests['parent']?.kind).toBe('run');
    });
  });

  describe('DbxLlmFlowSectionStore', () => {
    it('should emit the selection and status of the section', async () => {
      const parent = makeSectionStore(PARENT);
      expect(await firstValueFrom(parent.status$)).toBe('idle');

      const run = parent.startRun('run').value!;
      expect(await firstValueFrom(parent.status$)).toBe('running');
      expect(await firstValueFrom(parent.formLocked$)).toBe(true);

      parent.completeRun(run.runId, 'output');
      expect(await firstValueFrom(parent.status$)).toBe('success');
      expect(await firstValueFrom(parent.selectedOutput$)).toBe('output');
      expect(await firstValueFrom(parent.formLocked$)).toBe(false);
    });

    it('should use the nearest ancestor section as the parent', () => {
      const parentInjector = Injector.create({ providers: [DbxLlmFlowSectionStore], parent: TestBed.inject(Injector) });
      const parent = parentInjector.get(DbxLlmFlowSectionStore);
      parent.register({ config: { key: 'p' } });
      makeSectionStore({ key: 'c' }, parentInjector);

      expect(sectionState('c')?.parentKey).toBe('p');
    });

    it('should group history by the followed parent run', async () => {
      const parent = makeSectionStore(PARENT);
      const child = makeSectionStore(CHILD);

      const parentRun1 = parent.startRun('run').value!;
      parent.completeRun(parentRun1.runId, 'one');
      const childRun1 = child.startRun('run').value!;
      child.completeRun(childRun1.runId, 'c1');

      const parentRun2 = parent.startRun('run').value!;
      parent.completeRun(parentRun2.runId, 'two');

      const groups = await firstValueFrom(child.historyGroups$);
      expect(groups.current.length).toBe(0);
      expect(groups.other.map((x) => x.id)).toEqual([childRun1.runId]);
    });

    it('should only seed bindings with changes from other sources', () => {
      const parent = makeSectionStore(PARENT);
      const a = parent.registerFormBinding();
      const b = parent.registerFormBinding();
      const seedsA: unknown[] = [];
      const seedsB: unknown[] = [];

      parent.formSeed$(a.id).subscribe((x) => seedsA.push(x));
      parent.formSeed$(b.id).subscribe((x) => seedsB.push(x));
      expect(seedsA).toEqual([{ topic: 'a' }]);
      expect(seedsB).toEqual([{ topic: 'a' }]);

      parent.setDraftFormValue(a.id, { topic: 'from a' });
      expect(seedsA.length).toBe(1);
      expect(seedsB).toEqual([{ topic: 'a' }, { topic: 'from a' }]);

      parent.loadDraft({ formValue: { topic: 'store' } });
      expect(seedsA[1]).toEqual({ topic: 'store' });
      expect(seedsB[2]).toEqual({ topic: 'store' });
    });

    it('should combine the validity of every binding', () => {
      const parent = makeSectionStore(PARENT);
      const a = parent.registerFormBinding();
      const b = parent.registerFormBinding();

      parent.setFormValid(a.id, true);
      parent.setFormValid(b.id, false);
      expect(sectionState('parent')?.formValid).toBe(false);

      b.destroy();
      expect(sectionState('parent')?.formValid).toBe(true);

      a.destroy();
      expect(sectionState('parent')?.formValid).toBeUndefined();
    });

    it('should describe runs with the section config, then a default', () => {
      const parent = makeSectionStore({ ...PARENT, describeRun: (run) => ({ title: `custom ${run.kind}` }) });
      const run = parent.startRun('run').value!;
      const stored = flowStore.currentState().runs[run.runId];

      expect(parent.describeRun(stored).title).toBe('custom run');
    });

    it('should open the configured pop-out mode', () => {
      const parent = makeSectionStore({ ...PARENT, formPopout: { mode: 'detach' } });
      parent.openFormPopout();
      expect(parent.popout()).toBe('detach');

      parent.closeFormPopout();
      expect(parent.popout()).toBeUndefined();
    });
  });
});
