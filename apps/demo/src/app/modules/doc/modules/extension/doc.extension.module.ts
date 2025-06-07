import { DocExtensionExampleScheduleSelectionCalendarDatePopoverContentComponent } from './component/example.calendar.schedule.selection.popover.content.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DocExtensionDownloadComponent } from './container/download.component';
import { DocExtensionHomeComponent } from './container/home.component';

import { DocExtensionLayoutComponent } from './container/layout.component';
import { DocExtensionCalendarComponent } from './container/calendar.component';
import { STATES } from './doc.extension.router';
import { DbxDownloadTextModule, DbxWidgetModule, DbxWidgetService } from '@dereekb/dbx-web';
import { DocExtensionWidgetComponent } from './container/widget.component';
import { DOC_EXTENSION_WIDGET_EXAMPLE_TYPE, DocExtensionWidgetExampleComponent } from './component/widget.example.component';
import { DocExtensionWidgetIconExampleComponent, DOC_EXTENSION_WIDGET_ICON_EXAMPLE_TYPE } from './component/widget.icon.example.component';

import { DocExtensionMapboxComponent } from './container/mapbox.component';
import { DbxFormMapboxModule } from '@dereekb/dbx-form/mapbox';
import { DbxMapboxModule } from '@dereekb/dbx-web/mapbox';
import { DbxTableDateModule, DbxTableModule } from '@dereekb/dbx-web/table';
import { DocExtensionMapboxContentExampleComponent } from './component/mapbox.content.example.component';
import { DocExtensionMapboxMarkersExampleComponent } from './component/mapbox.markers.example.component';
import { DbxCalendarModule } from '@dereekb/dbx-web/calendar';
import { DocExtensionCalendarScheduleSelectionComponent } from './component/selection.calendar.component';
import { DbxFormCalendarModule, DbxFormDateScheduleRangeFieldModule } from '@dereekb/dbx-form/calendar';
import { DocExtensionCalendarScheduleSelectionWithFilterComponent } from './component/selection.filter.calendar.component';
import { DocExtensionTableComponent } from './container/table.component';
import { DocExtensionTableItemActionExampleComponent } from './component/table.item.action.example.component';
import { DocExtensionTableItemCellExampleComponent } from './component/table.item.cell.example.component';
import { DocExtensionTableItemHeaderExampleComponent } from './component/table.item.header.example.component';
import { DocExtensionExampleScheduleSelectionCalendarDatePopoverButtonComponent } from './component/example.calendar.schedule.selection.popover.button.component';
import { DocExtensionExampleScheduleSelectionCalendarDatePopoverComponent } from './component/example.calendar.schedule.selection.popover.component';
import { DocExtensionStructureComponent } from './container/structure.component';
import { DocExtensionTableGroupHeaderExampleComponent } from './component/table.group.header.example.component';
import { DocExtensionTableGroupFooterExampleComponent } from './component/table.group.footer.example.component';

@NgModule({
  imports: [
    DbxCalendarModule,
    DbxFormCalendarModule,
    DbxFormDateScheduleRangeFieldModule,
    DbxWidgetModule,
    DbxMapboxModule,
    DbxFormMapboxModule,
    DbxDownloadTextModule,
    DbxTableModule,
    DbxTableDateModule,
    UIRouterModule.forChild({
      states: STATES
    }),
    // component
    DocExtensionExampleScheduleSelectionCalendarDatePopoverButtonComponent,
    DocExtensionExampleScheduleSelectionCalendarDatePopoverComponent,
    DocExtensionExampleScheduleSelectionCalendarDatePopoverContentComponent,
    DocExtensionWidgetExampleComponent,
    DocExtensionWidgetIconExampleComponent,
    DocExtensionMapboxContentExampleComponent,
    DocExtensionMapboxMarkersExampleComponent,
    DocExtensionCalendarScheduleSelectionComponent,
    DocExtensionCalendarScheduleSelectionWithFilterComponent,
    DocExtensionTableItemHeaderExampleComponent,
    DocExtensionTableItemCellExampleComponent,
    DocExtensionTableItemActionExampleComponent,
    DocExtensionTableGroupHeaderExampleComponent,
    DocExtensionTableGroupFooterExampleComponent,
    // container
    DocExtensionLayoutComponent,
    DocExtensionHomeComponent,
    DocExtensionCalendarComponent,
    DocExtensionTableComponent,
    DocExtensionWidgetComponent,
    DocExtensionMapboxComponent,
    DocExtensionStructureComponent,
    DocExtensionDownloadComponent
  ]
})
export class DocExtensionModule {
  constructor(dbxWidgetService: DbxWidgetService) {
    dbxWidgetService.register({
      type: DOC_EXTENSION_WIDGET_EXAMPLE_TYPE,
      componentClass: DocExtensionWidgetExampleComponent
    });

    dbxWidgetService.register({
      type: DOC_EXTENSION_WIDGET_ICON_EXAMPLE_TYPE,
      componentClass: DocExtensionWidgetIconExampleComponent
    });
  }
}
