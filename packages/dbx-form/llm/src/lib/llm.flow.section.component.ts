import { Component, computed, contentChild, DestroyRef, effect, forwardRef, inject, Injector, input, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { cleanSubscription, DbxInjectionComponent } from '@dereekb/dbx-core';
import { DbxButtonComponent, DbxChipDirective, DbxContentPitDirective, type DbxDetachInstance, DbxDetachService, DbxColorDirective, DbxErrorComponent, DbxHeightSyncFollowerDirective, DbxIconTileComponent } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { filter, map } from 'rxjs';
import { type DbxLlmFlowSectionDisplayConfig, type DbxLlmFlowSectionFormPopoutMode, type DbxLlmFlowSectionStatusChip } from './llm.flow';
import { DbxLlmFlowSectionDisplay, dbxLlmFlowSectionResolvedDisplayConfig } from './llm.flow.section.display';
import { DbxLlmFlowSectionDirective } from './llm.flow.section.directive';
import { DbxLlmFlowSectionStore, type DbxLlmFlowSectionStatus } from './llm.flow.section.store';
import { dbxLlmFlowSectionFormComponentInjectionConfig } from './llm.flow.section.form';
import { dbxLlmFlowSectionFormDetachKey, openDbxLlmFlowSectionFormDetach, openDbxLlmFlowSectionFormDialog } from './llm.flow.section.form.popout';
import { DbxLlmFlowSectionRawInputComponent } from './llm.flow.section.rawinput.component';
import { DbxLlmFlowSectionRunButtonsComponent } from './llm.flow.section.run.buttons.component';
import { DbxLlmFlowSectionHistoryButtonComponent } from './llm.flow.section.history.button.component';
import { DbxLlmFlowSectionOutputComponent, DbxLlmFlowSectionOutputDirective } from './llm.flow.section.output.component';

/**
 * The status chip of each run status, shown when the page sets no chip of its own.
 */
const RUN_STATUS_CHIPS: Readonly<Record<DbxLlmFlowSectionStatus, DbxLlmFlowSectionStatusChip>> = {
  idle: { text: 'Ready', color: 'grey' },
  running: { text: 'Running', color: 'primary' },
  success: { text: 'Done', color: 'ok' },
  failed: { text: 'Failed', color: 'warn' }
};

/**
 * A step of an LLM flow: a header (label, status, form toggle, pop-out and history buttons), the form (inside a content pit), the raw input
 * with the run buttons to its right, the last error and the output. The section reads top to bottom: input, run, output.
 *
 * The run buttons (one per run kind, stacked) take the raw input field's height through dbxHeightSync. When the raw input is hidden, they sit
 * in an actions row below the form instead. A section's optionFields render in the raw input's form, under the field, so the run buttons
 * stretch to cover the field and the options.
 *
 * With the display's stepNumber option on (the default), an icon tile before the label shows the section's step number in its chain: 1 for
 * a root section, plus one per ancestor. A section config's stepNumber fixes the number (0 works, e.g. for a setup step before the first run
 * step), and its descendants count on from it.
 *
 * The status chip after the label shows the run status (Ready, Running, Done or Failed), or the page's chip when the statusChip input is
 * set. The display's status option hides it.
 *
 * The collapse button at the end of the header's button row (the display's collapse option, on by default) collapses the section to its
 * header. The hint and the body are hidden with CSS, not destroyed, so a running action, the form binding and the raw input keep their state.
 * The collapsed state is kept in the flow state, so a persisted flow restores it.
 *
 * Registers the section through its DbxLlmFlowSectionDirective host directive. Content projected with dbxLlmFlowSectionOutput replaces the
 * default output, and can inject the DbxLlmFlowSectionStore.
 *
 * The form pops out to a dialog or a detach window when the section store's popout signal is set. Both are live-synced with the inline form.
 *
 * A view-only section (the config's viewOnly) has no runs: the header (step number, label, the page's status chip, hint and collapse button)
 * and the projected content as its body. Projected content can inject the DbxLlmFlowSectionStore. Its collapsed state persists with the flow;
 * a page can collapse it once something is set up with DbxLlmFlowStore.setCollapsed().
 *
 * The section config is set with the config input and the parent section with the parentKey input, both through the DbxLlmFlowSectionDirective
 * host directive. In the example below, setupConfig is `{ key: 'setup', label: 'Setup', viewOnly: true, stepNumber: 0 }`: a view-only step
 * numbered 0 with a bench projected as its body, before the run steps numbered 1, 2 and 3.
 *
 * @dbxWebComponent
 * @dbxWebSlug llm-flow-section
 * @dbxWebCategory layout
 * @dbxWebRelated llm-flow, llm-flow-host
 * @dbxWebContentProjection Default slot: the body content after the output, such as a view-only section's bench. `[dbxLlmFlowSectionOutput]` slot: replaces the default output.
 * @dbxWebMinimalExample ```html
 * <dbx-llm-flow-section [config]="sectionConfig"></dbx-llm-flow-section>
 * ```
 *
 * @example
 * ```html
 * <dbx-llm-flow-section [config]="setupConfig" [statusChip]="setupStatusChip()">
 *   <app-setup-bench></app-setup-bench>
 * </dbx-llm-flow-section>
 * <dbx-llm-flow-section [config]="briefConfig"></dbx-llm-flow-section>
 * <dbx-llm-flow-section [config]="outlineConfig" parentKey="brief" [display]="{ rawInput: false }"></dbx-llm-flow-section>
 * <dbx-llm-flow-section [config]="draftConfig" parentKey="outline" [display]="{ status: false }"></dbx-llm-flow-section>
 * ```
 */
@Component({
  selector: 'dbx-llm-flow-section',
  template: `
    @if (displaySignal().header) {
      <div class="dbx-llm-flow-section-header">
        <div class="dbx-llm-flow-section-header-label">
          @if (displaySignal().stepNumber) {
            <dbx-icon-tile class="dbx-llm-flow-section-step-number" [round]="true" dbxColor="primary">{{ stepNumberSignal() }}</dbx-icon-tile>
          }
          <span class="dbx-llm-flow-section-label dbx-text-title-medium">{{ labelSignal() }}</span>
          @if (statusChipSignal(); as chip) {
            <dbx-chip class="dbx-llm-flow-section-status" [small]="true" [color]="chip.color">{{ chip.text }}</dbx-chip>
          }
        </div>
        <span class="dbx-spacer"></span>
        <div class="dbx-llm-flow-section-header-actions">
          @if (showFormControlsSignal()) {
            @if (!collapsedSignal()) {
              <dbx-button [icon]="formVisibleSignal() ? 'expand_more' : 'expand_less'" [ariaLabel]="formVisibleSignal() ? 'Hide the form' : 'Show the form'" [iconOnly]="true" [flat]="true" (buttonClick)="toggleFormVisible()"></dbx-button>
            }
            @if (popoutEnabledSignal()) {
              <dbx-button icon="open_in_new" ariaLabel="Open the form in a dialog" [iconOnly]="true" [flat]="true" (buttonClick)="openFormPopout('dialog')"></dbx-button>
              <dbx-button icon="picture_in_picture_alt" ariaLabel="Open the form in a floating window" [iconOnly]="true" [flat]="true" (buttonClick)="openFormPopout('detach')"></dbx-button>
            }
          }
          @if (displaySignal().history) {
            <dbx-llm-flow-section-history-button></dbx-llm-flow-section-history-button>
          }
          @if (displaySignal().collapse) {
            <dbx-button class="dbx-llm-flow-section-collapse-button" [icon]="collapsedSignal() ? 'unfold_more' : 'unfold_less'" [ariaLabel]="collapsedSignal() ? 'Expand the section' : 'Collapse the section'" [iconOnly]="true" [flat]="true" (buttonClick)="toggleCollapsed()"></dbx-button>
          }
        </div>
      </div>
      @if (hintSignal()) {
        <div class="dbx-llm-flow-section-hint dbx-hint">{{ hintSignal() }}</div>
      }
    }
    <div class="dbx-llm-flow-section-body">
      @if (showFormSignal()) {
        <div class="dbx-llm-flow-section-form" dbxContentPit>
          <dbx-injection [config]="formInjectionConfigSignal()"></dbx-injection>
        </div>
      }
      @if (displaySignal().rawInput) {
        <dbx-llm-flow-section-raw-input>
          @if (displaySignal().runButtons) {
            <dbx-llm-flow-section-run-buttons dbxHeightSyncFollower></dbx-llm-flow-section-run-buttons>
          }
        </dbx-llm-flow-section-raw-input>
      }
      @if (showActionsRowSignal()) {
        <div class="dbx-llm-flow-section-actions">
          @if (!displaySignal().header && displaySignal().history) {
            <dbx-llm-flow-section-history-button></dbx-llm-flow-section-history-button>
          }
          @if (displaySignal().runButtons && !displaySignal().rawInput) {
            <dbx-llm-flow-section-run-buttons></dbx-llm-flow-section-run-buttons>
          }
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
    '[class.dbx-llm-flow-section-running]': `statusSignal() === 'running'`,
    '[class.dbx-llm-flow-section-collapsed]': 'collapsedSignal()',
    '[class.dbx-llm-flow-section-view-only]': 'viewOnlySignal()'
  },
  providers: [{ provide: DbxLlmFlowSectionDisplay, useExisting: forwardRef(() => DbxLlmFlowSectionComponent) }],
  hostDirectives: [{ directive: DbxLlmFlowSectionDirective, inputs: ['dbxLlmFlowSection: config', 'parentKey'] }],
  imports: [
    DbxInjectionComponent,
    DbxButtonComponent,
    DbxChipDirective,
    DbxColorDirective,
    DbxContentPitDirective,
    DbxErrorComponent,
    DbxHeightSyncFollowerDirective,
    DbxIconTileComponent,
    DbxLlmFlowSectionRawInputComponent,
    DbxLlmFlowSectionRunButtonsComponent,
    DbxLlmFlowSectionHistoryButtonComponent,
    DbxLlmFlowSectionOutputComponent
  ]
})
export class DbxLlmFlowSectionComponent implements DbxLlmFlowSectionDisplay {
  readonly sectionStore = inject(DbxLlmFlowSectionStore);
  readonly injector = inject(Injector);
  readonly matDialog = inject(MatDialog);
  readonly detachService = inject(DbxDetachService);

  /**
   * Display toggles. Overrides the config's display.
   */
  readonly display = input<Maybe<DbxLlmFlowSectionDisplayConfig>>();

  /**
   * The page's status chip, shown after the label in place of the run status. A view-only section shows only this chip. The display's status
   * option hides it.
   */
  readonly statusChip = input<Maybe<DbxLlmFlowSectionStatusChip>>();

  readonly projectedOutput = contentChild(DbxLlmFlowSectionOutputDirective);

  readonly configSignal = toSignal(this.sectionStore.config$);
  readonly statusSignal = toSignal(this.sectionStore.status$, { initialValue: 'idle' as DbxLlmFlowSectionStatus });
  readonly formHiddenSignal = toSignal(this.sectionStore.formHidden$, { initialValue: false });
  readonly collapsedStateSignal = toSignal(this.sectionStore.collapsed$, { initialValue: false });
  readonly lastFailedRunSignal = toSignal(this.sectionStore.lastFailedRun$);
  readonly stepNumberSignal = toSignal(this.sectionStore.stepNumber$, { initialValue: 1 });
  readonly formComponentSignal = toSignal(this.sectionStore.config$.pipe(map((x) => x?.formComponent)));
  readonly autoBindFormSignal = toSignal(this.sectionStore.config$.pipe(map((x) => x?.autoBindForm)));

  readonly formVisibleSignal = this.sectionStore.formVisible;

  readonly viewOnlySignal = computed(() => this.configSignal()?.viewOnly === true);
  readonly displaySignal = computed(() => {
    const config = this.configSignal();
    return dbxLlmFlowSectionResolvedDisplayConfig(config?.display, this.display(), config?.viewOnly);
  });

  /**
   * Whether the section shows only its header. Needs the header and its collapse button, so a section can't be collapsed to nothing.
   */
  readonly collapsedSignal = computed(() => {
    const display = this.displaySignal();
    const collapsed = this.collapsedStateSignal();
    return display.header && display.collapse && collapsed;
  });
  readonly showActionsRowSignal = computed(() => {
    const display = this.displaySignal();
    return (!display.header && display.history) || (display.runButtons && !display.rawInput);
  });
  readonly labelSignal = computed(() => {
    const config = this.configSignal();
    return config?.label ?? config?.key;
  });
  readonly hintSignal = computed(() => this.configSignal()?.hint);
  /**
   * The status chip after the label: the page's chip when set, otherwise the run status chip (none for a view-only section). Hidden while the
   * display's status option is off.
   */
  readonly statusChipSignal = computed<Maybe<DbxLlmFlowSectionStatusChip>>(() => {
    const display = this.displaySignal();
    const statusChip = this.statusChip();
    const viewOnly = this.viewOnlySignal();
    const status = this.statusSignal();
    let chip: Maybe<DbxLlmFlowSectionStatusChip>;

    if (display.status) {
      chip = statusChip ?? (viewOnly ? undefined : RUN_STATUS_CHIPS[status]);
    }

    return chip;
  });
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

  toggleCollapsed(): void {
    this.sectionStore.toggleCollapsed();
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
