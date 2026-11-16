import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DbxButtonComponent, injectCopyToClipboardFunctionWithSnackbarMessage } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { dbxLlmFlowSectionHasForm } from './llm.flow.state';
import { DbxLlmFlowSectionStore } from './llm.flow.section.store';

/**
 * Default label of the raw input field.
 */
export const DEFAULT_DBX_LLM_FLOW_SECTION_RAW_INPUT_LABEL = 'Input';

/**
 * Default minimum number of rows of the raw input field.
 */
export const DEFAULT_DBX_LLM_FLOW_SECTION_RAW_INPUT_MIN_ROWS = 3;

/**
 * Default maximum number of rows of the raw input field.
 */
export const DEFAULT_DBX_LLM_FLOW_SECTION_RAW_INPUT_MAX_ROWS = 16;

/**
 * Shows the raw input of the nearest section.
 *
 * The text is read-only unless the mode is `editable`, but the field stays focusable so the context-menu and mobile paste work. A paste or a
 * drop replaces the whole text through the section store (two-way mode parses it back into the form). Also shows an override banner with a
 * "Revert to form" action, the section's input issues and a copy button.
 *
 * @example
 * ```html
 * <dbx-llm-flow-section-raw-input></dbx-llm-flow-section-raw-input>
 * ```
 */
@Component({
  selector: 'dbx-llm-flow-section-raw-input',
  template: `
    @if (showOverrideBannerSignal()) {
      <div class="dbx-llm-flow-section-raw-input-override dbx-flex-bar">
        <span class="dbx-hint dbx-small">The raw input overrides the form.</span>
        <span class="dbx-spacer"></span>
        <dbx-button text="Revert to form" icon="undo" [flat]="true" (buttonClick)="revertToForm()"></dbx-button>
      </div>
    }
    <mat-form-field class="dbx-llm-flow-section-raw-input-field" appearance="outline" subscriptSizing="dynamic">
      <mat-label>{{ labelSignal() }}</mat-label>
      <textarea
        matInput
        cdkTextareaAutosize
        class="dbx-llm-flow-section-raw-input-textarea"
        [cdkAutosizeMinRows]="minRowsSignal()"
        [cdkAutosizeMaxRows]="maxRowsSignal()"
        [readonly]="readonlySignal()"
        [value]="rawInputSignal()"
        (beforeinput)="onBeforeInput($event)"
        (paste)="onPaste($event)"
        (drop)="onDrop($event)"
        (input)="onInput($event)"></textarea>
      <dbx-button matSuffix icon="content_copy" ariaLabel="Copy the raw input" [iconOnly]="true" [flat]="true" [disabled]="!rawInputSignal()" (buttonClick)="copyRawInput()"></dbx-button>
      @if (hintSignal()) {
        <mat-hint>{{ hintSignal() }}</mat-hint>
      }
    </mat-form-field>
    @if (inputIssuesSignal().length) {
      <ul class="dbx-llm-flow-section-raw-input-issues">
        @for (issue of inputIssuesSignal(); track $index) {
          <li class="dbx-llm-flow-section-raw-input-issue dbx-small">{{ issue }}</li>
        }
      </ul>
    }
  `,
  host: {
    class: 'dbx-llm-flow-section-raw-input',
    '[class.dbx-llm-flow-section-raw-input-overridden]': 'overriddenSignal()',
    '[class.dbx-llm-flow-section-raw-input-editable]': 'editableSignal()'
  },
  imports: [MatFormFieldModule, MatInputModule, TextFieldModule, DbxButtonComponent]
})
export class DbxLlmFlowSectionRawInputComponent {
  readonly sectionStore = inject(DbxLlmFlowSectionStore);

  private readonly _copyToClipboard = injectCopyToClipboardFunctionWithSnackbarMessage();

  /**
   * Overrides the label from the section config.
   */
  readonly label = input<Maybe<string>>();

  readonly configSignal = toSignal(this.sectionStore.config$);
  readonly rawInputSignal = toSignal(this.sectionStore.rawInput$, { initialValue: '' });
  readonly modeSignal = toSignal(this.sectionStore.rawInputMode$, { initialValue: 'two-way' as const });
  readonly overriddenSignal = toSignal(this.sectionStore.rawInputOverridden$, { initialValue: false });
  readonly inputIssuesSignal = toSignal(this.sectionStore.inputIssues$, { initialValue: [] as readonly string[] });

  readonly hasFormSignal = computed(() => dbxLlmFlowSectionHasForm(this.configSignal()));
  readonly labelSignal = computed(() => {
    const label = this.label();
    const configLabel = this.configSignal()?.rawInput?.label;
    return label ?? configLabel ?? DEFAULT_DBX_LLM_FLOW_SECTION_RAW_INPUT_LABEL;
  });
  readonly hintSignal = computed(() => this.configSignal()?.rawInput?.hint);
  readonly minRowsSignal = computed(() => this.configSignal()?.rawInput?.minRows ?? DEFAULT_DBX_LLM_FLOW_SECTION_RAW_INPUT_MIN_ROWS);
  readonly maxRowsSignal = computed(() => this.configSignal()?.rawInput?.maxRows ?? DEFAULT_DBX_LLM_FLOW_SECTION_RAW_INPUT_MAX_ROWS);
  readonly readonlySignal = computed(() => this.modeSignal() === 'readonly');
  readonly editableSignal = computed(() => this.modeSignal() === 'editable');
  readonly showOverrideBannerSignal = computed(() => {
    const overridden = this.overriddenSignal();
    const hasForm = this.hasFormSignal();
    return overridden && hasForm;
  });

  onBeforeInput(event: Event): void {
    if (!this.editableSignal()) {
      event.preventDefault();
    }
  }

  onPaste(event: ClipboardEvent): void {
    if (!this.editableSignal()) {
      event.preventDefault();
      this._pasteText(event.clipboardData?.getData('text/plain'));
    }
  }

  onDrop(event: DragEvent): void {
    if (!this.editableSignal()) {
      event.preventDefault();
      this._pasteText(event.dataTransfer?.getData('text/plain'));
    }
  }

  onInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;

    if (this.editableSignal()) {
      this.sectionStore.setRawInput(textarea.value);
    } else {
      textarea.value = this.rawInputSignal(); // restore text an IME inserted past beforeinput
    }
  }

  copyRawInput(): void {
    void this._copyToClipboard(this.rawInputSignal());
  }

  revertToForm(): void {
    this.sectionStore.revertRawInputToForm();
  }

  private _pasteText(text: Maybe<string>): void {
    if (text != null && !this.readonlySignal()) {
      this.sectionStore.pasteRawInput(text);
    }
  }
}
