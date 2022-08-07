import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxWidgetViewComponent } from './widget.component';

/**
 * Contains components related to displaying "widgets" for pieces of data.
 */
@NgModule({
  imports: [
    //
    CommonModule,
    DbxInjectionComponentModule
  ],
  declarations: [DbxWidgetViewComponent],
  exports: [DbxWidgetViewComponent]
})
export class DbxWidgetModule {}
