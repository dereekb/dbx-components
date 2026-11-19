import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, inject, signal, viewChild, viewChildren } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { type FormConfig, DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { AbstractSyncForgeFormDirective, DbxForgeFormComponent, dbxForgeNumberField, dbxForgeTextField, provideDbxForgeFormContext, provideDbxForgeFormFieldDeclarations, provideDbxFormConfiguration } from '@dereekb/dbx-form';
import { type Maybe, waitForMs } from '@dereekb/util';
import { EMPTY, firstValueFrom, of } from 'rxjs';
import { DbxRouterTransitionService } from '@dereekb/dbx-core';
import { DbxChipDirective, type DbxColorInput } from '@dereekb/dbx-web';
import { type DbxLlmFlowSectionConfig, type DbxLlmFlowSectionDisplayConfig, type DbxLlmFlowSectionStatusChip } from './llm.flow';
import { defaultDbxLlmFlowToRawInput } from './llm.flow.state';
import { DbxLlmFlowDirective } from './llm.flow.directive';
import { DbxLlmFlowSectionStore } from './llm.flow.section.store';
import { DbxLlmFlowSectionComponent } from './llm.flow.section.component';
import { DbxLlmFlowSectionOutputDirective } from './llm.flow.section.output.component';

interface TestBriefValue {
  readonly topic?: string;
}

@Component({
  selector: 'dbx-test-llm-section-form',
  template: `
    <dbx-forge></dbx-forge>
  `,
  providers: [provideDbxForgeFormContext()],
  imports: [DbxForgeFormComponent]
})
class TestLlmSectionFormComponent extends AbstractSyncForgeFormDirective<TestBriefValue> {
  readonly formConfig: FormConfig = {
    fields: [dbxForgeTextField({ key: 'topic', label: 'Topic' }) as never]
  };
}

@Component({
  selector: 'dbx-test-llm-section-output',
  template: `
    <span class="test-output">{{ sectionStore.keyValue }}</span>
  `
})
class TestLlmSectionOutputComponent {
  readonly sectionStore = inject(DbxLlmFlowSectionStore);
}

const BRIEF: DbxLlmFlowSectionConfig<TestBriefValue, string> = {
  key: 'brief',
  label: 'Brief',
  formComponent: TestLlmSectionFormComponent,
  initialDraft: { formValue: { topic: 'seeded' } },
  kinds: [
    { kind: 'plan', text: 'Outline', handler: () => of('outline') },
    { kind: 'render', text: 'Quick draft', handler: () => of('draft') }
  ]
};

const OUTLINE: DbxLlmFlowSectionConfig = { key: 'outline', label: 'Outline', followParentKinds: ['plan'] };

@Component({
  template: `
    <div [dbxLlmFlow]="{}">
      <dbx-llm-flow-section class="test-brief" [config]="briefConfig" [display]="{ stepNumber: stepNumber(), status: status() }" [statusChip]="statusChip()"></dbx-llm-flow-section>
      <dbx-llm-flow-section class="test-outline" [config]="outlineConfig" parentKey="brief" [display]="{ stepNumber: stepNumber() }">
        <dbx-test-llm-section-output dbxLlmFlowSectionOutput></dbx-test-llm-section-output>
      </dbx-llm-flow-section>
    </div>
  `,
  imports: [DbxLlmFlowDirective, DbxLlmFlowSectionComponent, DbxLlmFlowSectionOutputDirective, TestLlmSectionOutputComponent]
})
class TestLlmSectionHostComponent {
  readonly briefConfig = BRIEF;
  readonly outlineConfig = OUTLINE;
  readonly stepNumber = signal<Maybe<boolean>>(undefined);
  readonly status = signal<Maybe<boolean>>(undefined);
  readonly statusChip = signal<Maybe<DbxLlmFlowSectionStatusChip>>(undefined);

  readonly sections = viewChildren(DbxLlmFlowSectionComponent);
  readonly outputs = viewChildren(TestLlmSectionOutputComponent);
}

const SETUP: DbxLlmFlowSectionConfig = { key: 'setup', label: 'Setup', hint: 'Host the world first.', viewOnly: true, stepNumber: 0 };

const PROMPT: DbxLlmFlowSectionConfig<unknown, string> = { key: 'prompt', label: 'Prompt', kinds: [{ kind: 'run', text: 'Write', handler: () => of('written') }] };

@Component({
  template: `
    <div [dbxLlmFlow]="{}">
      <dbx-llm-flow-section class="test-setup" [config]="setupConfig" [statusChip]="statusChip()" [display]="display()">
        <div class="test-bench">bench</div>
        <dbx-test-llm-section-output></dbx-test-llm-section-output>
      </dbx-llm-flow-section>
      <dbx-llm-flow-section class="test-prompt" [config]="promptConfig"></dbx-llm-flow-section>
    </div>
  `,
  imports: [DbxLlmFlowDirective, DbxLlmFlowSectionComponent, TestLlmSectionOutputComponent]
})
class TestLlmViewOnlySectionHostComponent {
  readonly setupConfig = SETUP;
  readonly promptConfig = PROMPT;
  readonly statusChip = signal<Maybe<DbxLlmFlowSectionStatusChip>>(undefined);
  readonly display = signal<Maybe<DbxLlmFlowSectionDisplayConfig>>(undefined);

  readonly flow = viewChild.required(DbxLlmFlowDirective);
  readonly sections = viewChildren(DbxLlmFlowSectionComponent);
  readonly outputs = viewChildren(TestLlmSectionOutputComponent);
}

function sectionStatusChipText(element: HTMLElement): Maybe<string> {
  return element.querySelector('.dbx-llm-flow-section-header-label > dbx-chip.dbx-llm-flow-section-status')?.textContent?.trim();
}

function sectionStatusChipColor(fixture: ComponentFixture<unknown>, sectionSelector: string): Maybe<DbxColorInput> {
  const chip = fixture.debugElement.query(By.css(`${sectionSelector} dbx-chip.dbx-llm-flow-section-status`));
  return chip?.injector.get(DbxChipDirective).colorSignal();
}

interface TestDraftValue {
  readonly count?: number;
}

const DRAFT: DbxLlmFlowSectionConfig<TestDraftValue, string> = {
  key: 'draft',
  label: 'Draft',
  optionFields: [dbxForgeNumberField({ key: 'count', label: 'Count' })],
  initialDraft: { formValue: { count: 2 }, rawInput: 'the text' },
  rawInput: { mode: 'readonly' },
  kinds: [{ kind: 'run', text: 'Render', handler: () => of('rendered') }]
};

@Component({
  template: `
    <div [dbxLlmFlow]="{}">
      <dbx-llm-flow-section class="test-draft" [config]="draftConfig"></dbx-llm-flow-section>
    </div>
  `,
  imports: [DbxLlmFlowDirective, DbxLlmFlowSectionComponent]
})
class TestLlmSectionOptionFieldsHostComponent {
  readonly draftConfig = DRAFT;
  readonly section = viewChild.required(DbxLlmFlowSectionComponent);
}

const TEST_PROVIDERS = [provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }, { provide: DbxRouterTransitionService, useValue: { transitions$: EMPTY } }];

