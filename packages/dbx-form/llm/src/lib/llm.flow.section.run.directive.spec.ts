import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal, viewChild, viewChildren } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { DbxActionDirective, DbxActionHandlerDirective, completeOnDestroy } from '@dereekb/dbx-core';
import { firstValueFrom, of, Subject, first } from 'rxjs';
import { type DbxLlmFlowAnySectionConfig, type DbxLlmFlowRunValue } from './llm.flow';
import { DbxLlmFlowDirective } from './llm.flow.directive';
import { DbxLlmFlowSectionDirective } from './llm.flow.section.directive';
import { DbxLlmFlowSectionRunDirective } from './llm.flow.section.run.directive';
import { type DbxLlmFlowStore } from './llm.flow.store';

const PARENT: DbxLlmFlowAnySectionConfig = { key: 'parent', hasForm: true, initialDraft: { formValue: { topic: 'a' } }, kinds: [{ kind: 'a' }, { kind: 'b' }] };
const CHILD: DbxLlmFlowAnySectionConfig = { key: 'child', autoRunAfterParent: true };
const GRANDCHILD: DbxLlmFlowAnySectionConfig = { key: 'grandchild', autoRunAfterParent: true };

@Component({
  template: `
    <div [dbxLlmFlow]="{}">
      <div [dbxLlmFlowSection]="parentConfig">
        <div #parentA dbxAction [dbxActionHandler]="parentHandler" dbxLlmFlowSectionRun="a"></div>
        <div dbxAction [dbxActionHandler]="parentHandler" dbxLlmFlowSectionRun="b"></div>
      </div>
      <div [dbxLlmFlowSection]="childConfig" parentKey="parent">
        @if (showChildBridge()) {
          <div dbxAction [dbxActionHandler]="childHandler" dbxLlmFlowSectionRun="run"></div>
        }
      </div>
      <div [dbxLlmFlowSection]="grandchildConfig" parentKey="child">
        <div dbxAction [dbxActionHandler]="grandchildHandler" dbxLlmFlowSectionRun></div>
      </div>
    </div>
  `,
  imports: [DbxLlmFlowDirective, DbxLlmFlowSectionDirective, DbxLlmFlowSectionRunDirective, DbxActionDirective, DbxActionHandlerDirective]
})
class TestDbxLlmFlowRunComponent {
  readonly parentConfig = PARENT;
  readonly childConfig = CHILD;
  readonly grandchildConfig = GRANDCHILD;

  readonly showChildBridge = signal(true);

  parentSubject = completeOnDestroy(new Subject<string>());
  childSubject = completeOnDestroy(new Subject<string>());
  childHandlerCalls = 0;

  readonly parentHandler = (_value: DbxLlmFlowRunValue) => this.parentSubject.pipe(first());
  readonly childHandler = (_value: DbxLlmFlowRunValue) => {
    this.childHandlerCalls += 1;
    return this.childSubject.pipe(first());
  };

  readonly grandchildHandler = (value: DbxLlmFlowRunValue) => of(`grandchild of ${value.parentRun?.output}`);

  readonly flow = viewChild.required(DbxLlmFlowDirective);
  readonly actions = viewChildren(DbxActionDirective);
}

function wait(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('DbxLlmFlowSectionRunDirective', () => {
  let fixture: ComponentFixture<TestDbxLlmFlowRunComponent>;
  let component: TestDbxLlmFlowRunComponent;
  let store: DbxLlmFlowStore;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await wait();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function action(index: number): DbxActionDirective {
    return component.actions()[index];
  }

  function runsOf(key: string) {
    return Object.values(store.currentState().runs).filter((x) => x.sectionKey === key);
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(TestDbxLlmFlowRunComponent);
    component = fixture.componentInstance;
    await settle();
    store = component.flow().store;
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should register a bridge per kind', () => {
    expect(store.currentState().sections['parent'].runBridgeCounts).toEqual({ a: 1, b: 1 });
    expect(runsOf('parent').length).toBe(0);
  });

  it('should start a run on trigger, then complete it and cascade on success', async () => {
    action(0).sourceInstance.trigger();
    await settle();

    const [run] = runsOf('parent');
    expect(run.state).toBe('running');
    expect(run.kind).toBe('a');
    expect(run.input.formValue).toEqual({ topic: 'a' });

    component.parentSubject.next('parent output');
    await settle();

    expect(store.currentState().runs[run.id].state).toBe('success');
    expect(store.currentState().sections['parent'].selectedRunIds).toEqual([run.id]);
    expect(store.currentState().sections['child'].followedParentRunId).toBe(run.id);
  });

  it('should fail the run when the action is rejected', async () => {
    action(0).sourceInstance.trigger();
    await settle();

    component.parentSubject.error(new Error('boom'));
    await settle();

    const [run] = runsOf('parent');
    expect(run.state).toBe('failed');
    expect(run.error?.message).toBe('boom');
    expect(store.currentState().sections['parent'].lastFailedRunId).toBe(run.id);
  });

  it('should disable the action while the section is blocked', async () => {
    // the child has no input until the parent runs
    expect(await firstValueFrom(action(2).sourceInstance.isDisabled$)).toBe(true);

    action(0).sourceInstance.trigger();
    await settle();

    // the second kind is blocked while the first runs
    expect(await firstValueFrom(action(1).sourceInstance.isDisabled$)).toBe(true);
  });

  it('should record a run that finishes after its bridge unmounted', async () => {
    store.loadDraft('child', { rawInput: 'child input' });
    await settle();

    action(2).sourceInstance.trigger();
    await settle();
    const [run] = runsOf('child');
    expect(run.state).toBe('running');

    component.showChildBridge.set(false);
    await settle();

    component.childSubject.next('late');
    await settle();
    expect(store.currentState().runs[run.id].state).toBe('success');
  });

  it('should not start a phantom run when a bridge mounts late', async () => {
    component.showChildBridge.set(false);
    await settle();

    store.loadDraft('child', { rawInput: 'child input' });
    component.showChildBridge.set(true);
    await settle();

    expect(component.childHandlerCalls).toBe(0);
    expect(runsOf('child').length).toBe(0);
  });

  it('should trigger the action for a run request', async () => {
    store.loadDraft('child', { rawInput: 'child input' });
    await settle();

    expect(store.requestRun('child', 'run')).toBe(true);
    await settle();

    expect(component.childHandlerCalls).toBe(1);
    expect(runsOf('child')[0].state).toBe('running');
  });

  it('should auto-run a two-level chain after the parent succeeds', async () => {
    action(0).sourceInstance.trigger();
    await settle();
    component.parentSubject.next('parent output');
    await settle();

    // the child auto-runs with the parent's output as its raw input
    const [childRun] = runsOf('child');
    expect(childRun.input.rawInput).toBe('parent output');
    expect(childRun.state).toBe('running');

    component.childSubject.next('child output');
    await settle();

    const [grandchildRun] = runsOf('grandchild');
    expect(grandchildRun.state).toBe('success');
    expect(grandchildRun.output).toBe('grandchild of child output');
    expect(grandchildRun.parentRunId).toBe(childRun.id);
  });
});
