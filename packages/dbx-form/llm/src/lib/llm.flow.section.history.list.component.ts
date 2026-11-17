import { Component, computed, inject, input, LOCALE_ID, output } from '@angular/core';
import { formatDate } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { DbxButtonComponent, DbxChipDirective } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { isSameDay } from 'date-fns';
import { map } from 'rxjs';
import { type DbxLlmFlowRun, type DbxLlmFlowRunDescription, type DbxLlmFlowRunKind, type DbxLlmFlowRunState } from './llm.flow';
import { DbxLlmFlowSectionStore } from './llm.flow.section.store';

/**
 * A row of the section history list.
 */
export interface DbxLlmFlowSectionHistoryRow {
  readonly run: DbxLlmFlowRun;
  readonly description: DbxLlmFlowRunDescription;
  readonly icon: string;
  /**
   * Label of the run's kind: the kind config's text, or the kind itself.
   */
  readonly kindLabel: string;
  /**
   * When the run started: a time with seconds, prefixed with the date when the run is not from today.
   */
  readonly startedAtText: string;
  /**
   * Whether the run is the section's primary selection (the run whose output the section shows).
   */
  readonly selected: boolean;
}

/**
 * A group of history rows.
 */
export interface DbxLlmFlowSectionHistoryRowGroup {
  readonly label: string;
  readonly rows: readonly DbxLlmFlowSectionHistoryRow[];
}

/**
 * Event emitted when the list loads a run.
 */
export interface DbxLlmFlowSectionHistoryLoadEvent {
  readonly run: DbxLlmFlowRun;
  readonly withAncestors: boolean;
  readonly loaded: boolean;
}

const RUN_STATE_ICONS: Record<DbxLlmFlowRunState, string> = {
  running: 'hourglass_top',
  success: 'check_circle',
  failed: 'error'
};

/**
 * Date format of a history row's start time when the run is from today.
 */
export const DBX_LLM_FLOW_SECTION_HISTORY_TIME_FORMAT = 'h:mm:ss a';

/**
 * Date format of a history row's start time when the run is not from today.
 */
export const DBX_LLM_FLOW_SECTION_HISTORY_DATE_TIME_FORMAT = 'MMM d, h:mm:ss a';

/**
 * Lists the runs of the nearest section, newest first, in two groups: runs made from the currently followed parent run, and other branches.
 * Each row shows the run's description, its start time with seconds, its kind label (when the section has several kinds), and marks the
 * section's primary selection (the run whose output is shown).
 *
 * Clicking a row loads the run (its input, and the latest runs of every descendant section made from it). A run with a parent also has a
 * "Load with parents" action that loads the run's ancestors too. Loading is disabled while the section runs.
 *
 * @example
 * ```html
 * <dbx-llm-flow-section-history-list (runLoaded)="close()"></dbx-llm-flow-section-history-list>
 * ```
 */
