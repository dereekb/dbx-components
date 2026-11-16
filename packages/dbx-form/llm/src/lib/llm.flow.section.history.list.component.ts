import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { DateDistancePipe } from '@dereekb/dbx-core';
import { DbxButtonComponent, DbxChipDirective } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { map } from 'rxjs';
import { type DbxLlmFlowRun, type DbxLlmFlowRunDescription, type DbxLlmFlowRunState } from './llm.flow';
import { DbxLlmFlowSectionStore } from './llm.flow.section.store';

/**
 * A row of the section history list.
 */
export interface DbxLlmFlowSectionHistoryRow {
  readonly run: DbxLlmFlowRun;
  readonly description: DbxLlmFlowRunDescription;
  readonly icon: string;
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
 * Lists the runs of the nearest section, newest first, in two groups: runs made from the currently followed parent run, and other branches.
 *
 * Clicking a row loads the run (its input, and the latest runs of every descendant section made from it). The secondary actions are
 * "Load with parents" (also loads the run's ancestors) and "Reroll" (reruns the same input). Loading is disabled while the section runs.
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
              <span class="dbx-llm-flow-section-history-row-time dbx-hint dbx-small">{{ row.run.startedAt | dateDistance }}</span>
            </button>
            @if (showKindsSignal()) {
              <dbx-chip [small]="true">{{ row.run.kind }}</dbx-chip>
            }
            @if (row.selected) {
              <dbx-chip [small]="true" color="primary">selected</dbx-chip>
            }
            @if (row.run.parentRunId) {
              <dbx-button icon="account_tree" ariaLabel="Load with parents" [iconOnly]="true" [flat]="true" [disabled]="isRunningSignal()" (buttonClick)="loadRun(row.run, true)"></dbx-button>
            }
            <dbx-button icon="replay" ariaLabel="Reroll" [iconOnly]="true" [flat]="true" [disabled]="isRunningSignal()" (buttonClick)="rerun(row.run)"></dbx-button>
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
  imports: [MatIconModule, DbxButtonComponent, DbxChipDirective, DateDistancePipe]
})
export class DbxLlmFlowSectionHistoryListComponent {
  readonly sectionStore = inject(DbxLlmFlowSectionStore);

  /**
   * Whether to show each run's kind. Defaults to showing kinds when the section has more than one run kind.
   */
  readonly showKinds = input<Maybe<boolean>>();

  readonly runLoaded = output<DbxLlmFlowSectionHistoryLoadEvent>();

  readonly configSignal = toSignal(this.sectionStore.config$);
  readonly isRunningSignal = toSignal(this.sectionStore.isRunning$, { initialValue: false });
  readonly historyGroupsSignal = toSignal(this.sectionStore.historyGroups$);
  readonly selectedRunIdsSignal = toSignal(this.sectionStore.selectedRuns$.pipe(map((x) => new Set(x.map((y) => y.id)))), { initialValue: new Set<string>() });

  readonly showKindsSignal = computed(() => {
    const showKinds = this.showKinds();
    const kindsCount = this.configSignal()?.kinds?.length ?? 0;
    return showKinds ?? kindsCount > 1;
  });

  readonly groupsSignal = computed(() => {
    const historyGroups = this.historyGroupsSignal();
    const selectedRunIds = this.selectedRunIdsSignal();
    this.configSignal(); // describeRun may come from the config

    const toRow = (run: DbxLlmFlowRun): DbxLlmFlowSectionHistoryRow => ({ run, description: this.sectionStore.describeRun(run), icon: RUN_STATE_ICONS[run.state], selected: selectedRunIds.has(run.id) });
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

  rerun(run: DbxLlmFlowRun): void {
    this.sectionStore.rerun(run.id);
  }
}
