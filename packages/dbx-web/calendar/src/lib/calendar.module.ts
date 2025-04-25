import { NgModule } from '@angular/core';
import { DbxCalendarComponent } from './calendar.component';
import { DbxCalendarBaseComponent } from './calendar.base.component';

const importsAndExports = [DbxCalendarBaseComponent, DbxCalendarComponent];

/**
 * @deprecated import DbxCalendarBaseComponent, and DbxCalendarComponent directly
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxCalendarModule {}
