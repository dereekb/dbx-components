import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, inject, signal, viewChildren } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { type FormConfig, DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { AbstractSyncForgeFormDirective, DbxForgeFormComponent, dbxForgeTextField, provideDbxForgeFormContext, provideDbxForgeFormFieldDeclarations, provideDbxFormConfiguration } from '@dereekb/dbx-form';
import { type Maybe, waitForMs } from '@dereekb/util';
import { EMPTY, firstValueFrom, of } from 'rxjs';
import { DbxRouterTransitionService } from '@dereekb/dbx-core';
import { type DbxLlmFlowSectionConfig } from './llm.flow';
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
      <dbx-llm-flow-section class="test-brief" [config]="briefConfig" [display]="{ stepNumber: stepNumber() }"></dbx-llm-flow-section>
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

  readonly sections = viewChildren(DbxLlmFlowSectionComponent);
  readonly outputs = viewChildren(TestLlmSectionOutputComponent);
}

@Component({
  template: `
    <div [dbxLlmFlow]="{}">
      <dbx-llm-flow-section class="test-brief" [config]="briefConfig"></dbx-llm-flow-section>
    </div>
  `,
  imports: [DbxLlmFlowDirective, DbxLlmFlowSectionComponent]
})
class TestLlmSectionInputPlacementHostComponent {
  readonly briefConfig: DbxLlmFlowSectionConfig<TestBriefValue, string> = { ...BRIEF, formPlacement: 'input' };
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

describe('DbxLlmFlowSectionComponent with the form placed in the input', () => {
  let fixture: ComponentFixture<TestLlmSectionInputPlacementHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestLlmSectionInputPlacementHostComponent], providers: TEST_PROVIDERS }).compileComponents();
    fixture = TestBed.createComponent(TestLlmSectionInputPlacementHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForMs(50);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  function briefElement(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.test-brief') as HTMLElement;
  }

  it('should show the form in a content pit under the raw input field, in the measured column, and not above the raw input', () => {
    const main = briefElement().querySelector('dbx-llm-flow-section-raw-input .dbx-llm-flow-section-raw-input-main') as HTMLElement;
    const children = Array.from(main.children);
    expect(children[0].matches('.dbx-llm-flow-section-raw-input-field')).toBe(true);
    expect(children[1].matches('.dbx-llm-flow-section-form.dbx-content-pit')).toBe(true);
    expect(children[1].querySelector('dbx-test-llm-section-form')).not.toBeNull();
    expect(briefElement().querySelector('.dbx-llm-flow-section-body > .dbx-llm-flow-section-form')).toBeNull();
  });

  it('should keep the run buttons beside the column, following its height', () => {
    const row = briefElement().querySelector('.dbx-llm-flow-section-raw-input-row') as HTMLElement;
    expect(row.querySelector(':scope > .dbx-llm-flow-section-raw-input-main')).not.toBeNull();
    expect(row.querySelector(':scope > dbx-llm-flow-section-run-buttons.dbx-height-sync-follower')).not.toBeNull();
  });
});
