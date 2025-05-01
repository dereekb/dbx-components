import { Component, OnDestroy } from '@angular/core';
import { type Maybe, type TimezoneString } from '@dereekb/util';
import { dateTimeField, timezoneStringField } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { BehaviorSubject, delay, map, of, shareReplay } from 'rxjs';
import { DateRangeType, dateRange, guessCurrentTimezone } from '@dereekb/date';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxContentBorderDirective } from '@dereekb/dbx-web';
import { DbxDetailBlockComponent } from '@dereekb/dbx-web';
import { DocFormExampleComponent } from '../../form/component/example.form.component';
import { DbxFormlyFieldsContextDirective } from '@dereekb/dbx-form';
import { DbxFormSourceDirective } from '@dereekb/dbx-form';
import { DbxFormValueChangeDirective } from '@dereekb/dbx-form';
import { AsyncPipe, DatePipe } from '@angular/common';
import { DateDistancePipe } from '@dereekb/dbx-core';
import { DateRangeDistancePipe } from '@dereekb/dbx-core';
import { TargetDateToSystemDatePipe } from '@dereekb/dbx-core';
import { SystemDateToTargetDatePipe } from '@dereekb/dbx-core';
import { TimezoneAbbreviationPipe } from '@dereekb/dbx-core';
import { DateDayRangePipe } from '@dereekb/dbx-core';
import { DateDayTimeRangePipe } from '@dereekb/dbx-core';
import { DateTimeRangeOnlyPipe } from '@dereekb/dbx-core';
import { DateTimeRangePipe } from '@dereekb/dbx-core';
import { DateTimeRangeOnlyDistancePipe } from '@dereekb/dbx-core';
import { MinutesStringPipe } from '@dereekb/dbx-core';
import { TimeDistanceCountdownPipe, TimeDistancePipe } from '@dereekb/dbx-core';
import { DbxFormTimezoneStringFieldModule } from '@dereekb/dbx-form';

@Component({
  templateUrl: './pipes.component.html',
  standalone: true,
  imports: [
    DbxContentContainerDirective,
    DocFeatureLayoutComponent,
    DocFeatureExampleComponent,
    DbxContentBorderDirective,
    DbxDetailBlockComponent,
    DocFormExampleComponent,
    DbxFormlyFieldsContextDirective,
    DbxFormSourceDirective,
    DbxFormValueChangeDirective,
    AsyncPipe,
    DatePipe,
    DateDistancePipe,
    DateRangeDistancePipe,
    TargetDateToSystemDatePipe,
    SystemDateToTargetDatePipe,
    TimezoneAbbreviationPipe,
    DateDayRangePipe,
    DateDayTimeRangePipe,
    DateTimeRangeOnlyPipe,
    DateTimeRangePipe,
    DateTimeRangeOnlyDistancePipe,
    MinutesStringPipe,
    TimeDistanceCountdownPipe,
    TimeDistancePipe,
    DbxFormTimezoneStringFieldModule
  ]
})
export class DocTextPipesComponent implements OnDestroy {
  // TODO: Should not require a delay to set the value properly
  readonly dateAndTimezoneInitial = of({
    date: new Date(),
    timezone: guessCurrentTimezone()
  }).pipe(delay(80));

  private _date = new BehaviorSubject<Maybe<Date>>(undefined);
  private _timezone = new BehaviorSubject<Maybe<TimezoneString>>(null);

  readonly daylightSavingsDate = new Date('2022-03-01T06:00:00.000Z');
  readonly nonDaylightSavingsDate = new Date('2022-04-01T06:00:00.000Z');

  readonly date$ = this._date.pipe(shareReplay(1));
  readonly dateRange$ = this.date$.pipe(
    map((date) => dateRange({ date: date ?? undefined, type: DateRangeType.DAYS_RANGE, distance: 15 })),
    shareReplay(1)
  );
  readonly zeroDayDateRange$ = this.date$.pipe(
    map((date) => dateRange({ date: date ?? undefined, type: DateRangeType.DAY })),
    shareReplay(1)
  );

  readonly end$ = this.dateRange$.pipe(map((x) => x.end));
  readonly timezone$ = this._timezone.asObservable();
  readonly dateTimezoneFields: FormlyFieldConfig[] = [
    //
    dateTimeField({ timezone: this.timezone$, key: 'date', required: true, description: 'This is the default date field that requires the user pick a date and time.' }),
    timezoneStringField({ required: false })
  ];

  readonly onDateTimezoneChange = (value: { date: Maybe<Date>; timezone: Maybe<TimezoneString> }) => {
    this._date.next(value?.date);
    this._timezone.next(value?.timezone);
  };

  ngOnDestroy(): void {
    this._date.complete();
    this._timezone.complete();
  }
}
