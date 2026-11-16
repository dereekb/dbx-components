import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { waitForMs } from '@dereekb/util';
import { type DbxLlmFlowAnySectionConfig } from './llm.flow';
import { defaultDbxLlmFlowToRawInput } from './llm.flow.state';
import { DbxLlmFlowDirective } from './llm.flow.directive';
import { DbxLlmFlowSectionDirective } from './llm.flow.section.directive';
import { DbxLlmFlowSectionRawInputComponent } from './llm.flow.section.rawinput.component';

const TWO_WAY: DbxLlmFlowAnySectionConfig = {
  key: 'brief',
  hasForm: true,
  initialDraft: { formValue: { topic: 'a' } },
  validateInput: (input) => ((input.formValue as { topic?: string } | undefined)?.topic ? undefined : 'Topic is required.')
};

const EDITABLE: DbxLlmFlowAnySectionConfig = { key: 'outline', rawInput: { mode: 'editable' } };

@Component({
  template: `
    <div [dbxLlmFlow]="{}">
      <div [dbxLlmFlowSection]="config()">
        <dbx-llm-flow-section-raw-input></dbx-llm-flow-section-raw-input>
      </div>
    </div>
  `,
  imports: [DbxLlmFlowDirective, DbxLlmFlowSectionDirective, DbxLlmFlowSectionRawInputComponent]
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
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestRawInputHostComponent] }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  describe('two-way', () => {
    beforeEach(async () => {
      await setup(TWO_WAY);
    });

    it('should show the draft raw input', () => {
      expect(textarea().value).toBe(defaultDbxLlmFlowToRawInput({ topic: 'a' }));
    });

    it('should prevent typing', () => {
      const event = new InputEvent('beforeinput', { cancelable: true, inputType: 'insertText', data: 'x' });
      textarea().dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });

    it('should parse a pasted value back into the form value', async () => {
      const event = paste('{"topic":"b"}');
      await settle();

      expect(event.defaultPrevented).toBe(true);
      expect(draft()?.formValue).toEqual({ topic: 'b' });
      expect(draft()?.rawInputOverridden).toBeFalsy();
      expect(textarea().value).toBe(defaultDbxLlmFlowToRawInput({ topic: 'b' }));
    });

    it('should override the form with unparseable text, show the issue, and revert', async () => {
      paste('not json');
      await settle();

      expect(draft()?.rawInputOverridden).toBe(true);
      expect(textarea().value).toBe('not json');
      expect(element().querySelector('.dbx-llm-flow-section-raw-input-override')).not.toBeNull();
      expect(element().querySelectorAll('.dbx-llm-flow-section-raw-input-issue').length).toBeGreaterThan(0);

      (element().querySelector('.dbx-llm-flow-section-raw-input-override button') as HTMLButtonElement).click();
      await settle();

      expect(draft()?.rawInputOverridden).toBeFalsy();
      expect(element().querySelector('.dbx-llm-flow-section-raw-input-override')).toBeNull();
      expect(textarea().value).toBe(defaultDbxLlmFlowToRawInput({ topic: 'a' }));
    });

    it('should show validateInput messages', async () => {
      paste('{}');
      await settle();

      const issues = Array.from(element().querySelectorAll('.dbx-llm-flow-section-raw-input-issue')).map((x) => x.textContent?.trim());
      expect(issues).toContain('Topic is required.');
    });
  });

  describe('editable', () => {
    beforeEach(async () => {
      await setup(EDITABLE);
    });

    it('should allow typing and store the typed text', async () => {
      const event = new InputEvent('beforeinput', { cancelable: true, inputType: 'insertText', data: 'x' });
      textarea().dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);

      textarea().value = 'hello';
      textarea().dispatchEvent(new Event('input', { bubbles: true }));
      await settle();

      expect(draft()?.rawInput).toBe('hello');
    });
  });
});
