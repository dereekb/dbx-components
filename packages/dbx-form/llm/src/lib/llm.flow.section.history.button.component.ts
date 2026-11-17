import { Component, ElementRef, Injector, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatBadgeModule } from '@angular/material/badge';
import { DbxButtonComponent, DbxPopoverService } from '@dereekb/dbx-web';
import { map } from 'rxjs';
import { DbxLlmFlowSectionStore } from './llm.flow.section.store';
import { DbxLlmFlowSectionHistoryPopoverComponent } from './llm.flow.section.history.popover.component';

/**
 * Icon button with a run-count badge that opens the section history popover.
 *
 * @example
 * ```html
 * <dbx-llm-flow-section-history-button></dbx-llm-flow-section-history-button>
 * ```
 */
@Component({
  selector: 'dbx-llm-flow-section-history-button',
  template: `
    <span class="dbx-llm-flow-section-history-button-badge" matBadgeSize="small" [matBadge]="runCountSignal()" [matBadgeHidden]="!hasRunsSignal()">
      <dbx-button #historyButton icon="history" ariaLabel="Run history" [iconOnly]="true" [flat]="true" [disabled]="!hasRunsSignal()" (buttonClick)="openHistory()"></dbx-button>
    </span>
  `,
  host: {
    class: 'dbx-llm-flow-section-history-button'
  },
  imports: [MatBadgeModule, DbxButtonComponent]
})
export class DbxLlmFlowSectionHistoryButtonComponent {
  readonly injector = inject(Injector);
  readonly popoverService = inject(DbxPopoverService);
  readonly sectionStore = inject(DbxLlmFlowSectionStore);

  readonly historyButton = viewChild.required('historyButton', { read: ElementRef });

  readonly runCountSignal = toSignal(this.sectionStore.runs$.pipe(map((x) => x.length)), { initialValue: 0 });
  readonly hasRunsSignal = computed(() => this.runCountSignal() > 0);

  openHistory(): void {
    DbxLlmFlowSectionHistoryPopoverComponent.openPopover(this.popoverService, { origin: this.historyButton(), injector: this.injector });
  }
}