describe('DbxLlmFlowSectionComponent', () => {
  let fixture: ComponentFixture<TestLlmSectionHostComponent>;
  let host: TestLlmSectionHostComponent;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForMs(50);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function briefElement(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.test-brief') as HTMLElement;
  }

  function brief(): DbxLlmFlowSectionComponent {
    return host.sections()[0];
  }

  function panels(): HTMLElement[] {
    return Array.from(document.querySelectorAll('dbx-llm-flow-section-form-panel'));
  }

  function outlineElement(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.test-outline') as HTMLElement;
  }

  function headerStepNumber(element: HTMLElement): Maybe<string> {
    return element.querySelector('.dbx-llm-flow-section-header-label > dbx-icon-tile.dbx-llm-flow-section-step-number')?.textContent?.trim();
  }

  async function setStepNumber(stepNumber: Maybe<boolean>): Promise<void> {
    host.stepNumber.set(stepNumber);
    await settle();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestLlmSectionHostComponent], providers: TEST_PROVIDERS }).compileComponents();
    fixture = TestBed.createComponent(TestLlmSectionHostComponent);
    host = fixture.componentInstance;
    await settle();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('should render a run button per kind', () => {
    const buttons = Array.from(briefElement().querySelectorAll('dbx-llm-flow-section-run-buttons dbx-button')).map((x) => x.textContent?.trim());
    expect(buttons.length).toBe(2);
    expect(buttons.some((x) => x?.includes('Outline'))).toBe(true);
    expect(buttons.some((x) => x?.includes('Quick draft'))).toBe(true);
  });

  it('should place the run buttons to the right of the raw input field, following its height, and not in the header', () => {
    const row = briefElement().querySelector('dbx-llm-flow-section-raw-input .dbx-llm-flow-section-raw-input-row') as HTMLElement;
    expect(row.querySelector(':scope > .dbx-llm-flow-section-raw-input-main > .dbx-llm-flow-section-raw-input-field')).not.toBeNull();
    expect(row.querySelector(':scope > dbx-llm-flow-section-run-buttons.dbx-height-sync-follower')).not.toBeNull();
    expect(briefElement().querySelector('.dbx-llm-flow-section-header dbx-llm-flow-section-run-buttons')).toBeNull();
  });

  it('should render run buttons without an icon unless the kind sets one', () => {
    expect(briefElement().querySelector('dbx-llm-flow-section-run-buttons mat-icon')).toBeNull();
  });

  it('should toggle the form', async () => {
    expect(briefElement().querySelector('.dbx-llm-flow-section-body dbx-test-llm-section-form')).not.toBeNull();

    brief().toggleFormVisible();
    await settle();
    expect(briefElement().querySelector('.dbx-llm-flow-section-body dbx-test-llm-section-form')).toBeNull();

    brief().toggleFormVisible();
    await settle();
    expect(briefElement().querySelector('.dbx-llm-flow-section-body dbx-test-llm-section-form')).not.toBeNull();
  });

  describe('collapse', () => {
    function collapseButton(element: HTMLElement): Maybe<HTMLButtonElement> {
      return element.querySelector('.dbx-llm-flow-section-header-actions > dbx-button.dbx-llm-flow-section-collapse-button button');
    }

    function isCollapsed(element: HTMLElement): boolean {
      return element.classList.contains('dbx-llm-flow-section-collapsed');
    }

    it('should put the collapse button last in the header button row', () => {
      const actions = briefElement().querySelector('.dbx-llm-flow-section-header-actions') as HTMLElement;
      expect(actions.lastElementChild?.classList.contains('dbx-llm-flow-section-collapse-button')).toBe(true);
      expect(collapseButton(briefElement())?.getAttribute('aria-label')).toBe('Collapse the section');
    });

    it('should collapse the section to its header, keeping the body rendered, and expand it again', async () => {
      collapseButton(briefElement())?.click();
      await settle();

      expect(isCollapsed(briefElement())).toBe(true);
      expect(collapseButton(briefElement())?.getAttribute('aria-label')).toBe('Expand the section');
      expect(briefElement().querySelector('.dbx-llm-flow-section-header')).not.toBeNull();
      expect(briefElement().querySelector('.dbx-llm-flow-section-body dbx-test-llm-section-form')).not.toBeNull(); // hidden, not destroyed
      expect(briefElement().querySelector('.dbx-llm-flow-section-body dbx-llm-flow-section-run-buttons')).not.toBeNull();
      expect(isCollapsed(outlineElement())).toBe(false); // per section
      expect(brief().sectionStore.section?.collapsed).toBe(true); // kept in the flow state, so it is persisted

      collapseButton(briefElement())?.click();
      await settle();
      expect(isCollapsed(briefElement())).toBe(false);
    });

    it('should hide the form toggle while collapsed', async () => {
      const headerButtonCount = () => briefElement().querySelectorAll('.dbx-llm-flow-section-header-actions > dbx-button').length;
      const expanded = headerButtonCount();

      brief().toggleCollapsed();
      await settle();
      expect(headerButtonCount()).toBe(expanded - 1);
    });
  });

  it('should open the form in a dialog that shares the section store', async () => {
    brief().openFormPopout('dialog');
    await settle();

    expect(panels().length).toBe(1);
    const panel = panels()[0];
    expect(panel.querySelector('dbx-test-llm-section-form')).not.toBeNull();

    brief().sectionStore.loadDraft({ formValue: { topic: 'shared' } });
    await settle();
    expect((panel.querySelector('textarea') as HTMLTextAreaElement).value).toBe(defaultDbxLlmFlowToRawInput({ topic: 'shared' }));

    brief().sectionStore.closeFormPopout();
    await settle();
    await waitForMs(300); // dialog close animation
    expect(panels().length).toBe(0);
  });

  it('should open the form in a detach window that shares the section store, and remove it on destroy', async () => {
    brief().openFormPopout('detach');
    await settle();

    expect(panels().length).toBe(1);
    const panel = panels()[0];
    expect(panel.querySelector('.dbx-llm-flow-section-form-panel-detach')).not.toBeNull();

    brief().sectionStore.loadDraft({ formValue: { topic: 'detached' } });
    await settle();
    expect((panel.querySelector('textarea') as HTMLTextAreaElement).value).toBe(defaultDbxLlmFlowToRawInput({ topic: 'detached' }));

    fixture.destroy();
    await waitForMs(50);
    expect(panels().length).toBe(0);
  });

  it('should let projected output inject the section store and hide the default output', () => {
    expect(host.outputs()[0].sectionStore.keyValue).toBe('outline');
    expect(outlineElement().querySelector('dbx-llm-flow-section-output')).toBeNull();
    expect(briefElement().querySelector('dbx-llm-flow-section-output')).not.toBeNull();
  });

  describe('status chip', () => {
    it('should show the run status by default', () => {
      expect(sectionStatusChipText(briefElement())).toBe('Ready');
      expect(sectionStatusChipColor(fixture, '.test-brief')).toBe('grey');
      expect(sectionStatusChipText(outlineElement())).toBe('Ready');
    });

    it('should replace the run status with the page chip', async () => {
      host.statusChip.set({ text: 'hosted', color: 'ok' });
      await settle();

      expect(sectionStatusChipText(briefElement())).toBe('hosted');
      expect(sectionStatusChipColor(fixture, '.test-brief')).toBe('ok');
      expect(sectionStatusChipText(outlineElement())).toBe('Ready'); // per section
    });

    it('should hide the chip when the display status option is off', async () => {
      host.status.set(false);
      await settle();
      expect(briefElement().querySelector('dbx-chip.dbx-llm-flow-section-status')).toBeNull();

      host.statusChip.set({ text: 'hosted', color: 'ok' });
      await settle();
      expect(briefElement().querySelector('dbx-chip.dbx-llm-flow-section-status')).toBeNull();
    });

    it('should not mark a run section as view-only', () => {
      expect(briefElement().classList.contains('dbx-llm-flow-section-view-only')).toBe(false);
      expect(outlineElement().classList.contains('dbx-llm-flow-section-view-only')).toBe(false);
    });
  });

  describe('step number', () => {
    it('should hide the step number when turned off', async () => {
      await setStepNumber(false);
      expect(briefElement().querySelector('dbx-icon-tile.dbx-llm-flow-section-step-number')).toBeNull();
    });

    it('should show the step number of each section in its chain before the label by default', () => {
      expect(headerStepNumber(briefElement())).toBe('1');
      expect(headerStepNumber(outlineElement())).toBe('2');

      const label = briefElement().querySelector('.dbx-llm-flow-section-header-label') as HTMLElement;
      expect(label.firstElementChild?.matches('dbx-icon-tile.dbx-llm-flow-section-step-number')).toBe(true);
      expect(label.querySelector('.dbx-llm-flow-section-label')?.textContent?.trim()).toBe('Brief');
    });

    it('should number a section by its place in the chain', async () => {
      expect(await firstValueFrom(brief().sectionStore.stepNumber$)).toBe(1);
      expect(await firstValueFrom(host.sections()[1].sectionStore.stepNumber$)).toBe(2);
    });

    it('should show the step number in the dialog title, following the section display input', async () => {
      brief().openFormPopout('dialog');
      await settle();

      const panel = panels()[0];
      const header = panel.querySelector('.dbx-llm-flow-section-form-panel-header') as HTMLElement;
      expect(header.querySelector('dbx-icon-tile.dbx-llm-flow-section-step-number')?.textContent?.trim()).toBe('1');
      expect(header.querySelector('.dbx-llm-flow-section-form-panel-label')?.textContent?.trim()).toBe('Brief');

      await setStepNumber(false);
      expect(header.querySelector('dbx-icon-tile')).toBeNull();

      brief().sectionStore.closeFormPopout();
      await settle();
      await waitForMs(300); // dialog close animation
    });

    it('should show the step number before the label in the detach window control bar', async () => {
      brief().openFormPopout('detach');
      await settle();

      const controls = panels()[0].querySelector('dbx-detach-controls') as HTMLElement;
      expect(controls.querySelector(':scope > dbx-icon-tile.dbx-llm-flow-section-step-number')?.textContent?.trim()).toBe('1');
      expect(controls.querySelector('.dbx-detach-controls-header')?.textContent?.trim()).toBe('Brief');

      await setStepNumber(false);
      expect(controls.querySelector('dbx-icon-tile')).toBeNull();
    });
  });
});

