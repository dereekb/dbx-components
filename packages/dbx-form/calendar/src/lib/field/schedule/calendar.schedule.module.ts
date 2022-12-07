import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxFormCalendarScheduleFieldComponent } from './calendar.schedule.field.component';
import { FormlyModule } from '@ngx-formly/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { DbxTextModule } from '@dereekb/dbx-web';
import { NgxMapboxGLModule } from 'ngx-mapbox-gl';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DbxMapboxModule } from '@dereekb/dbx-web/mapbox';
import { DbxFormCalendarModule } from '../../calendar.module';

// TODO: Rename to DateScheduleRange

@NgModule({
  imports: [
    CommonModule,
    MatIconModule,
    DbxFormCalendarModule,
    MatButtonModule,
    DbxTextModule,
    DbxMapboxModule,
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
    FormlyModule.forChild({
      types: [{ name: 'calendar-schedule', component: DbxFormCalendarScheduleFieldComponent }]
    }),
    NgxMapboxGLModule
  ],
  declarations: [DbxFormCalendarScheduleFieldComponent]
})
export class DbxFormCalendarScheduleFieldModule {}
