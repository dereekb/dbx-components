import { NgModule } from '@angular/core';
import { DateFromToTimePipe } from './datefromtoformat.pipe';
import { MinutesStringPipe } from './minutesstring.pipe';
import { TimeDistanceCountdownPipe, TimeDistancePipe } from './timedistance.pipe';
import { ToJsDatePipe } from './tojsdate.pipe';
import { ToMinutesPipe } from './tominutes.pipe';
import { DateFormatDistancePipe } from './dateformatdistance.pipe';
import { DateDistancePipe } from './datedistance.pipe';
import { DateDayRangePipe } from './datedayrange.pipe';
import { DateTimeRangePipe } from './datetimerange.pipe';
import { DateDayTimeRangePipe } from './datedaytimerange.pipe';
import { DateTimeRangeOnlyPipe } from './datetimerangeonly.pipe';
import { DateTimeRangeOnlyDistancePipe } from './datetimerangeonlydistance.pipe';
import { TargetDateToSystemDatePipe } from './targetdatetosystemdate.pipe';
import { TimezoneAbbreviationPipe } from './timezoneabbreviation.pipe';
import { SystemDateToTargetDatePipe } from './systemdatetotargetdate.pipe';
import { DateRangeDistancePipe } from './daterangedistance.pipe';

const declarations = [
  //
  DateDistancePipe,
  DateRangeDistancePipe,
  TargetDateToSystemDatePipe,
  SystemDateToTargetDatePipe,
  TimezoneAbbreviationPipe,
  DateFromToTimePipe,
  DateDayRangePipe,
  DateDayTimeRangePipe,
  DateTimeRangeOnlyPipe,
  DateTimeRangePipe,
  DateTimeRangeOnlyDistancePipe,
  DateFormatDistancePipe,
  MinutesStringPipe,
  TimeDistanceCountdownPipe,
  TimeDistancePipe,
  ToJsDatePipe,
  ToMinutesPipe
];

@NgModule({
  declarations,
  exports: declarations
})
export class DbxDatePipeModule {}
