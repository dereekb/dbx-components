import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Component } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DateFromPlusToPipe } from './datefromtoformat.pipe';
import { DateFormatDistancePipe } from './dateformatdistance.pipe';
import { MinutesStringPipe } from './minutesstring.pipe';
import { TimeDistancePipe } from './timedistance.pipe';
import { ToJsDatePipe } from './tojsdate.pipe';
import { ToMinutesPipe } from './tominutes.pipe';

describe('Date Pipe Test Component', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, DateFromPlusToPipe, DateFormatDistancePipe, MinutesStringPipe, TimeDistancePipe, ToJsDatePipe, ToMinutesPipe],
      declarations: [DatePipesTestComponent]
    }).compileComponents();
  });

  let testComponent: DatePipesTestComponent;
  let fixture: ComponentFixture<DatePipesTestComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DatePipesTestComponent);
    testComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load', () => {
    expect(testComponent).toBeDefined();
    expect(true);
  });
});

@Component({
  template: `
    <div>
      <p>{{ date | dateFromPlusTo: 'h:mm a' : 10 }}</p>
      <p>{{ date | dateFormatDistance }}</p>
      <p>{{ 500 | minutesString }}</p>
      <p>{{ date | timeDistance }}</p>
      <p>{{ date | toJsDate }}</p>
      <p>{{ date | toMinutes }}</p>
    </div>
  `
})
class DatePipesTestComponent {
  public date = new Date();
}
