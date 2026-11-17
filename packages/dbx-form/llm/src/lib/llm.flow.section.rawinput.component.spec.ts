import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideDbxForgeFormFieldDeclarations, provideDbxFormConfiguration } from '@dereekb/dbx-form';
import { type Maybe, waitForMs } from '@dereekb/util';
import { DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { DbxHeightSyncFollowerDirective } from '@dereekb/dbx-web';
import { type DbxLlmFlowAnySectionConfig } from './llm.flow';
import { defaultDbxLlmFlowToRawInput } from './llm.flow.state';
import { DbxLlmFlowDirective } from './llm.flow.directive';
import { DbxLlmFlowSectionDirective } from './llm.flow.section.directive';
import { DBX_LLM_FLOW_SECTION_RAW_INPUT_STACK_WIDTH, DbxLlmFlowSectionRawInputComponent } from './llm.flow.section.rawinput.component';

const TWO_WAY: DbxLlmFlowAnySectionConfig = {
  key: 'brief',
  hasForm: true,
  initialDraft: { formValue: { topic: 'a' } },
  validateInput: (input) => ((input.formValue as { topic?: string } | undefined)?.topic ? undefined : 'Topic is required.')
};

const ONE_WAY: DbxLlmFlowAnySectionConfig = { ...TWO_WAY, rawInput: { mode: 'one-way' } };

const EDITABLE: DbxLlmFlowAnySectionConfig = { key: 'outline', rawInput: { mode: 'editable' } };

const READONLY: DbxLlmFlowAnySectionConfig = { key: 'render', rawInput: { mode: 'readonly', rows: 2 }, initialDraft: { rawInput: 'fixed' } };

/**
 * ResizeObserver stand-in (jsdom has none): resize() reports a size to the observers of an element.
 */
class TestResizeObserver {
  static readonly instances: TestResizeObserver[] = [];

  readonly elements: Element[] = [];

  constructor(readonly callback: ResizeObserverCallback) {
    TestResizeObserver.instances.push(this);
  }

  static resize(element: Element, width: number, height: number): void {
    TestResizeObserver.instances.filter((x) => x.elements.includes(element)).forEach((x) => x.callback([{ target: element, contentRect: { width, height } } as unknown as ResizeObserverEntry], x as unknown as ResizeObserver));
  }

  observe(element: Element): void {
    this.elements.push(element);
  }

  unobserve(): void {
    // unused
  }

  disconnect(): void {
    this.elements.length = 0;
  }
}

const TEST_PROVIDERS = [provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }];

@Component({
  template: `
    <div [dbxLlmFlow]="{}">
      <div [dbxLlmFlowSection]="config()">
        <dbx-llm-flow-section-raw-input>
          <div class="test-follower" dbxHeightSyncFollower></div>
        </dbx-llm-flow-section-raw-input>
      </div>
    </div>
  `,
  imports: [DbxLlmFlowDirective, DbxLlmFlowSectionDirective, DbxLlmFlowSectionRawInputComponent, DbxHeightSyncFollowerDirective]
})
class TestRawInputHostComponent {
  readonly config = signal<DbxLlmFlowAnySectionConfig>(TWO_WAY);
  readonly section = viewChild.required(DbxLlmFlowSectionDirective);
}

