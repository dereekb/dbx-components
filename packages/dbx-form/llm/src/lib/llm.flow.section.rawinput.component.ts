import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, input, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CdkTextareaAutosize, TextFieldModule } from '@angular/cdk/text-field';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { DbxButtonComponent, DbxHeightSyncDirective, DbxHeightSyncSourceDirective, injectCopyToClipboardFunctionWithSnackbarMessage } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { type DbxLlmFlowSectionInputSource } from './llm.flow';
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
 * Shows the raw input of the nearest section.
 *
 * The text can be typed into in `two-way` mode (parsed back into the form as it is typed) and `editable` mode. In `one-way` mode a paste or a
 * drop replaces the whole text through the section store, and the field stays focusable so the context-menu and mobile paste work.
 *
 * Also shows where the text comes from (the form, the parent's output, or manual input, with a revert action when manual input overrides
 * generated input), the section's input issues (outlining the field in the error color) and a copy button. The field re-measures its
 * autosize height when its width changes and when web fonts finish loading, so the text is not clipped.
 *
 * Projected content renders to the right of the field, centered on it. The host is a dbxHeightSync group with the field as its source (its
 * content box, so the form field's vertical padding is left out), so projected content marked dbxHeightSyncFollower takes the height of the
 * field's outlined box. The section projects its run buttons there.
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
      <mat-form-field class="dbx-llm-flow-section-raw-input-field" appearance="outline" subscriptSizing="dynamic" dbxHeightSyncSource="content-box">
        <mat-label>{{ labelSignal() }}</mat-label>
        <textarea
          #textarea
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
      </mat-form-field>
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
    '[attr.data-source]': 'inputSourceSignal()'
  },
  hostDirectives: [DbxHeightSyncDirective],
  imports: [MatFormFieldModule, MatIconModule, MatInputModule, TextFieldModule, DbxButtonComponent, DbxHeightSyncSourceDirective]
})
export class DbxLlmFlowSectionRawInputComponent {
  readonly sectionStore = inject(DbxLlmFlowSectionStore);

  private readonly _copyToClipboard = injectCopyToClipboardFunctionWithSnackbarMessage();
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _autosize = viewChild(CdkTextareaAutosize);
  private readonly _textarea = viewChild('textarea', { read: ElementRef<HTMLTextAreaElement> });

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
  readonly shownInputIssuesSignal = computed(() => (this.inputSourceSignal() === 'none' ? [] : this.inputIssuesSignal()));
  readonly invalidSignal = computed(() => this.shownInputIssuesSignal().length > 0);

  readonly sourceMessageSignal = computed<Maybe<DbxLlmFlowSectionRawInputSourceMessage>>(() => {
    const config = this.configSignal();
    const source = this.inputSourceSignal();
    const hasForm = this.hasFormSignal();
    const followsParentRun = this.followsParentRunSignal();
    const parentConfig = this.parentConfigSignal();
    const parentLabel = parentConfig?.label ?? parentConfig?.key;
    const icon = RAW_INPUT_SOURCE_ICONS[source];
    let message: Maybe<DbxLlmFlowSectionRawInputSourceMessage>;

    if (config?.rawInput?.showSource !== false) {
      switch (source) {
        case 'form':
          message = { source, icon, text: this.typeableSignal() ? 'Generated from the form. Edits here update the form.' : 'Generated from the form.' };
          break;
        case 'parent':
          message = { source, icon, text: `Generated from the ${parentLabel ?? 'parent'} output.` };
          break;
        case 'manual':
          if (hasForm) {
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
    // cdkTextareaAutosize only re-measures when the text changes, so also re-measure when a width change re-wraps the text, and when web fonts
    // finish loading (a measurement made with the fallback font clips the text)
    afterNextRender(() => {
      const textarea = this._textarea()?.nativeElement;
      const remeasure = () => this._autosize()?.resizeToFitContent(true);

      if (textarea != null && typeof ResizeObserver !== 'undefined') {
        let width: Maybe<number>;
        const observer = new ResizeObserver(() => {
          const nextWidth = textarea.clientWidth;

          if (nextWidth !== width) {
            width = nextWidth;
            remeasure();
          }
        });

        observer.observe(textarea);
        this._destroyRef.onDestroy(() => observer.disconnect());
      }

      const fonts = textarea?.ownerDocument.fonts;

      if (fonts != null) {
        void fonts.ready.then(remeasure);
        fonts.addEventListener('loadingdone', remeasure);
        this._destroyRef.onDestroy(() => fonts.removeEventListener('loadingdone', remeasure));
      }
    });
  }

  onBeforeInput(event: Event): void {
    if (!this.typeableSignal()) {
      event.preventDefault();
    }
  }

  onPaste(event: ClipboardEvent): void {
    if (!this.typeableSignal()) {
      event.preventDefault();
      this._pasteText(event.clipboardData?.getData('text/plain'));
    }
  }

  onDrop(event: DragEvent): void {
    if (!this.typeableSignal()) {
      event.preventDefault();
      this._pasteText(event.dataTransfer?.getData('text/plain'));
    }
  }

  onInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;

    if (this.typeableSignal()) {
      this.sectionStore.setRawInput(textarea.value);
    } else {
      textarea.value = this.rawInputSignal(); // restore text an IME inserted past beforeinput
    }
  }

  copyRawInput(): void {
    void this._copyToClipboard(this.rawInputSignal());
  }

  revertRawInput(): void {
    this.sectionStore.revertRawInput();
  }

  private _pasteText(text: Maybe<string>): void {
    if (text != null && !this.readonlySignal()) {
      this.sectionStore.pasteRawInput(text);
    }
  }
}