describe('DbxLlmFlowSectionComponent with option fields', () => {
  let fixture: ComponentFixture<TestLlmSectionOptionFieldsHostComponent>;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForMs(50);
    fixture.detectChanges();
  }

  function draftElement(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.test-draft') as HTMLElement;
  }

  function countInput(): Maybe<HTMLInputElement> {
    return draftElement().querySelector('.dbx-llm-flow-section-raw-input-field input[type=number]');
  }

  function draft() {
    return fixture.componentInstance.section().sectionStore.section?.draft;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestLlmSectionOptionFieldsHostComponent], providers: TEST_PROVIDERS }).compileComponents();
    fixture = TestBed.createComponent(TestLlmSectionOptionFieldsHostComponent);
    await settle();

    // forge renders the fields asynchronously
    for (let i = 0; i < 50 && !countInput(); i += 1) {
      await settle();
    }

    await settle();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('should render the option fields in the raw input form, under the textarea, with no separate form', () => {
    const main = draftElement().querySelector('dbx-llm-flow-section-raw-input .dbx-llm-flow-section-raw-input-main') as HTMLElement;
    const form = main.querySelector(':scope > .dbx-llm-flow-section-raw-input-field') as HTMLElement;

    expect(main.children.length).toBe(1);
    expect(form.querySelector('.dbx-llm-flow-section-raw-input-text textarea')).not.toBeNull();
    expect(countInput()).not.toBeNull();
    expect(draftElement().querySelector('.dbx-llm-flow-section-form')).toBeNull();
  });

  it('should seed the options with the form value, and keep the raw input text', () => {
    expect(countInput()?.value).toBe('2');
    expect((draftElement().querySelector('.dbx-llm-flow-section-raw-input-text textarea') as HTMLTextAreaElement).value).toBe('the text');
  });

  it('should push option changes to the form value without changing the raw input, even when the raw input is readonly', async () => {
    const input = countInput() as HTMLInputElement;
    const beforeInput = new InputEvent('beforeinput', { cancelable: true, bubbles: true, inputType: 'insertText', data: '5' });
    input.dispatchEvent(beforeInput);
    expect(beforeInput.defaultPrevented).toBe(false);

    input.value = '5';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    await settle();

    expect(draft()?.formValue).toEqual({ count: 5 });
    expect(draft()?.rawInput).toBe('the text');
  });

  it('should keep the run buttons beside the form column, following its height', () => {
    const row = draftElement().querySelector('.dbx-llm-flow-section-raw-input-row') as HTMLElement;
    expect(row.querySelector(':scope > .dbx-llm-flow-section-raw-input-main')).not.toBeNull();
    expect(row.querySelector(':scope > dbx-llm-flow-section-run-buttons.dbx-height-sync-follower')).not.toBeNull();
  });

  it('should list the options of a run in its history description', () => {
    const sectionStore = fixture.componentInstance.section().sectionStore;
    const description = sectionStore.describeRun({ id: 'r1', sectionKey: 'draft', kind: 'run', input: { formValue: { count: 3 }, rawInput: 'x', rawInputOverridden: false }, state: 'success', startedAt: new Date() } as never);
    expect(description.detail).toBe('Count: 3');
  });
});