@Component({
  selector: 'dbx-llm-flow-section-history-list',
  template: `
    @for (group of groupsSignal(); track group.label) {
      <div class="dbx-llm-flow-section-history-group">
        @if (showGroupLabelsSignal()) {
          <div class="dbx-llm-flow-section-history-group-label dbx-label dbx-small">{{ group.label }}</div>
        }
        @for (row of group.rows; track row.run.id) {
          <div class="dbx-llm-flow-section-history-row" [class.dbx-llm-flow-section-history-row-selected]="row.selected" [attr.data-state]="row.run.state">
            <mat-icon class="dbx-llm-flow-section-history-row-icon">{{ row.icon }}</mat-icon>
            <button type="button" class="dbx-llm-flow-section-history-row-main" [disabled]="isRunningSignal()" (click)="loadRun(row.run, false)">
              <span class="dbx-llm-flow-section-history-row-title">{{ row.description.title }}</span>
              @if (row.description.detail) {
                <span class="dbx-llm-flow-section-history-row-detail dbx-hint dbx-small">{{ row.description.detail }}</span>
              }
              <span class="dbx-llm-flow-section-history-row-time dbx-hint dbx-small">{{ row.startedAtText }}</span>
            </button>
            @if (showKindsSignal()) {
              <dbx-chip [small]="true">{{ row.kindLabel }}</dbx-chip>
            }
            @if (row.selected) {
              <dbx-chip [small]="true" color="primary">selected</dbx-chip>
            }
            @if (row.run.parentRunId) {
              <dbx-button icon="account_tree" ariaLabel="Load with parents" [iconOnly]="true" [flat]="true" [disabled]="isRunningSignal()" (buttonClick)="loadRun(row.run, true)"></dbx-button>
            }
          </div>
        }
      </div>
    } @empty {
      <p class="dbx-llm-flow-section-history-empty dbx-hint">No runs yet.</p>
    }
  `,
  host: {
    class: 'dbx-llm-flow-section-history-list'
  },
  imports: [MatIconModule, DbxButtonComponent, DbxChipDirective]
})
export class DbxLlmFlowSectionHistoryListComponent {
  readonly sectionStore = inject(DbxLlmFlowSectionStore);
  readonly locale = inject(LOCALE_ID);

  /**
   * Whether to show each run's kind. Defaults to showing kinds when the section has more than one run kind.
   */
  readonly showKinds = input<Maybe<boolean>>();

  readonly runLoaded = output<DbxLlmFlowSectionHistoryLoadEvent>();

  readonly configSignal = toSignal(this.sectionStore.config$);
  readonly isRunningSignal = toSignal(this.sectionStore.isRunning$, { initialValue: false });
  readonly historyGroupsSignal = toSignal(this.sectionStore.historyGroups$);
  readonly selectedRunIdSignal = toSignal(this.sectionStore.selectedRun$.pipe(map((x) => x?.id)));

  readonly showKindsSignal = computed(() => {
    const showKinds = this.showKinds();
    const kindsCount = this.configSignal()?.kinds?.length ?? 0;
    return showKinds ?? kindsCount > 1;
  });

  readonly kindLabelsSignal = computed(() => {
    const kinds = this.configSignal()?.kinds ?? [];
    return new Map<DbxLlmFlowRunKind, string>(kinds.map((x) => [x.kind, x.text ?? x.kind]));
  });

  readonly groupsSignal = computed(() => {
    const historyGroups = this.historyGroupsSignal();
    const selectedRunId = this.selectedRunIdSignal();
    const kindLabels = this.kindLabelsSignal();
    const now = new Date();
    this.configSignal(); // describeRun may come from the config

    const toRow = (run: DbxLlmFlowRun): DbxLlmFlowSectionHistoryRow => ({
      run,
      description: this.sectionStore.describeRun(run),
      icon: RUN_STATE_ICONS[run.state],
      kindLabel: kindLabels.get(run.kind) ?? run.kind,
      startedAtText: formatDate(run.startedAt, isSameDay(run.startedAt, now) ? DBX_LLM_FLOW_SECTION_HISTORY_TIME_FORMAT : DBX_LLM_FLOW_SECTION_HISTORY_DATE_TIME_FORMAT, this.locale),
      selected: run.id === selectedRunId
    });
    const groups: DbxLlmFlowSectionHistoryRowGroup[] = [];

    if (historyGroups?.current.length) {
      groups.push({ label: 'Current', rows: historyGroups.current.map(toRow) });
    }

    if (historyGroups?.other.length) {
      groups.push({ label: 'Other branches', rows: historyGroups.other.map(toRow) });
    }

    return groups;
  });

  readonly showGroupLabelsSignal = computed(() => {
    const groups = this.groupsSignal();
    return groups.length > 1 || groups[0]?.label !== 'Current';
  });

  loadRun(run: DbxLlmFlowRun, withAncestors: boolean): void {
    const loaded = this.sectionStore.loadRun(run.id, withAncestors);
    this.runLoaded.emit({ run, withAncestors, loaded });
  }
}
