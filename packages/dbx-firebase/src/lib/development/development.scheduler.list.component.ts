import { Component, inject } from '@angular/core';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, AbstractDbxSelectionListViewDirective, DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE, DbxSelectionValueListViewConfig, provideDbxListView, DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE, DbxValueAsListItem, provideDbxListViewWrapper } from '@dereekb/dbx-web';
import { from, of } from 'rxjs';
import { ScheduledFunctionDevelopmentFirebaseFunctionListEntry } from '@dereekb/firebase';
import { DbxFirebaseDevelopmentSchedulerService } from './development.scheduler.service';
import { WorkUsingContext } from '@dereekb/rxjs';

export type ScheduledFunctionDevelopmentFirebaseFunctionListEntryWithSelection = DbxValueAsListItem<ScheduledFunctionDevelopmentFirebaseFunctionListEntry>;

@Component({
  selector: 'dbx-firebase-development-scheduler-list',
  template: DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE,
  providers: provideDbxListViewWrapper(DbxFirebaseDevelopmentSchedulerListComponent)
})
export class DbxFirebaseDevelopmentSchedulerListComponent extends AbstractDbxSelectionListWrapperDirective<ScheduledFunctionDevelopmentFirebaseFunctionListEntry> {
  constructor() {
    super({
      componentClass: DbxFirebaseDevelopmentSchedulerListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'dbx-firebase-development-scheduler-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE,
  providers: provideDbxListView(DbxFirebaseDevelopmentSchedulerListViewComponent)
})
export class DbxFirebaseDevelopmentSchedulerListViewComponent extends AbstractDbxSelectionListViewDirective<ScheduledFunctionDevelopmentFirebaseFunctionListEntry> {
  readonly config: DbxSelectionValueListViewConfig<ScheduledFunctionDevelopmentFirebaseFunctionListEntryWithSelection> = {
    componentClass: DbxFirebaseDevelopmentSchedulerListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, icon: y.icon, itemValue: y })))
  };
}

@Component({
  template: `
    <div dbxAction dbxActionValue fastTrigger [dbxActionHandler]="handleRun">
      <dbx-button dbxActionButton [text]="'Run ' + name"></dbx-button>
      <div *dbxActionHasSuccess="3000" class="dbx-success" dbxActionSuccess>Success</div>
    </div>
  `
})
export class DbxFirebaseDevelopmentSchedulerListViewItemComponent extends AbstractDbxValueListViewItemComponent<ScheduledFunctionDevelopmentFirebaseFunctionListEntry> {
  readonly dbxFirebaseDevelopmentSchedulerService = inject(DbxFirebaseDevelopmentSchedulerService);

  get name() {
    return this.itemValue.name;
  }

  readonly handleRun: WorkUsingContext<unknown, unknown> = (value, context) => {
    context.startWorkingWithObservable(from(this.dbxFirebaseDevelopmentSchedulerService.runScheduledFunction(this.name)));
  };
}
