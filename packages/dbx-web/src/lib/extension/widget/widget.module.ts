import { NgModule } from '@angular/core';
import { DbxWidgetViewComponent } from './widget.component';
import { DbxWidgetListGridComponent, DbxWidgetListGridViewComponent, DbxWidgetListGridViewItemComponent } from './widget.list.component';

const importsAndExports = [DbxWidgetViewComponent, DbxWidgetListGridComponent, DbxWidgetListGridViewComponent, DbxWidgetListGridViewItemComponent];

/**
 * Contains components related to displaying "widgets" for pieces of data.
 *
 * @deprecated Import standalone components directly instead.
 *
 * @see DbxWidgetViewComponent
 * @see DbxWidgetListGridComponent
 * @see DbxWidgetListGridViewComponent
 * @see DbxWidgetListGridViewItemComponent
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxWidgetModule {}
