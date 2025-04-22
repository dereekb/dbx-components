import { NgModule } from '@angular/core';
import { DbxFormCalendarDateScheduleRangeFieldComponent } from './calendar.schedule.field.component';
import { FormlyModule } from '@ngx-formly/core';

const importsAndExports = [DbxFormCalendarDateScheduleRangeFieldComponent];

@NgModule({
  imports: [
    ...importsAndExports,
    FormlyModule.forChild({
      types: [{ name: 'date-schedule-range', component: DbxFormCalendarDateScheduleRangeFieldComponent }]
    })
  ],
  exports: importsAndExports
})
export class DbxFormDateScheduleRangeFieldModule {}
