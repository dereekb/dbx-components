import { Component, computed, contentChild, DestroyRef, effect, inject, Injector, input, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { cleanSubscription, DbxInjectionComponent } from '@dereekb/dbx-core';
import { DbxButtonComponent, DbxChipDirective, type DbxDetachInstance, DbxDetachService, DbxErrorComponent, type DbxThemeColor } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { filter, map } from 'rxjs';
import { type DbxLlmFlowSectionDisplayConfig, type DbxLlmFlowSectionFormPopoutMode } from './llm.flow';
import { DbxLlmFlowSectionDirective } from './llm.flow.section.directive';
import { DbxLlmFlowSectionStore, type DbxLlmFlowSectionStatus } from './llm.flow.section.store';
import { dbxLlmFlowSectionFormComponentInjectionConfig } from './llm.flow.section.form';
import { dbxLlmFlowSectionFormDetachKey, openDbxLlmFlowSectionFormDetach, openDbxLlmFlowSectionFormDialog } from './llm.flow.section.form.popout';
import { DbxLlmFlowSectionRawInputComponent } from './llm.flow.section.rawinput.component';
import { DbxLlmFlowSectionRunButtonsComponent } from './llm.flow.section.run.buttons.component';
import { DbxLlmFlowSectionHistoryButtonComponent } from './llm.flow.section.history.button.component';
import { DbxLlmFlowSectionOutputComponent, DbxLlmFlowSectionOutputDirective } from './llm.flow.section.output.component';

const STATUS_TEXT: Record<DbxLlmFlowSectionStatus, string> = {
  idle: 'Ready',
  running: 'Running',
  success: 'Done',
  failed: 'Failed'
};

const STATUS_COLOR: Record<DbxLlmFlowSectionStatus, Maybe<DbxThemeColor>> = {
  idle: 'grey',
  running: 'primary',
  success: 'ok',
  failed: 'warn'
};

/**
 * Fully resolved display toggles of a section.
 */
export type DbxLlmFlowSectionResolvedDisplayConfig = Required<{ readonly [K in keyof DbxLlmFlowSectionDisplayConfig]: boolean }>;

/**
 * Resolves the display toggles of a section. Every part is shown unless turned off. The display input overrides the config.
 *
 * @param configDisplay - The section config's display.
 * @param inputDisplay - The component's display input.
 * @returns The resolved toggles.
 */
export function dbxLlmFlowSectionResolvedDisplayConfig(configDisplay: Maybe<DbxLlmFlowSectionDisplayConfig>, inputDisplay: Maybe<DbxLlmFlowSectionDisplayConfig>): DbxLlmFlowSectionResolvedDisplayConfig {
  const display = { ...configDisplay, ...inputDisplay };
  return {
    header: display.header !== false,
    form: display.form !== false,
    rawInput: display.rawInput !== false,
    runButtons: display.runButtons !== false,
    history: display.history !== false,
    output: display.output !== false
  };
}

/**
 * A step of an LLM flow: a header (label, status, form toggle, pop-out, history and run buttons), the form, the raw input, the last error and
 * the output.
 *
 * Registers the section through its DbxLlmFlowSectionDirective host directive. Content projected with dbxLlmFlowSectionOutput replaces the
 * default output, and can inject the DbxLlmFlowSectionStore.
 *
 * The form pops out to a dialog or a detach window when the section store's popout signal is set. Both are live-synced with the inline form.
 *
 * @example
 * ```html
 * <dbx-llm-flow-section [config]="briefConfig"></dbx-llm-flow-section>
 * <dbx-llm-flow-section [config]="outlineConfig" parentKey="brief" [display]="{ rawInput: false }"></dbx-llm-flow-section>
 * ```
 */
@Component({
  selector: 'dbx-llm-flow-section',
  template: `
    @if (displaySignal().header) {
      <div class="dbx-llm-flow-section-header">
        <div class="dbx-llm-flow-section-header-label">
          <span class="dbx-llm-flow-section-label dbx-text-title-medium">{{ labelSignal() }}</span>
          <dbx-chip class="dbx-llm-flow-section-status" [small]="true" [color]="statusColorSignal()">{{ statusTextSignal() }}</dbx-chip>
        </div>
        <span class="dbx-spacer"></span>
        <div class="dbx-llm-flow-section-header-actions">
          @if (showFormControlsSignal()) {
            <dbx-button [icon]="formVisibleSignal() ? 'expand_less' : 'expand_more'" [ariaLabel]="formVisibleSignal() ? 'Hide the form' : 'Show the form'" [iconOnly]="true" [flat]="true" (buttonClick)="toggleFormVisible()"></dbx-button>
            @if (popoutEnabledSignal()) {
              <dbx-button icon="open_in_new" ariaLabel="Open the form in a dialog" [iconOnly]="true" [flat]="true" (buttonClick)="openFormPopout('dialog')"></dbx-button>
              <dbx-button icon="picture_in_picture_alt" ariaLabel="Open the form in a floating window" [iconOnly]="true" [flat]="true" (buttonClick)="openFormPopout('detach')"></dbx-button>
            }
          }
          @if (displaySignal().history) {
            <dbx-llm-flow-section-history-button></dbx-llm-flow-section-history-button>
          }
          @if (displaySignal().runButtons) {
            <dbx-llm-flow-section-run-buttons></dbx-llm-flow-section-run-buttons>
          }
        </div>
      </div>
      @if (hintSignal()) {
        <div class="dbx-llm-flow-section-hint dbx-hint">{{ hintSignal() }}</div>
      }
    }
    <div class="dbx-llm-flow-section-body">
      @if (showFormSignal()) {
        <div class="dbx-llm-flow-section-form">
          <dbx-injection [config]="formInjectionConfigSignal()"></dbx-injection>
        </div>
      }
      @if (displaySignal().rawInput) {
        <dbx-llm-flow-section-raw-input></dbx-llm-flow-section-raw-input>
      }
      @if (!displaySignal().header && displaySignal().runButtons) {
        <div class="dbx-llm-flow-section-actions">
          @if (displaySignal().history) {
            <dbx-llm-flow-section-history-button></dbx-llm-flow-section-history-button>
          }
          <dbx-llm-flow-section-run-buttons></dbx-llm-flow-section-run-buttons>
        </div>
      }
      @if (errorSignal(); as error) {
        <dbx-error class="dbx-llm-flow-section-error" [error]="error"></dbx-error>
      }
      <ng-content select="[dbxLlmFlowSectionOutput]"></ng-content>
      @if (showDefaultOutputSignal()) {
        <dbx-llm-flow-section-output></dbx-llm-flow-section-output>
      }
      <ng-content></ng-content>
    </div>
  `,
  host: {
    class: 'dbx-llm-flow-section',
    '[attr.data-status]': 'statusSignal()',
    '[class.dbx-llm-flow-section-running]': `statusSignal() === 'running'`
  },
  hostDirectives: [{ directive: DbxLlmFlowSectionDirective, inputs: ['dbxLlmFlowSection: config', 'parentKey'] }],
  imports: [DbxInjectionComponent, DbxButtonComponent, DbxChipDirective, DbxErrorComponent, DbxLlmFlowSectionRawInputComponent, DbxLlmFlowSectionRunButtonsComponent, DbxLlmFlowSectionHistoryButtonComponent, DbxLlmFlowSectionOutputComponent]
})
export class DbxLlmFlowSectionComponent {
  readonly sectionStore = inject(DbxLlmFlowSectionStore);
  readonly injector = inject(Injector);
  readonly matDialog = inject(MatDialog);
  readonly detachService = inject(DbxDetachService);

  /**
   * Display toggles. Overrides the config's display.
   */
  readonly display = input<Maybe<DbxLlmFlowSectionDisplayConfig>>();

  readonly projectedOutput = contentChild(DbxLlmFlowSectionOutputDirective);

  readonly configSignal = toSignal(this.sectionStore.config$);
  readonly statusSignal = toSignal(this.sectionStore.status$, { initialValue: 'idle' as DbxLlmFlowSectionStatus });
  readonly formHiddenSignal = toSignal(this.sectionStore.formHidden$, { initialValue: false });
  readonly lastFailedRunSignal = toSignal(this.sectionStore.lastFailedRun$);
  readonly formComponentSignal = toSignal(this.sectionStore.config$.pipe(map((x) => x?.formComponent)));
  readonly autoBindFormSignal = toSignal(this.sectionStore.config$.pipe(map((x) => x?.autoBindForm)));

  readonly formVisibleSignal = this.sectionStore.formVisible;

  readonly displaySignal = computed(() => dbxLlmFlowSectionResolvedDisplayConfig(this.configSignal()?.display, this.display()));
  readonly labelSignal = computed(() => {
    const config = this.configSignal();
    return config?.label ?? config?.key;
  });
  readonly hintSignal = computed(() => this.configSignal()?.hint);
  readonly statusTextSignal = computed(() => STATUS_TEXT[this.statusSignal()]);
  readonly statusColorSignal = computed(() => STATUS_COLOR[this.statusSignal()]);
  readonly formInjectionConfigSignal = computed(() => dbxLlmFlowSectionFormComponentInjectionConfig(this.formComponentSignal(), this.autoBindFormSignal(), this.sectionStore));
  readonly showFormControlsSignal = computed(() => {
    const display = this.displaySignal();
    const formInjectionConfig = this.formInjectionConfigSignal();
    return display.form && formInjectionConfig != null;
  });
  readonly popoutEnabledSignal = computed(() => this.configSignal()?.formPopout !== false);
  readonly showFormSignal = computed(() => {
    const showFormControls = this.showFormControlsSignal();
    const formVisible = this.formVisibleSignal();
    const formHidden = this.formHiddenSignal();
    return showFormControls && formVisible && !formHidden;
  });
  readonly showDefaultOutputSignal = computed(() => {
    const display = this.displaySignal();
    const projectedOutput = this.projectedOutput();
    return display.output && projectedOutput == null;
  });
  readonly errorSignal = computed(() => {
    const failed = this.lastFailedRunSignal();
    return this.statusSignal() === 'failed' && failed != null ? { code: failed.error?.code ?? 'ERROR', message: failed.error?.message ?? 'The run failed.' } : undefined;
  });

  private _dialogRef: Maybe<MatDialogRef<unknown, void>>;
  private _detachInstance: Maybe<DbxDetachInstance<unknown>>;
  private readonly _popoutClosedSub = cleanSubscription();

  constructor() {
    effect(() => {
      const mode = this.sectionStore.popout();
      untracked(() => this._syncPopout(mode));
    });

    // the section owns its pop-outs: its store dies with it
    inject(DestroyRef).onDestroy(() => {
      this._syncPopout(undefined);
    });
  }

  toggleFormVisible(): void {
    this.sectionStore.toggleFormVisible();
  }

  openFormPopout(mode: DbxLlmFlowSectionFormPopoutMode): void {
    this.sectionStore.openFormPopout(mode);
  }

  private _syncPopout(mode: Maybe<DbxLlmFlowSectionFormPopoutMode>): void {
    if (mode !== 'dialog' && this._dialogRef != null) {
      const dialogRef = this._dialogRef;
      this._dialogRef = undefined;
      dialogRef.close();
    }

    if (mode !== 'detach' && this._detachInstance != null) {
      const key = this._detachInstance.key;
      this._detachInstance = undefined;
      this.detachService.remove(key);
    }

    if (mode === 'dialog' && this._dialogRef == null) {
      const dialogRef = openDbxLlmFlowSectionFormDialog(this.matDialog, { injector: this.injector });
      this._dialogRef = dialogRef;
      this._popoutClosedSub.subscription = dialogRef.afterClosed().subscribe(() => this._onPopoutClosed(dialogRef));
    } else if (mode === 'detach' && this._detachInstance == null) {
      const instance = openDbxLlmFlowSectionFormDetach(this.detachService, { injector: this.injector, key: dbxLlmFlowSectionFormDetachKey(this.sectionStore.key) });
      this._detachInstance = instance;
      this._popoutClosedSub.subscription = instance.closing$.pipe(filter((x) => x)).subscribe(() => this._onPopoutClosed(instance));
    }
  }

  private _onPopoutClosed(ref: unknown): void {
    if (ref === this._dialogRef || ref === this._detachInstance) {
      this._dialogRef = undefined;
      this._detachInstance = undefined;
      this.sectionStore.closeFormPopout();
    }
  }
}
