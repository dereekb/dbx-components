import { Guestbook } from '@dereekb/demo-firebase';
import { Component, Inject } from '@angular/core';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, AbstractDbxSelectionListViewDirective, DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE, DbxSelectionValueListViewConfig, provideDbxListView, DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE, DbxValueAsListItem, provideDbxListViewWrapper, DBX_VALUE_LIST_VIEW_ITEM, DbxValueListItem } from '@dereekb/dbx-web';
import { from, of } from 'rxjs';
import { ScheduledFunctionDevelopmentFirebaseFunctionListEntry } from '@dereekb/firebase';
import { DbxFirebaseDevelopmentSchedulerService } from './development.scheduler.service';
import { HandleActionWithContext } from '@dereekb/dbx-core';

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
      <dbx-success *dbxActionHasSuccess="3000" dbxActionSuccess>Success</dbx-success>
    </div>
  `
})
export class DbxFirebaseDevelopmentSchedulerListViewItemComponent extends AbstractDbxValueListViewItemComponent<ScheduledFunctionDevelopmentFirebaseFunctionListEntry> {
  get name() {
    return this.itemValue.name;
  }

  constructor(@Inject(DBX_VALUE_LIST_VIEW_ITEM) item: DbxValueListItem<ScheduledFunctionDevelopmentFirebaseFunctionListEntry>, readonly dbxFirebaseDevelopmentSchedulerService: DbxFirebaseDevelopmentSchedulerService) {
    super(item);
  }

  readonly handleRun: HandleActionWithContext<unknown, unknown> = (value, context) => {
    context.startWorkingWithObservable(from(this.dbxFirebaseDevelopmentSchedulerService.runScheduledFunction(this.name)));
  };
}
