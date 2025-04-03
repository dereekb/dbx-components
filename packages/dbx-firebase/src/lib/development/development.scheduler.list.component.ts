import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, AbstractDbxSelectionListViewDirective, DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE, DbxSelectionValueListViewConfig, provideDbxListView, DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE, DbxValueAsListItem, provideDbxListViewWrapper, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION, DbxActionModule, DbxButtonComponent } from '@dereekb/dbx-web';
import { from, of } from 'rxjs';
import { ScheduledFunctionDevelopmentFirebaseFunctionListEntry } from '@dereekb/firebase';
import { DbxFirebaseDevelopmentSchedulerService } from './development.scheduler.service';
import { WorkUsingContext } from '@dereekb/rxjs';
import { DbxActionButtonDirective, DbxButton } from '@dereekb/dbx-core';

export type ScheduledFunctionDevelopmentFirebaseFunctionListEntryWithSelection = DbxValueAsListItem<ScheduledFunctionDevelopmentFirebaseFunctionListEntry>;

@Component({
  selector: 'dbx-firebase-development-scheduler-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION.template,
  imports: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION.imports,
  changeDetection: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION.changeDetection,
  providers: provideDbxListViewWrapper(DbxFirebaseDevelopmentSchedulerListComponent),
  standalone: true
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
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION.template,
  imports: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION.imports,
  changeDetection: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION.changeDetection,
  providers: provideDbxListView(DbxFirebaseDevelopmentSchedulerListViewComponent),
  standalone: true
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
  `,
  imports: [DbxActionModule, DbxButtonComponent, DbxActionButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
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
