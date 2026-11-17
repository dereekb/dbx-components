import { Component, type ElementRef, type Injector, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractPopoverDirective, type DbxPopoverKey, DbxPopoverInteractionModule, type DbxPopoverService } from '@dereekb/dbx-web';
import { type NgPopoverRef } from 'ng-overlay-container';
import { map } from 'rxjs';
import { DbxLlmFlowSectionStore } from './llm.flow.section.store';
import { DbxLlmFlowSectionHistoryListComponent } from './llm.flow.section.history.list.component';

/**
 * Default key of the section history popover.
 */
export const DEFAULT_DBX_LLM_FLOW_SECTION_HISTORY_POPOVER_KEY = 'llmflowsectionhistory';

/**
 * Config for {@link DbxLlmFlowSectionHistoryPopoverComponent.openPopover}.
 */
export interface DbxLlmFlowSectionHistoryPopoverConfig {
  readonly origin: ElementRef;
  /**
   * Injector that provides the DbxLlmFlowSectionStore.
   */
  readonly injector: Injector;
}

/**
 * Popover that shows the history of the section in its injector. Closes after a run is loaded.
 */
@Component({
  selector: 'dbx-llm-flow-section-history-popover',
  template: `
    <dbx-popover-content class="dbx-llm-flow-section-history-popover">
      <dbx-popover-header [header]="headerSignal()" icon="history"></dbx-popover-header>
      <dbx-popover-scroll-content>
        <dbx-llm-flow-section-history-list (runLoaded)="onRunLoaded($event.loaded)"></dbx-llm-flow-section-history-list>
      </dbx-popover-scroll-content>
    </dbx-popover-content>
  `,
  imports: [DbxPopoverInteractionModule, DbxLlmFlowSectionHistoryListComponent]
})
export class DbxLlmFlowSectionHistoryPopoverComponent extends AbstractPopoverDirective<void> {
  readonly sectionStore = inject(DbxLlmFlowSectionStore);

  readonly headerSignal = toSignal(this.sectionStore.config$.pipe(map((x) => (x?.label ? `${x.label} History` : 'History'))), { initialValue: 'History' });

  onRunLoaded(loaded: boolean): void {
    if (loaded) {
      this.close();
    }
  }

  static openPopover(popoverService: DbxPopoverService, { origin, injector }: DbxLlmFlowSectionHistoryPopoverConfig, popoverKey?: DbxPopoverKey): NgPopoverRef<unknown, void> {
    return popoverService.open({
      key: popoverKey ?? DEFAULT_DBX_LLM_FLOW_SECTION_HISTORY_POPOVER_KEY,
      origin,
      injector,
      isResizable: true,
      componentClass: DbxLlmFlowSectionHistoryPopoverComponent
    });
  }
}
