import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, computed, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { type FormConfig, DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { AbstractSyncForgeFormDirective, DbxForgeFormComponent, dbxForgeTextField, provideDbxForgeFormContext, provideDbxForgeFormFieldDeclarations, provideDbxFormConfiguration } from '@dereekb/dbx-form';
import { waitForMs } from '@dereekb/util';
import { first, firstValueFrom } from 'rxjs';
import { type DbxLlmFlowSectionConfig } from './llm.flow';
import { DbxLlmFlowDirective } from './llm.flow.directive';
import { DbxLlmFlowSectionDirective } from './llm.flow.section.directive';
import { DbxLlmFlowSectionFormDirective } from './llm.flow.section.form.directive';
import { dbxLlmFlowSectionFormInjectionConfig, isDbxLlmFlowSectionFormBound } from './llm.flow.section.form';

interface TestFormValue {
  readonly topic?: string;
  readonly note?: string;
}

const CREATED_FORMS: TestLlmFormComponent[] = [];

@Component({
  selector: 'dbx-test-llm-form',
  template: `
    <dbx-forge></dbx-forge>
  `,
  providers: [provideDbxForgeFormContext()],
  imports: [DbxForgeFormComponent]
})
class TestLlmFormComponent extends AbstractSyncForgeFormDirective<TestFormValue> {
  readonly formConfig: FormConfig = {
    fields: [dbxForgeTextField({ key: 'topic', label: 'Topic' }) as never, dbxForgeTextField({ key: 'note', label: 'Note', required: true }) as never]
  };

  constructor() {
    super();
    CREATED_FORMS.push(this);
  }
}

const SECTION: DbxLlmFlowSectionConfig<TestFormValue> = { key: 'brief', hasForm: true, initialDraft: { formValue: { topic: 'seeded' } } };

@Component({
  template: `
    <div [dbxLlmFlow]="{}">
      <div [dbxLlmFlowSection]="config">
        <dbx-test-llm-form dbxLlmFlowSectionForm></dbx-test-llm-form>
        @if (showSecond()) {
          <dbx-test-llm-form dbxLlmFlowSectionForm></dbx-test-llm-form>
        }
        @if (showInjected()) {
          <dbx-injection [config]="injectionConfigSignal()"></dbx-injection>
        }
      </div>
    </div>
  `,
  imports: [DbxLlmFlowDirective, DbxLlmFlowSectionDirective, DbxLlmFlowSectionFormDirective, TestLlmFormComponent, DbxInjectionComponent]
})
class TestLlmFormHostComponent {
  readonly config = SECTION;
  readonly showSecond = signal(false);
  readonly showInjected = signal(false);

  readonly section = viewChild.required(DbxLlmFlowSectionDirective);
  readonly injectionConfigSignal = computed(() => dbxLlmFlowSectionFormInjectionConfig({ componentClass: TestLlmFormComponent }, this.section().sectionStore));
}

const TEST_PROVIDERS = [provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }];

describe('DbxLlmFlowSectionFormDirective', () => {
  let fixture: ComponentFixture<TestLlmFormHostComponent>;
  let host: TestLlmFormHostComponent;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForMs(50);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function draftFormValue(): TestFormValue {
    return host.section().sectionStore.section?.draft.formValue as TestFormValue;
  }

  function formValue(form: TestLlmFormComponent): Promise<TestFormValue> {
    return firstValueFrom(form.context.currentValue().pipe(first()));
  }

  beforeEach(async () => {
    CREATED_FORMS.length = 0;
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    fixture = TestBed.createComponent(TestLlmFormHostComponent);
    host = fixture.componentInstance;
    await settle();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should seed the form with the draft and keep it over the form defaults', async () => {
    const [form] = CREATED_FORMS;
    expect((await formValue(form)).topic).toBe('seeded');
    expect(draftFormValue().topic).toBe('seeded');
    expect(isDbxLlmFlowSectionFormBound(form.context)).toBe(true);
  });

  it('should push form edits to the draft', async () => {
    const [form] = CREATED_FORMS;
    form.context.setValue({ topic: 'edited', note: 'n' });
    await settle();

    expect(draftFormValue()).toEqual({ topic: 'edited', note: 'n' });
    expect(host.section().sectionStore.section?.formValid).toBe(true);
  });

  it('should re-seed the form when the draft changes elsewhere', async () => {
    const [form] = CREATED_FORMS;
    host.section().sectionStore.loadDraft({ formValue: { topic: 'from store' } });
    await settle();

    expect((await formValue(form)).topic).toBe('from store');
  });

  it('should keep two bound instances in sync', async () => {
    host.showSecond.set(true);
    await settle();

    const [first, second] = CREATED_FORMS;
    expect((await formValue(second)).topic).toBe('seeded');

    first.context.setValue({ topic: 'from first', note: 'x' });
    await settle();

    expect((await formValue(second)).topic).toBe('from first');
    expect(draftFormValue().topic).toBe('from first');

    second.context.setValue({ topic: 'from second', note: 'x' });
    await settle();

    expect((await formValue(first)).topic).toBe('from second');
    expect(draftFormValue().topic).toBe('from second');
  });

  it('should lock the form while the section runs', async () => {
    const [form] = CREATED_FORMS;
    form.context.setValue({ topic: 'ready', note: 'required' }); // an invalid form blocks the run
    await settle();

    expect(host.section().sectionStore.startRun('run').value).toBeDefined();
    await settle();

    expect((await firstValueFrom(form.context.stream$)).isDisabled).toBe(true);
  });

  it('should auto-bind a form created through the injection config, without double binding', async () => {
    host.showInjected.set(true);
    await settle();

    const injected = CREATED_FORMS[CREATED_FORMS.length - 1];
    expect(CREATED_FORMS.length).toBe(2);
    expect(isDbxLlmFlowSectionFormBound(injected.context)).toBe(true);
    expect((await formValue(injected)).topic).toBe('seeded');

    injected.context.setValue({ topic: 'injected', note: 'x' });
    await settle();

    expect(draftFormValue().topic).toBe('injected');
    expect((await formValue(CREATED_FORMS[0])).topic).toBe('injected');
  });
});