describe('DbxLlmFlowSectionRawInputComponent', () => {
  let fixture: ComponentFixture<TestRawInputHostComponent>;
  let host: TestRawInputHostComponent;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForMs(10);
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function textarea(): HTMLTextAreaElement {
    return element().querySelector('textarea') as HTMLTextAreaElement;
  }

  function draft() {
    return host.section().sectionStore.section?.draft;
  }

  function source(): Maybe<string> {
    return element().querySelector('.dbx-llm-flow-section-raw-input-source')?.getAttribute('data-source');
  }

  function issues(): string[] {
    return Array.from(element().querySelectorAll('.dbx-llm-flow-section-raw-input-issue')).map((x) => x.textContent?.trim() ?? '');
  }

  function isInvalid(): boolean {
    return element().querySelector('dbx-llm-flow-section-raw-input')?.classList.contains('dbx-llm-flow-section-raw-input-invalid') ?? false;
  }

  function beforeInput(): InputEvent {
    const event = new InputEvent('beforeinput', { cancelable: true, bubbles: true, inputType: 'insertText', data: 'x' });
    textarea().dispatchEvent(event);
    return event;
  }

  async function type(text: string): Promise<void> {
    textarea().value = text;
    textarea().dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  function paste(text: string): Event {
    const event = new Event('paste', { cancelable: true, bubbles: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
    textarea().dispatchEvent(event);
    return event;
  }

  async function setup(config: DbxLlmFlowAnySectionConfig): Promise<void> {
    fixture = TestBed.createComponent(TestRawInputHostComponent);
    host = fixture.componentInstance;
    host.config.set(config);
    await settle();

    // forge renders the textarea field asynchronously
    for (let i = 0; i < 50 && !textarea(); i += 1) {
      await settle();
    }

    await settle();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestRawInputHostComponent], providers: TEST_PROVIDERS }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  describe('two-way', () => {
    beforeEach(async () => {
      await setup(TWO_WAY);
    });

    it('should show the draft raw input, generated from the form', () => {
      expect(textarea().value).toBe(defaultDbxLlmFlowToRawInput({ topic: 'a' }));
      expect(source()).toBe('form');
      expect(isInvalid()).toBe(false);
    });

    it('should allow typing', () => {
      expect(beforeInput().defaultPrevented).toBe(false);
    });

    it('should parse typed JSON back into the form value and keep the text as typed', async () => {
      await type('{"topic":"b"}');

      expect(draft()?.formValue).toEqual({ topic: 'b' });
      expect(draft()?.rawInputOverridden).toBeFalsy();
      expect(textarea().value).toBe('{"topic":"b"}');
      expect(source()).toBe('form');
    });

    it('should override the form with typed text that does not parse, show the issue and the error state, and revert', async () => {
      await type('not json');

      expect(draft()?.rawInputOverridden).toBe(true);
      expect(textarea().value).toBe('not json');
      expect(source()).toBe('manual');
      expect(issues().length).toBeGreaterThan(0);
      expect(isInvalid()).toBe(true);

      (element().querySelector('.dbx-llm-flow-section-raw-input-revert button') as HTMLButtonElement).click();
      await settle();

      expect(draft()?.rawInputOverridden).toBeFalsy();
      expect(source()).toBe('form');
      expect(isInvalid()).toBe(false);
      expect(textarea().value).toBe(defaultDbxLlmFlowToRawInput({ topic: 'a' }));
    });

    it('should show validateInput messages', async () => {
      await type('{}');

      expect(issues()).toContain('Topic is required.');
      expect(isInvalid()).toBe(true);
    });
  });

  describe('one-way', () => {
    beforeEach(async () => {
      await setup(ONE_WAY);
    });

    it('should prevent typing', () => {
      expect(beforeInput().defaultPrevented).toBe(true);
    });

    it('should replace the text with a paste and override the form', async () => {
      const event = paste('free text');
      await settle();

      expect(event.defaultPrevented).toBe(true);
      expect(draft()?.rawInputOverridden).toBe(true);
      expect(textarea().value).toBe('free text');
      expect(source()).toBe('manual');
      expect(element().querySelector('.dbx-llm-flow-section-raw-input-revert')).not.toBeNull();
    });
  });

  describe('editable', () => {
    beforeEach(async () => {
      await setup(EDITABLE);
    });

    it('should show that there is no input yet', () => {
      expect(source()).toBe('none');
      expect(issues()).toEqual([]);
    });

    it('should allow typing and store the typed text as manual input', async () => {
      expect(beforeInput().defaultPrevented).toBe(false);

      await type('hello');

      expect(draft()?.rawInput).toBe('hello');
      expect(source()).toBe('manual');
      expect(element().querySelector('.dbx-llm-flow-section-raw-input-revert')).toBeNull();
    });
  });

  describe('readonly', () => {
    beforeEach(async () => {
      await setup(READONLY);
    });

    it('should show the text in a readonly forge textarea with the configured rows', () => {
      expect(textarea().value).toBe('fixed');
      expect(textarea().readOnly).toBe(true);
      expect(textarea().rows).toBe(2);
    });

    it('should ignore a paste', async () => {
      paste('other');
      await settle();

      expect(draft()?.rawInput).toBe('fixed');
      expect(draft()?.rawInputOverridden).toBeFalsy();
    });
  });

  describe('copy button', () => {
    it('should show a copy button in the field, disabled while there is no text', async () => {
      await setup(EDITABLE);
      const copyButton = () => element().querySelector('.dbx-llm-flow-section-raw-input-field button') as Maybe<HTMLButtonElement>;

      expect(copyButton()).not.toBeNull();
      expect(copyButton()?.disabled).toBe(true);

      await type('hello');
      await settle();

      expect(copyButton()?.disabled).toBe(false);
    });
  });

  describe('stacking', () => {
    function rawInputElement(): HTMLElement {
      return element().querySelector('dbx-llm-flow-section-raw-input') as HTMLElement;
    }

    function follower(): HTMLElement {
      return element().querySelector('.test-follower') as HTMLElement;
    }

    function isStacked(): boolean {
      return rawInputElement().classList.contains('dbx-llm-flow-section-raw-input-stacked');
    }

    async function resize(width: number): Promise<void> {
      TestResizeObserver.resize(rawInputElement(), width, 200);
      TestResizeObserver.resize(element().querySelector('.dbx-llm-flow-section-raw-input-main') as HTMLElement, width, 120);
      await settle();
    }

    beforeEach(async () => {
      TestResizeObserver.instances.length = 0;
      vi.stubGlobal('ResizeObserver', TestResizeObserver);
      await setup(TWO_WAY);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should keep projected content beside the form, following its height, when wide', async () => {
      await resize(DBX_LLM_FLOW_SECTION_RAW_INPUT_STACK_WIDTH + 200);
      expect(isStacked()).toBe(false);
      expect(follower().style.height).toBe('120px');
    });

    it('should stack projected content under the form, with its natural height, when narrow', async () => {
      await resize(DBX_LLM_FLOW_SECTION_RAW_INPUT_STACK_WIDTH - 100);
      expect(isStacked()).toBe(true);
      expect(follower().style.height).toBe('');

      await resize(DBX_LLM_FLOW_SECTION_RAW_INPUT_STACK_WIDTH + 200);
      expect(isStacked()).toBe(false);
      expect(follower().style.height).toBe('120px');
    });

    it('should not stack while hidden (zero width)', async () => {
      await resize(DBX_LLM_FLOW_SECTION_RAW_INPUT_STACK_WIDTH - 100);
      expect(isStacked()).toBe(true);

      await resize(0);
      expect(isStacked()).toBe(false);
    });
  });

  describe('showSource', () => {
    it('should hide the source message when showSource is false', async () => {
      await setup({ ...TWO_WAY, rawInput: { showSource: false } });
      expect(source()).toBeUndefined();
    });
  });
});
