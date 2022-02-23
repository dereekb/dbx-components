import { NgModule } from '@angular/core';
import { DateFromToTimePipe } from './datefromtoformat.pipe';
import { MinutesStringPipe } from './minutesstring.pipe';
import { TimeDistanceCountdownPipe, TimeDistancePipe } from './timedistance.pipe';
import { ToJsDatePipe } from './tojsdate.pipe';
import { ToMinutesPipe } from './tominutes.pipe';
import { DateFormatDistancePipe } from './dateformatdistance.pipe';
import { DateDistancePipe } from './datedistance.pipe';

@NgModule({
  exports: [
    DateFromToTimePipe,
    DateFormatDistancePipe,
    MinutesStringPipe,
    TimeDistanceCountdownPipe,
    TimeDistancePipe,
    DateDistancePipe,
    ToJsDatePipe,
    ToMinutesPipe
  ],
  declarations: [
    DateFromToTimePipe,
    DateFormatDistancePipe,
    MinutesStringPipe,
    TimeDistanceCountdownPipe,
    TimeDistancePipe,
    DateDistancePipe,
    ToJsDatePipe,
    ToMinutesPipe
  ]
})
export class DbxDatePipeModule { }
