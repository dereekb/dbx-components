import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxListLayoutModule } from '../../layout/list/list.layout.module';
import { DbxWidgetViewComponent } from './widget.component';
import { DbxWidgetListGridComponent, DbxWidgetListGridViewComponent, DbxWidgetListGridViewItemComponent } from './widget.list.component';

/**
 * Contains components related to displaying "widgets" for pieces of data.
 */
@NgModule({
  imports: [
    //
    CommonModule,
    DbxListLayoutModule,
    DbxInjectionComponentModule
  ],
  declarations: [DbxWidgetViewComponent, DbxWidgetListGridComponent, DbxWidgetListGridViewComponent, DbxWidgetListGridViewItemComponent],
  exports: [DbxWidgetViewComponent, DbxWidgetListGridComponent, DbxWidgetListGridViewComponent, DbxWidgetListGridViewItemComponent]
})
export class DbxWidgetModule {}
