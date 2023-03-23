import { NgModule } from '@angular/core';
import { DateFromToTimePipe } from './datefromtoformat.pipe';
import { MinutesStringPipe } from './minutesstring.pipe';
import { TimeDistanceCountdownPipe, TimeDistancePipe } from './timedistance.pipe';
import { ToJsDatePipe } from './tojsdate.pipe';
import { ToMinutesPipe } from './tominutes.pipe';
import { DateFormatDistancePipe } from './dateformatdistance.pipe';
import { DateDistancePipe } from './datedistance.pipe';
import { DateDayRangePipe } from './datedayrange.pipe';

const declarations = [DateFromToTimePipe, DateDayRangePipe, DateFormatDistancePipe, MinutesStringPipe, TimeDistanceCountdownPipe, TimeDistancePipe, DateDistancePipe, ToJsDatePipe, ToMinutesPipe];

@NgModule({
  exports: declarations,
  declarations
})
export class DbxDatePipeModule {}
