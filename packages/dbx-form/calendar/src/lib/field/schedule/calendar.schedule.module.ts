import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxFormCalendarDateScheduleRangeFieldComponent } from './calendar.schedule.field.component';
import { FormlyModule } from '@ngx-formly/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
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
    MatLegacyInputModule,
    FormlyModule.forChild({
      types: [{ name: 'date-schedule-range', component: DbxFormCalendarDateScheduleRangeFieldComponent }]
    })
  ],
  declarations: [DbxFormCalendarDateScheduleRangeFieldComponent]
})
export class DbxFormDateScheduleRangeFieldModule {}
