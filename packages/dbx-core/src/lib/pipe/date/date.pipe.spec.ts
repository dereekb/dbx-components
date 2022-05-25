import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Component } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DbxDatePipeModule } from './date.pipe.module';

describe('Date Pipe Test Component', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        DbxDatePipeModule,
        NoopAnimationsModule
      ],
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
      <p>{{ date | dateFromPlusTo:'h:mm a':10 }}</p>
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