describe('DbxLlmFlowSectionComponent view-only', () => {
  let fixture: ComponentFixture<TestLlmViewOnlySectionHostComponent>;
  let host: TestLlmViewOnlySectionHostComponent;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForMs(50);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function setupElement(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.test-setup') as HTMLElement;
  }

  function promptElement(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.test-prompt') as HTMLElement;
  }

  function setup(): DbxLlmFlowSectionComponent {
    return host.sections()[0];
  }

  function headerStepNumber(element: HTMLElement): Maybe<string> {
    return element.querySelector('.dbx-llm-flow-section-header-label > dbx-icon-tile.dbx-llm-flow-section-step-number')?.textContent?.trim();
  }

  function collapseButton(element: HTMLElement): Maybe<HTMLButtonElement> {
    return element.querySelector('.dbx-llm-flow-section-header-actions > dbx-button.dbx-llm-flow-section-collapse-button button');
  }

  function isCollapsed(element: HTMLElement): boolean {
    return element.classList.contains('dbx-llm-flow-section-collapsed');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestLlmViewOnlySectionHostComponent], providers: TEST_PROVIDERS }).compileComponents();
    fixture = TestBed.createComponent(TestLlmViewOnlySectionHostComponent);
    host = fixture.componentInstance;
    await settle();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('should show the header: the fixed step number, label, hint and collapse button', () => {
    expect(headerStepNumber(setupElement())).toBe('0');
    expect(setupElement().querySelector('.dbx-llm-flow-section-header-label > .dbx-llm-flow-section-label')?.textContent?.trim()).toBe('Setup');
    expect(setupElement().querySelector(':scope > .dbx-llm-flow-section-hint')?.textContent?.trim()).toBe('Host the world first.');
    expect(collapseButton(setupElement())).not.toBeNull();
    expect(headerStepNumber(promptElement())).toBe('1');
  });

  it('should show the projected content as its body, with none of the run parts', () => {
    const body = setupElement().querySelector('.dbx-llm-flow-section-body') as HTMLElement;
    expect(body.querySelector('.test-bench')).not.toBeNull();
    expect(host.outputs()[0].sectionStore.keyValue).toBe('setup'); // projected content can inject the section store

    for (const selector of ['.dbx-llm-flow-section-form', 'dbx-llm-flow-section-raw-input', 'dbx-llm-flow-section-run-buttons', 'dbx-llm-flow-section-history-button', 'dbx-llm-flow-section-output', '.dbx-llm-flow-section-actions', 'dbx-error']) {
      expect(setupElement().querySelector(selector)).toBeNull();
    }

    expect(promptElement().querySelector('dbx-llm-flow-section-run-buttons')).not.toBeNull();
  });

  it('should show no status chip by default, only the page chip', async () => {
    expect(setupElement().querySelector('dbx-chip.dbx-llm-flow-section-status')).toBeNull(); // never "Ready"
    expect(sectionStatusChipText(promptElement())).toBe('Ready');

    host.statusChip.set({ text: 'not hosted', color: 'warn' });
    await settle();
    expect(sectionStatusChipText(setupElement())).toBe('not hosted');
    expect(sectionStatusChipColor(fixture, '.test-setup')).toBe('warn');

    host.statusChip.set({ text: 'hosted', color: 'ok' });
    await settle();
    expect(sectionStatusChipText(setupElement())).toBe('hosted');
    expect(sectionStatusChipColor(fixture, '.test-setup')).toBe('ok');

    host.display.set({ status: false });
    await settle();
    expect(setupElement().querySelector('dbx-chip.dbx-llm-flow-section-status')).toBeNull();
    expect(sectionStatusChipText(promptElement())).toBe('Ready');
  });

  it('should mark only the view-only section with the view-only class', () => {
    expect(setupElement().classList.contains('dbx-llm-flow-section-view-only')).toBe(true);
    expect(promptElement().classList.contains('dbx-llm-flow-section-view-only')).toBe(false);
  });

  it('should collapse, keeping the body rendered and the collapsed state in the flow state, and follow the flow store', async () => {
    collapseButton(setupElement())?.click();
    await settle();

    expect(isCollapsed(setupElement())).toBe(true);
    expect(setupElement().querySelector('.test-bench')).not.toBeNull(); // hidden, not destroyed
    expect(setup().sectionStore.section?.collapsed).toBe(true); // kept in the flow state, so it is persisted
    expect(isCollapsed(promptElement())).toBe(false);

    host.flow().store.setCollapsed('setup', false);
    await settle();
    expect(isCollapsed(setupElement())).toBe(false);

    host.flow().store.setCollapsed('setup', true);
    await settle();
    expect(isCollapsed(setupElement())).toBe(true);
  });

  it('should let the display turn a run part back on', async () => {
    expect(setupElement().querySelector('dbx-llm-flow-section-output')).toBeNull();

    host.display.set({ output: true });
    await settle();
    expect(setupElement().querySelector('dbx-llm-flow-section-output')).not.toBeNull();
  });
});
