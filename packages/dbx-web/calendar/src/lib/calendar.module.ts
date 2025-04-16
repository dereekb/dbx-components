import { NgModule } from '@angular/core';
import { DbxCalendarComponent } from './calendar.component';
import { CalendarDayModule, CalendarModule, CalendarWeekModule, DateAdapter } from 'angular-calendar';
import { CommonModule } from '@angular/common';
import { DbxButtonModule, DbxPopoverInteractionModule } from '@dereekb/dbx-web';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
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
