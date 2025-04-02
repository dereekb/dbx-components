import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxListLayoutModule } from '../../layout/list/list.layout.module';
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
