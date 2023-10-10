import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxFormCalendarDateCellScheduleRangeFieldComponent } from './calendar.schedule.field.component';
import { FormlyModule } from '@ngx-formly/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { DbxTextModule } from '@dereekb/dbx-web';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DbxFormCalendarModule } from '../../calendar.module';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';

@NgModule({
  imports: [
    DbxInjectionComponentModule,
    CommonModule,
    MatIconModule,
    DbxFormCalendarModule,
    MatButtonModule,
    DbxTextModule,
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
    FormlyModule.forChild({
      types: [{ name: 'date-schedule-range', component: DbxFormCalendarDateCellScheduleRangeFieldComponent }]
    })
  ],
  declarations: [DbxFormCalendarDateCellScheduleRangeFieldComponent]
})
export class DbxFormDateCellScheduleRangeFieldModule {}
