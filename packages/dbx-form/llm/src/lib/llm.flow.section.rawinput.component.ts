import { Component, computed, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { DbxButtonComponent, DbxHeightSyncDirective, DbxHeightSyncSourceDirective, injectCopyToClipboardFunctionWithSnackbarMessage } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { type DbxLlmFlowSectionInputSource } from './llm.flow';
import { dbxLlmFlowSectionRawInputFollowsForm } from './llm.flow.state';
import { DbxLlmFlowSectionStore } from './llm.flow.section.store';
import { DbxLlmFlowSectionRawInputFormComponent } from './llm.flow.section.rawinput.form.component';

/**
 * Default label of the raw input field.
 */
export const DEFAULT_DBX_LLM_FLOW_SECTION_RAW_INPUT_LABEL = 'Input';

/**
 * Default number of visible rows of the raw input field.
 */
export const DEFAULT_DBX_LLM_FLOW_SECTION_RAW_INPUT_ROWS = 5;

/**
 * Width in pixels below which the raw input stacks: the projected content (the run buttons) moves under the form instead of beside it.
 */
export const DBX_LLM_FLOW_SECTION_RAW_INPUT_STACK_WIDTH = 480;

/**
 * The message the raw input shows about where its text comes from.
 */
export interface DbxLlmFlowSectionRawInputSourceMessage {
  readonly source: DbxLlmFlowSectionInputSource;
  readonly icon: string;
  readonly text: string;
  /**
   * Text of the revert button. Only set when the manual input overrides generated input.
   */
  readonly revertText?: Maybe<string>;
}

const RAW_INPUT_SOURCE_ICONS: Record<DbxLlmFlowSectionInputSource, string> = {
  form: 'dynamic_form',
  parent: 'subdirectory_arrow_right',
  manual: 'edit',
  none: 'hourglass_empty'
};

/**
 * Shows the raw input of the nearest section, in a forge textarea with a fixed number of rows (longer text scrolls, and the field can be resized
 * by dragging).
 *
 * The text can be typed into in `two-way` mode (parsed back into the form as it is typed) and `editable` mode. In `one-way` mode a paste or a
 * drop replaces the whole text through the section store, and the field stays focusable so the context-menu and mobile paste work.
 *
 * Also shows where the text comes from (the form, the parent's output, or manual input, with a revert action when manual input overrides
 * generated input), the section's input issues (outlining the field in the error color) and a copy button. The section's option fields render
 * in the same forge form, under the textarea (see DbxLlmFlowSectionRawInputFormComponent).
 *
 * Projected content renders to the right of the form, centered on it. The host is a dbxHeightSync group with the form's column as its source
 * (its content box: the column carries the field's vertical padding), so projected content marked dbxHeightSyncFollower takes the height of the
 * textarea's outlined box plus the options under it. The section projects its run buttons beside the form.
 *
 * When the raw input is narrower than DBX_LLM_FLOW_SECTION_RAW_INPUT_STACK_WIDTH (a phone, or a narrow pop-out window) it stacks: the
 * projected content moves under the form, and the height sync is turned off so it keeps its natural height.
 *
 * @example
 * ```html
 * <dbx-llm-flow-section-raw-input>
 *   <dbx-llm-flow-section-run-buttons dbxHeightSyncFollower></dbx-llm-flow-section-run-buttons>
 * </dbx-llm-flow-section-raw-input>
 * ```
 */
@Component({
  selector: 'dbx-llm-flow-section-raw-input',
  template: `
    @if (sourceMessageSignal(); as message) {
      <div class="dbx-llm-flow-section-raw-input-source" [attr.data-source]="message.source">
        <mat-icon class="dbx-llm-flow-section-raw-input-source-icon">{{ message.icon }}</mat-icon>
        <span class="dbx-llm-flow-section-raw-input-source-text dbx-small">{{ message.text }}</span>
        @if (message.revertText) {
          <span class="dbx-spacer"></span>
          <dbx-button class="dbx-llm-flow-section-raw-input-revert" [text]="message.revertText" icon="undo" [flat]="true" (buttonClick)="revertRawInput()"></dbx-button>
        }
      </div>
    }
    <div class="dbx-llm-flow-section-raw-input-row">
      <div class="dbx-llm-flow-section-raw-input-main" dbxHeightSyncSource="content-box">
        <dbx-llm-flow-section-raw-input-form
          class="dbx-llm-flow-section-raw-input-field"
          [label]="labelSignal()"
          [rows]="rowsSignal()"
          [readonlyText]="readonlySignal()"
          [copyDisabled]="!rawInputSignal()"
          (copyClick)="copyRawInput()"
          (beforeinput)="onBeforeInput($event)"
          (paste)="onPaste($event)"
          (drop)="onDrop($event)"
          (input)="onInput($event)"></dbx-llm-flow-section-raw-input-form>
      </div>
      <ng-content></ng-content>
    </div>
    @if (hintSignal()) {
      <div class="dbx-llm-flow-section-raw-input-hint dbx-hint dbx-small">{{ hintSignal() }}</div>
    }
    @if (shownInputIssuesSignal().length) {
      <ul class="dbx-llm-flow-section-raw-input-issues">
        @for (issue of shownInputIssuesSignal(); track $index) {
          <li class="dbx-llm-flow-section-raw-input-issue dbx-small">{{ issue }}</li>
        }
      </ul>
    }
  `,
  host: {
    class: 'dbx-llm-flow-section-raw-input',
    '[class.dbx-llm-flow-section-raw-input-overridden]': 'overriddenSignal()',
    '[class.dbx-llm-flow-section-raw-input-typeable]': 'typeableSignal()',
    '[class.dbx-llm-flow-section-raw-input-invalid]': 'invalidSignal()',
    '[class.dbx-llm-flow-section-raw-input-stacked]': 'stackedSignal()',
    '[attr.data-source]': 'inputSourceSignal()'
  },
  hostDirectives: [DbxHeightSyncDirective],
  imports: [MatIconModule, DbxButtonComponent, DbxHeightSyncSourceDirective, DbxLlmFlowSectionRawInputFormComponent]
})
export class DbxLlmFlowSectionRawInputComponent {
  readonly sectionStore = inject(DbxLlmFlowSectionStore);

  private readonly _copyToClipboard = injectCopyToClipboardFunctionWithSnackbarMessage();
  private readonly _form = viewChild.required(DbxLlmFlowSectionRawInputFormComponent);
  private readonly _heightSync = inject(DbxHeightSyncDirective, { self: true });
  private readonly _stacked = signal(false);

  /**
   * Overrides the label from the section config.
   */
  readonly label = input<Maybe<string>>();

  readonly configSignal = toSignal(this.sectionStore.config$);
  readonly rawInputSignal = toSignal(this.sectionStore.rawInput$, { initialValue: '' });
  readonly modeSignal = toSignal(this.sectionStore.rawInputMode$, { initialValue: 'two-way' as const });
  readonly overriddenSignal = toSignal(this.sectionStore.rawInputOverridden$, { initialValue: false });
  readonly inputIssuesSignal = toSignal(this.sectionStore.inputIssues$, { initialValue: [] as readonly string[] });
  readonly inputSourceSignal = toSignal(this.sectionStore.inputSource$, { initialValue: 'none' as DbxLlmFlowSectionInputSource });
  readonly followsParentRunSignal = toSignal(this.sectionStore.followsParentRun$, { initialValue: false });
  readonly parentConfigSignal = toSignal(this.sectionStore.parentConfig$);

  readonly followsFormSignal = computed(() => dbxLlmFlowSectionRawInputFollowsForm(this.configSignal()));
  readonly labelSignal = computed(() => {
    const label = this.label();
    const configLabel = this.configSignal()?.rawInput?.label;
    return label ?? configLabel ?? DEFAULT_DBX_LLM_FLOW_SECTION_RAW_INPUT_LABEL;
  });
  readonly hintSignal = computed(() => this.configSignal()?.rawInput?.hint);
  readonly rowsSignal = computed(() => this.configSignal()?.rawInput?.rows ?? DEFAULT_DBX_LLM_FLOW_SECTION_RAW_INPUT_ROWS);
  readonly readonlySignal = computed(() => this.modeSignal() === 'readonly');

  /**
   * Whether the text can be typed into: two-way and editable modes.
   */
  readonly typeableSignal = computed(() => {
    const mode = this.modeSignal();
    return mode === 'two-way' || mode === 'editable';
  });

  /**
   * The input issues to show. While the section waits on its parent's first run, the source message explains the empty input instead.
   */
  readonly shownInputIssuesSignal = computed(() => {
    const inputIssues = this.inputIssuesSignal();
    return this.inputSourceSignal() === 'none' ? [] : inputIssues;
  });
  readonly invalidSignal = computed(() => this.shownInputIssuesSignal().length > 0);

  /**
   * Whether the raw input is narrower than DBX_LLM_FLOW_SECTION_RAW_INPUT_STACK_WIDTH, with the projected content under the form.
   */
  readonly stackedSignal = this._stacked.asReadonly();

  readonly sourceMessageSignal = computed<Maybe<DbxLlmFlowSectionRawInputSourceMessage>>(() => {
    const typeable = this.typeableSignal();
    const config = this.configSignal();
    const source = this.inputSourceSignal();
    const followsForm = this.followsFormSignal();
    const followsParentRun = this.followsParentRunSignal();
    const parentConfig = this.parentConfigSignal();
    const parentLabel = parentConfig?.label ?? parentConfig?.key;
    const icon = RAW_INPUT_SOURCE_ICONS[source];
    let message: Maybe<DbxLlmFlowSectionRawInputSourceMessage>;

    if (config?.rawInput?.showSource !== false) {
      switch (source) {
        case 'form':
          message = { source, icon, text: typeable ? 'Generated from the form. Edits here update the form.' : 'Generated from the form.' };
          break;
        case 'parent':
          message = { source, icon, text: `Generated from the ${parentLabel ?? 'parent'} output.` };
          break;
        case 'manual':
          if (followsForm) {
            message = { source, icon, text: 'Manual input. It overrides the form.', revertText: 'Revert to form' };
          } else if (followsParentRun) {
            message = { source, icon, text: `Edited manually. It overrides the ${parentLabel ?? 'parent'} output.`, revertText: `Revert to ${parentLabel ?? 'parent'} output` };
          } else {
            message = { source, icon, text: 'Manual input.' };
          }
          break;
        case 'none':
          message = { source, icon, text: parentLabel ? `Run ${parentLabel} to generate this input.` : 'No input yet.' };
          break;
      }
    }

    return message;
  });

  constructor() {
    this._observeWidth();
  }

  // the form's events bubble here: only those of the raw input textarea are handled, never an option field's
  onBeforeInput(event: Event): void {
    if (this._form().isTextareaTarget(event.target) && !this.typeableSignal()) {
      event.preventDefault();
    }
  }

  onPaste(event: ClipboardEvent): void {
    if (this._form().isTextareaTarget(event.target) && !this.typeableSignal()) {
      event.preventDefault();
      this._pasteText(event.clipboardData?.getData('text/plain'));
    }
  }

  onDrop(event: DragEvent): void {
    if (this._form().isTextareaTarget(event.target) && !this.typeableSignal()) {
      event.preventDefault();
      this._pasteText(event.dataTransfer?.getData('text/plain'));
    }
  }

  onInput(event: Event): void {
    const form = this._form();
    const target = event.target;

    if (form.isTextareaTarget(target)) {
      if (this.typeableSignal()) {
        this.sectionStore.setRawInput(target.value);
      } else {
        form.restoreText(); // restore text an IME inserted past beforeinput
      }
    }
  }

  copyRawInput(): void {
    void this._copyToClipboard(this.rawInputSignal());
  }

  revertRawInput(): void {
    this.sectionStore.revertRawInput();
  }

  // the host's width decides the layout; stacking changes only its height, so there is no feedback loop
  private _observeWidth(): void {
    if (typeof ResizeObserver !== 'undefined') {
      const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
      const observer = new ResizeObserver((entries) => {
        const width = entries[entries.length - 1].contentRect.width;
        this._setStacked(width > 0 && width < DBX_LLM_FLOW_SECTION_RAW_INPUT_STACK_WIDTH);
      });

      observer.observe(element);
      inject(DestroyRef).onDestroy(() => observer.disconnect());
    }
  }

  private _setStacked(stacked: boolean): void {
    this._stacked.set(stacked);
    this._heightSync.dbxHeightSyncDisabled.set(stacked);
  }

  private _pasteText(text: Maybe<string>): void {
    if (text != null && !this.readonlySignal()) {
      this.sectionStore.pasteRawInput(text);
    }
  }
}
