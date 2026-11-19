import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { type Maybe, waitForMs } from '@dereekb/util';
import { type DbxLlmFlowAnySectionConfig, type DbxLlmFlowSectionConfig, isDbxLlmFlowStateRun } from './llm.flow';
import { DbxLlmFlowDirective } from './llm.flow.directive';
import { DbxLlmFlowSectionDirective } from './llm.flow.section.directive';
import { DbxLlmFlowSectionValueDirective } from './llm.flow.section.value.directive';

interface TestSetupState {
  readonly look?: string;
}

const SETUP: DbxLlmFlowSectionConfig<TestSetupState> = { key: 'setup', viewOnly: true };
const PROMPT: DbxLlmFlowAnySectionConfig = { key: 'prompt', parentKey: 'setup', allowEmptyInput: true, requireParentRun: true };

@Component({
  template: `
    <div [dbxLlmFlow]="{}">
      <div [dbxLlmFlowSection]="setupConfig()">
        <div [(dbxLlmFlowSectionValue)]="setupState"></div>
      </div>
      <div [dbxLlmFlowSection]="promptConfig"></div>
    </div>
  `,
  imports: [DbxLlmFlowDirective, DbxLlmFlowSectionDirective, DbxLlmFlowSectionValueDirective]
})
class TestLlmValueHostComponent {
  readonly setupConfig = signal<DbxLlmFlowSectionConfig<TestSetupState>>(SETUP);
  readonly promptConfig = PROMPT;
  readonly setupState = signal<Maybe<TestSetupState>>({ look: 'noir' });

  readonly flow = viewChild.required(DbxLlmFlowDirective);
}

describe('DbxLlmFlowSectionValueDirective', () => {
  let fixture: ComponentFixture<TestLlmValueHostComponent>;
  let host: TestLlmValueHostComponent;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForMs(20);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function storeState(): Maybe<TestSetupState> {
    return host.flow().store.currentState().sections['setup']?.draft.formValue as Maybe<TestSetupState>;
  }

  function runPrompt(runId: string): void {
    const store = host.flow().store;
    const result = store.startRun('prompt', 'run');
    expect(result.blockedReason).toBeUndefined();
    store.completeRun(result.value?.runId as string, runId);
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [TestLlmValueHostComponent] });
    fixture = TestBed.createComponent(TestLlmValueHostComponent);
    host = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should push the bound value into a section without one, which records it as a state run', async () => {
    await settle();
    const state = host.flow().store.currentState();
    const selected = state.runs[state.sections['setup'].selectedRunIds[0]];

    expect(storeState()).toEqual({ look: 'noir' });
    expect(isDbxLlmFlowStateRun(selected)).toBe(true);
    expect(selected.output).toEqual({ look: 'noir' });
    expect(state.sections['prompt'].followedParentRunId).toBe(selected.id);
  });

  it('should push changes of the bound value', async () => {
    await settle();
    host.setupState.set({ look: 'pastel' });
    await settle();
    expect(storeState()).toEqual({ look: 'pastel' });
  });

  it('should write changes made from the store to the bound value', async () => {
    await settle();
    host.flow().store.setFormValue('setup', { look: 'neon' });
    await settle();
    expect(host.setupState()).toEqual({ look: 'neon' });
  });

  it('should restore the bound value when a child run is loaded with its parents', async () => {
    await settle();
    runPrompt('noir scene');
    const noirRunId = Object.values(host.flow().store.currentState().runs).find((x) => x.output === 'noir scene')?.id as string;

    host.setupState.set({ look: 'pastel' });
    await settle();
    runPrompt('pastel scene');

    expect(host.flow().store.loadRun({ runId: noirRunId, withAncestors: true })).toBe(true);
    await settle();
    expect(host.setupState()).toEqual({ look: 'noir' });
    expect(host.flow().store.currentState().sections['prompt'].selectedRunIds).toEqual([noirRunId]);
  });

  it('should take the config initial state over the bound default', async () => {
    host.setupConfig.set({ ...SETUP, initialDraft: { formValue: { look: 'sepia' } } });
    await settle();
    expect(host.setupState()).toEqual({ look: 'sepia' });
    expect(storeState()).toEqual({ look: 'sepia' });
  });
});
