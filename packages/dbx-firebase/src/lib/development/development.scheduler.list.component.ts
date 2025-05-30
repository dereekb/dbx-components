import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, AbstractDbxSelectionListViewDirective, DbxSelectionValueListViewConfig, provideDbxListView, DbxValueAsListItem, provideDbxListViewWrapper, DbxActionModule, DbxButtonComponent, DbxListWrapperComponentImportsModule, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DbxSelectionValueListViewComponentImportsModule, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE } from '@dereekb/dbx-web';
import { from, of } from 'rxjs';
import { ScheduledFunctionDevelopmentFirebaseFunctionListEntry } from '@dereekb/firebase';
import { DbxFirebaseDevelopmentSchedulerService } from './development.scheduler.service';
import { WorkUsingContext } from '@dereekb/rxjs';
import { DbxActionButtonDirective } from '@dereekb/dbx-core';

export type ScheduledFunctionDevelopmentFirebaseFunctionListEntryWithSelection = DbxValueAsListItem<ScheduledFunctionDevelopmentFirebaseFunctionListEntry>;

@Component({
  selector: 'dbx-firebase-development-scheduler-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxSelectionValueListViewComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    <div dbxAction dbxActionValue useFastTriggerPreset [dbxActionHandler]="handleRun">
      <dbx-button dbxActionButton [text]="'Run ' + name"></dbx-button>
      <div *dbxActionHasSuccess="3000" class="dbx-success">Success</div>
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
